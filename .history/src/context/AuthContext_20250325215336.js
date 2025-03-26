import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

// Create context
const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  preferences: [],
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  setPreferences: () => {},
  updateProfile: async () => {},
  createProfile: async () => {},
});

// Provider component
export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [preferences, setPreferences] = useState([]);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        setLoading(true);
        console.log('Getting initial session...');
        const { data } = await supabase.auth.getSession();
        
        if (data?.session) {
          console.log('Initial session found for user:', data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);
          
          // Get user preferences
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', data.session.user.id)
            .single();
            
          if (profileData?.preferences) {
            setPreferences(profileData.preferences);
            console.log('Set initial preferences:', profileData.preferences);
          }
        } else {
          console.log('No initial session found');
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Set up auth state subscriber
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession ? 'Session exists' : 'No session');
        
        // Handle the session change
        if (currentSession) {
          console.log('Setting user from auth change:', currentSession.user.id);
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Get user preferences
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('preferences')
              .eq('id', currentSession.user.id)
              .single();
            
            if (profileData?.preferences) {
              console.log('Updated preferences from auth change:', profileData.preferences);
              setPreferences(profileData.preferences);
            } else {
              console.log('No preferences found for user:', currentSession.user.id);
            }
          } catch (error) {
            console.error('Error fetching preferences after auth change:', error);
          }
        } else {
          // No session, reset user state
          console.log('Clearing user and session (no current session)');
          setSession(null);
          setUser(null);
          setPreferences([]);
        }
      }
    );

    return () => {
      console.log('Cleaning up auth listener');
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Direct function to create a profile using RPC function to bypass RLS
  const createProfile = async (userId) => {
    try {
      if (!userId) {
        console.error('No user ID provided when creating profile');
        return { error: 'No user ID provided' };
      }
      
      console.log('Creating profile directly via SQL for user:', userId);
      
      // Execute a direct SQL command to bypass RLS issues
      // We'll use a raw SQL query with service role if available
      const { error } = await supabase.rpc('create_profile_for_user', { user_id: userId });
      
      if (error) {
        console.error('Error creating profile via RPC:', error);
        
        // Fallback: try direct insert
        console.log('Falling back to direct insert');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, preferences: [] });
          
        if (insertError) {
          console.error('Error in fallback profile creation:', insertError);
          return { error: insertError };
        }
      }
      
      return { error: null };
    } catch (error) {
      console.error('Unexpected error creating profile:', error);
      return { error };
    }
  };

  // Sign up function (without password initially)
  const signUp = async (email) => {
    try {
      const password = generateTempPassword();
      console.log('Signing up with email:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        console.error('Signup error:', error);
        throw error;
      }
      
      if (!data.session) {
        console.log('No session returned, creating profile manually in separate call');
        // Store the user ID for later use
        if (data.user) {
          try {
            // Try to create profile - may fail due to RLS
            await createProfile(data.user.id);
          } catch (profileError) {
            console.error('Failed to create profile after signup:', profileError);
          }
        }
      } else {
        console.log('Session available, setting user and session directly');
        // Set user and session manually to ensure they're available for the onboarding screen
        setUser(data.user);
        setSession(data.session);
        
        // Also create profile if not done by trigger
        try {
          const { data: profileCheck } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();
            
          if (!profileCheck) {
            console.log('No profile found after signup, creating manually');
            await createProfile(data.user.id);
          }
        } catch (profileError) {
          console.error('Error checking/creating profile:', profileError);
        }
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Error in signUp function:', error);
      return { data: null, error };
    }
  };

  // Sign in function
  const signIn = async (email, password) => {
    try {
      console.log('Signing in with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPreferences([]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Update user preferences
  const updatePreferences = async (newPreferences) => {
    if (!user) {
      console.error('No user logged in when updating preferences');
      return { error: 'No user logged in' };
    }
    
    console.log('Updating preferences for user:', user.id, 'with preferences:', newPreferences);
    
    try {
      // First update context state
      setPreferences(newPreferences);
      
      // Check if profile exists
      const { data: profileExists } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
        
      if (!profileExists) {
        console.log('No profile found, creating before updating preferences');
        const { error: createError } = await createProfile(user.id);
        if (createError) {
          console.error('Failed to create profile before setting preferences:', createError);
          throw createError;
        }
      }
      
      // Then update in database
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          preferences: newPreferences,
          updated_at: new Date()
        });
        
      if (error) {
        console.error('Error saving preferences to DB:', error);
        throw error;
      }
      return { error: null };
    } catch (error) {
      console.error('Error in updatePreferences:', error);
      return { error };
    }
  };
  
  // Update user profile (e.g., set password, update email)
  const updateProfile = async (updates) => {
    try {
      // Update password if provided
      if (updates.password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: updates.password,
        });
        
        if (passwordError) throw passwordError;
      }
      
      // Update profile data if needed
      if (updates.profileData && user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id, 
            ...updates.profileData,
            updated_at: new Date()
          });
          
        if (profileError) throw profileError;
      }
      
      return { error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { error };
    }
  };
  
  // Generate a temporary random password
  const generateTempPassword = () => {
    return Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
  };

  const value = {
    user,
    session,
    loading,
    preferences,
    signUp,
    signIn,
    signOut,
    setPreferences: updatePreferences,
    updateProfile,
    createProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 