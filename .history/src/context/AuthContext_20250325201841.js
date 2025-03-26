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
        const { data } = await supabase.auth.getSession();
        
        if (data?.session) {
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
          }
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
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession?.user) {
          // Get user preferences
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', currentSession.user.id)
            .single();
            
          if (profileData?.preferences) {
            setPreferences(profileData.preferences);
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

  // Sign up function (without password initially)
  const signUp = async (email) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: generateTempPassword(), // Temporary password
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  // Sign in function
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
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
    if (!user) return { error: 'No user logged in' };
    
    try {
      // First update context state
      setPreferences(newPreferences);
      
      // Then update in database
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          preferences: newPreferences,
          updated_at: new Date()
        });
        
      if (error) throw error;
      return { error: null };
    } catch (error) {
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