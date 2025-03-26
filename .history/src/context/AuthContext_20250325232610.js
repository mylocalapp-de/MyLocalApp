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
      
      // Check for test domains that Supabase blocks
      if (email.includes('@test.') || email.includes('@example.')) {
        console.error('Email domain not allowed: Test or example domains are not supported by Supabase');
        return { 
          success: false, 
          error: { 
            message: 'Diese E-Mail-Domain wird nicht unterstützt. Bitte verwende eine andere E-Mail-Adresse.',
            code: 'email_address_invalid'
          } 
        };
      }
      
      // First try to sign up the user
      console.log('Attempting to create user with email:', email);
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
      
      if (error) {
        console.error('Error during auth.signUp:', error);
        
        // Better error handling for common cases
        if (error.message.includes('already registered')) {
          return { 
            success: false, 
            error: {
              message: 'Diese E-Mail-Adresse ist bereits registriert.',
              code: 'email_exists'
            }
          };
        }
        
        throw error;
      }
      
      if (!data?.user?.id) {
        console.error('User created without ID');
        return { 
          success: false, 
          error: {
            message: 'Benutzer konnte nicht erstellt werden.',
            code: 'user_creation_failed'
          }
        };
      }
      
      console.log('User created successfully:', data.user.id);
      
      // Wait a bit for the trigger to execute
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Manually create profile if trigger didn't work
      let profileCreated = false;
      let preferencesCreated = false;
      
      // Check if profile was created by the trigger
      if (data?.user?.id) {
        // Try multiple times to check if the profile was created
        for (let attempt = 1; attempt <= 3; attempt++) {
          console.log(`Checking for profile creation, attempt ${attempt}/3...`);
          
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id);
          
          if (!profileError && profileData && profileData.length > 0) {
            console.log('Profile found:', profileData);
            profileCreated = true;
            break;
          }
          
          // Wait before retrying
          if (attempt < 3) {
            console.log(`No profile found yet, waiting before retry ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // If profile wasn't created by the trigger, create it manually
        if (!profileCreated) {
          console.log('Profile not created by trigger, creating manually...');
          try {
            // First try using RPC function
            const { error: rpcError } = await supabase
              .rpc('create_profile_for_user', { user_id: data.user.id });
              
            if (rpcError) {
              console.error('RPC function failed:', rpcError);
              
              // Fallback to direct insert if RPC fails
              console.log('Attempting direct profile insertion...');
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  username: email
                });
                
              if (insertError) {
                console.error('Direct profile insertion failed:', insertError);
              } else {
                console.log('Successfully created profile via direct insertion');
                profileCreated = true;
              }
            } else {
              console.log('Successfully created profile using RPC function');
              profileCreated = true;
            }
          } catch (profileError) {
            console.error('Error creating profile manually:', profileError);
          }
        }
        
        // Now handle preferences
        if (preferences && preferences.length > 0) {
          // Check if preferences were created by trigger
          const { data: prefsData, error: prefsError } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', data.user.id);
            
          if (!prefsError && prefsData && prefsData.length > 0) {
            console.log('Preferences found:', prefsData);
            preferencesCreated = true;
          } else {
            // Try to create preferences manually
            console.log('Manually inserting preferences:', preferences);
            try {
              // First try using custom RPC
              const { error: rpcError } = await supabase
                .rpc('insert_user_preferences', { 
                  p_user_id: data.user.id, 
                  p_preferences: preferences 
                });
                
              if (rpcError) {
                console.error('Custom preference RPC failed:', rpcError);
                
                // Fallback to direct insert
                const prefsToInsert = preferences.map(p => ({
                  user_id: data.user.id,
                  preference_key: p
                }));
                
                const { error: insertError } = await supabase
                  .from('user_preferences')
                  .insert(prefsToInsert);
                  
                if (insertError) {
                  console.error('Direct preference insertion failed:', insertError);
                } else {
                  console.log('Successfully inserted preferences via direct insertion');
                  preferencesCreated = true;
                }
              } else {
                console.log('Successfully inserted preferences using custom RPC');
                preferencesCreated = true;
              }
            } catch (prefsError) {
              console.error('Error inserting preferences manually:', prefsError);
            }
          }
        }
      }
      
      return { 
        success: true, 
        data,
        profileCreated,
        preferencesCreated
      };
    } catch (error) {
      console.error('Error upgrading account:', error);
      return { success: false, error };
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      console.log('Attempting to sign in user with email:', email);
      
      // Check if the user exists before attempting sign in
      const { data: userExistsData, error: userExistsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', email)
        .maybeSingle();
        
      if (userExistsError) {
        console.warn('Error checking if user exists:', userExistsError);
      } else {
        console.log('User exists check:', userExistsData ? 'User found' : 'User not found');
      }
      
      // Try to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error.message);
        if (error.message.includes('Invalid login credentials')) {
          console.log('User attempted to sign in with invalid credentials');
        }
        throw error;
      }
      
      console.log('Sign in successful, user ID:', data.user.id);
      
      // Check if user has a profile, create one if not
      if (data?.user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
          
        if (profileError) {
          console.warn('Error checking user profile:', profileError);
        } else if (!profileData) {
          console.log('Profile not found, creating...');
          try {
            const { error: createError } = await supabase
              .rpc('create_profile_for_user', { user_id: data.user.id });
              
            if (createError) {
              console.error('Error creating profile:', createError);
            } else {
              console.log('Profile created successfully');
            }
          } catch (createProfileError) {
            console.error('Unexpected error creating profile:', createProfileError);
          }
        } else {
          console.log('Existing profile found:', profileData.username);
        }
      }
      
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