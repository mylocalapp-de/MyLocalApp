import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import {
  saveLocalUser,
  getLocalUser,
  hasLocalUser,
  removeLocalUser,
  saveLocalPreferences,
  getLocalPreferences,
  convertLocalToPermanent
} from '../utils/localStorage';

// Create context
const AuthContext = createContext({
  user: null,
  session: null,
  localUser: null,
  loading: true,
  preferences: [],
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  setPreferences: () => {},
  updateProfile: async () => {},
  createProfile: async () => {},
  createLocalUser: async () => {},
  convertToPermAccount: async () => {},
  isLocalAccount: false,
});

// Provider component
export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [localUser, setLocalUser] = useState(null);
  const [preferences, setPreferences] = useState([]);
  const [isLocalAccount, setIsLocalAccount] = useState(false);

  useEffect(() => {
    // Check for both Supabase and local accounts
    const checkUserState = async () => {
      try {
        setLoading(true);
        
        // First check for Supabase session
        const { data } = await supabase.auth.getSession();
        
        if (data?.session) {
          // Supabase user is authenticated
          setSession(data.session);
          setUser(data.session.user);
          setIsLocalAccount(false);
          
          // Get user preferences
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', data.session.user.id)
            .single();
            
          if (profileData?.preferences) {
            setPreferences(profileData.preferences);
          }
        } else {
          // Check for local user
          const localUserData = await getLocalUser();
          if (localUserData) {
            setLocalUser(localUserData);
            setIsLocalAccount(true);
            
            // Get local preferences
            const localPrefs = await getLocalPreferences();
            setPreferences(localPrefs);
          }
        }
      } catch (error) {
        console.error('Error checking user state:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUserState();

    // Set up auth state subscriber for Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event);
        
        if (currentSession) {
          // Supabase user is authenticated, clear any local user
          setSession(currentSession);
          setUser(currentSession.user);
          setLocalUser(null);
          setIsLocalAccount(false);
          
          // Get user preferences
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('preferences')
              .eq('id', currentSession.user.id)
              .single();
              
            if (profileData?.preferences) {
              setPreferences(profileData.preferences);
            }
          } catch (error) {
            console.error('Error getting preferences after auth change:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          // Clear Supabase user state
          setSession(null);
          setUser(null);
          
          // Check for local user
          const localUserData = await getLocalUser();
          if (localUserData) {
            setLocalUser(localUserData);
            setIsLocalAccount(true);
            
            // Get local preferences
            const localPrefs = await getLocalPreferences();
            setPreferences(localPrefs);
          } else {
            setLocalUser(null);
            setIsLocalAccount(false);
            setPreferences([]);
          }
        }
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Create a local user (no Supabase account)
  const createLocalUser = async (email) => {
    try {
      console.log('Creating local user with email:', email);
      
      const success = await saveLocalUser(email);
      
      if (success) {
        const localUserData = await getLocalUser();
        setLocalUser(localUserData);
        setIsLocalAccount(true);
        return { success: true, user: localUserData };
      } else {
        throw new Error('Failed to save local user');
      }
    } catch (error) {
      console.error('Error creating local user:', error);
      return { success: false, error };
    }
  };

  // Convert local account to permanent Supabase account
  const convertToPermAccount = async (password) => {
    if (!localUser) {
      return { success: false, error: 'No local user to convert' };
    }
    
    try {
      console.log('Converting local account to permanent for:', localUser.email);
      
      // Register with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: localUser.email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      // If successful, update local state and save preferences
      if (data.user) {
        // Transfer preferences from local to Supabase
        const localPrefs = await getLocalPreferences();
        
        if (localPrefs.length > 0) {
          await supabase.rpc('create_profile_bypass_rls', {
            user_id: data.user.id,
            user_preferences: localPrefs
          });
        }
        
        // Clean up local storage
        await removeLocalUser();
        
        // Update state
        setLocalUser(null);
        setIsLocalAccount(false);
        setUser(data.user);
        setSession(data.session);
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: 'No user returned from Supabase' };
      }
    } catch (error) {
      console.error('Error converting to permanent account:', error);
      return { success: false, error };
    }
  };

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

  // Traditional sign up function (with password)
  const signUp = async (email) => {
    // We'll now use local user approach instead
    return createLocalUser(email);
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
      if (isLocalAccount) {
        // For local accounts, just remove from storage
        await removeLocalUser();
        setLocalUser(null);
        setIsLocalAccount(false);
        setPreferences([]);
      } else {
        // For Supabase accounts, use the API
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setPreferences([]);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Update user preferences
  const updatePreferences = async (newPreferences) => {
    if (isLocalAccount) {
      // For local accounts, save to AsyncStorage
      try {
        const success = await saveLocalPreferences(newPreferences);
        if (success) {
          setPreferences(newPreferences);
          return { error: null };
        } else {
          return { error: 'Failed to save preferences' };
        }
      } catch (error) {
        console.error('Error saving local preferences:', error);
        return { error };
      }
    } else {
      // For Supabase accounts, save to database
      if (!user) {
        console.error('No user logged in when updating preferences');
        return { error: 'No user logged in' };
      }
      
      console.log('Updating preferences for user ID:', user.id);
      
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
    localUser,
    loading,
    preferences,
    isLocalAccount,
    signUp,
    signIn,
    signOut,
    setPreferences: updatePreferences,
    updateProfile,
    createProfile,
    createLocalUser,
    convertToPermAccount,
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