import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Define env var defaults if not provided
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Create auth context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState([]);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    checkUser();
    
    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Check if user has completed onboarding
    const checkOnboarding = async () => {
      try {
        const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
        if (onboardingStatus === 'true') {
          setHasCompletedOnboarding(true);
        }
        
        // Load preferences
        const savedPreferences = await AsyncStorage.getItem('userPreferences');
        if (savedPreferences) {
          setPreferences(JSON.parse(savedPreferences));
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    };
    
    checkOnboarding();
  }, []);

  // Check current user and session
  const checkUser = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    } catch (error) {
      console.error('Error checking user:', error);
      setLoading(false);
    }
  };

  // Create a new local account with preferences
  const createLocalAccount = async (selectedPreferences) => {
    try {
      await AsyncStorage.setItem('userPreferences', JSON.stringify(selectedPreferences));
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setPreferences(selectedPreferences);
      setHasCompletedOnboarding(true);
      return { success: true };
    } catch (error) {
      console.error('Error creating local account:', error);
      return { success: false, error };
    }
  };

  // Convert local account to full account with email and password
  const upgradeToFullAccount = async (email, password) => {
    try {
      // Format preferences as an array to match what our trigger expects
      console.log('Preparing preferences for account upgrade:', preferences);
      
      // First try to sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Format metadata properly - try multiple formats to ensure trigger finds it
          data: { 
            preferences: preferences,
            // Also add as a direct property for maximum compatibility
            raw_preferences: preferences
          }
        }
      });
      
      if (error) throw error;
      
      // Wait a bit for the trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if profile was created by the trigger
      if (data?.user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        // If profile wasn't created by the trigger, create it manually
        if (profileError || !profileData) {
          console.log('Profile not created by trigger, creating manually...');
          try {
            // Try direct DB insert first
            const { error: insertError } = await supabase
              .from('profiles')
              .insert([{ 
                id: data.user.id, 
                username: email 
              }])
              .single();
              
            if (insertError) {
              console.warn('Manual profile insertion failed:', insertError);
              // Try using our helper function
              const { error: rpcError } = await supabase
                .rpc('create_profile_for_user', { user_id: data.user.id });
                
              if (rpcError) {
                console.error('Helper function also failed:', rpcError);
              }
            }
            
            // Now try to add preferences
            if (preferences && preferences.length > 0) {
              const prefsToInsert = preferences.map(p => ({
                user_id: data.user.id,
                preference_key: p
              }));
              
              const { error: prefError } = await supabase
                .from('user_preferences')
                .insert(prefsToInsert);
                
              if (prefError) {
                console.warn('Failed to insert preferences:', prefError);
              }
            }
          } catch (manualError) {
            console.error('Error in manual profile creation:', manualError);
          }
        }
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Error upgrading account:', error);
      return { success: false, error };
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error signing in:', error);
      return { success: false, error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error };
    }
  };

  // Reset onboarding status (for testing)
  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await AsyncStorage.removeItem('userPreferences');
      setHasCompletedOnboarding(false);
      setPreferences([]);
      return { success: true };
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      return { success: false, error };
    }
  };

  const value = {
    user,
    session,
    loading,
    preferences,
    hasCompletedOnboarding,
    supabase,
    createLocalAccount,
    upgradeToFullAccount,
    signIn,
    signOut,
    resetOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 