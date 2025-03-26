import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Define env var defaults if not provided
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize Supabase client - we'll still use this for database access
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
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState([]);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    checkUser();
    
    // No longer need auth state listener since we're handling auth manually
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

  // Check for existing user session in AsyncStorage
  const checkUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('currentUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error checking stored user:', error);
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
      console.log('Preparing to create user account:', email);
      console.log('User preferences:', preferences);
      
      // Basic validation
      if (!email || !email.includes('@')) {
        return { 
          success: false, 
          error: { 
            message: 'Bitte gib eine gültige E-Mail-Adresse ein.',
            code: 'invalid_email'
          } 
        };
      }
      
      if (!password || password.length < 6) {
        return { 
          success: false, 
          error: { 
            message: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
            code: 'invalid_password'
          } 
        };
      }
      
      // Check if email already exists
      console.log('Checking if email already exists...');
      const { data: existingUser, error: checkError } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking existing user:', checkError);
        return { 
          success: false, 
          error: { 
            message: 'Fehler bei der Überprüfung der E-Mail-Adresse.',
            code: 'database_error'
          } 
        };
      }
      
      if (existingUser) {
        console.log('Email already registered:', email);
        return { 
          success: false, 
          error: { 
            message: 'Diese E-Mail-Adresse ist bereits registriert.',
            code: 'email_exists'
          } 
        };
      }
      
      // Create new user using our custom function
      console.log('Creating new user...');
      const { data: newUserData, error: createError } = await supabase
        .rpc('create_user', {
          p_email: email,
          p_password: password,
          p_preferences: preferences || [],
          p_display_name: email.split('@')[0] // Use part before @ as display name
        });
      
      if (createError) {
        console.error('Error creating user:', createError);
        return { 
          success: false, 
          error: { 
            message: 'Fehler beim Erstellen des Benutzers: ' + createError.message,
            code: 'create_user_error'
          } 
        };
      }
      
      const userId = newUserData;
      console.log('User created successfully with ID:', userId);
      
      // Fetch the full user data
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userError) {
        console.error('Error fetching user data:', userError);
        return { 
          success: true, 
          data: { 
            id: userId,
            email: email,
            preferences: preferences 
          } 
        };
      }
      
      // Create user object
      const newUser = {
        id: userData.id,
        email: userData.email,
        preferences: userData.preferences,
        displayName: userData.display_name
      };
      
      // Store user in state and local storage
      setUser(newUser);
      await AsyncStorage.setItem('currentUser', JSON.stringify(newUser));
      
      return { 
        success: true, 
        data: newUser 
      };
    } catch (error) {
      console.error('Unexpected error in upgradeToFullAccount:', error);
      return { 
        success: false, 
        error: {
          message: error.message || 'Ein unerwarteter Fehler ist aufgetreten.',
          code: 'unexpected_error'
        }
      };
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      console.log('Attempting to sign in user with email:', email);
      
      // Verify credentials using our custom function
      const { data: userId, error: verifyError } = await supabase
        .rpc('verify_password', {
          email: email,
          password: password
        });
      
      if (verifyError || !userId) {
        console.error('Invalid login credentials');
        return { 
          success: false, 
          error: {
            message: 'Falsche E-Mail oder Passwort.',
            code: 'invalid_credentials'
          }
        };
      }
      
      console.log('Credentials verified, user ID:', userId);
      
      // Fetch full user data
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userError) {
        console.error('Error fetching user data:', userError);
        return { 
          success: false, 
          error: {
            message: 'Benutzer konnte nicht geladen werden.',
            code: 'user_fetch_error'
          }
        };
      }
      
      // Create user object
      const loggedInUser = {
        id: userData.id,
        email: userData.email,
        preferences: userData.preferences || [],
        displayName: userData.display_name
      };
      
      // Store user in state and local storage
      setUser(loggedInUser);
      await AsyncStorage.setItem('currentUser', JSON.stringify(loggedInUser));
      
      // Save preferences locally too
      setPreferences(loggedInUser.preferences);
      await AsyncStorage.setItem('userPreferences', JSON.stringify(loggedInUser.preferences));
      
      return { 
        success: true, 
        data: loggedInUser 
      };
    } catch (error) {
      console.error('Error signing in:', error);
      return { 
        success: false, 
        error: {
          message: error.message || 'Ein Fehler ist aufgetreten.',
          code: 'signin_error'
        }
      };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Clear user from state and storage
      setUser(null);
      await AsyncStorage.removeItem('currentUser');
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