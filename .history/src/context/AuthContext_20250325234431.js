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
      
      // Create a simple hash of the password using a consistent algorithm
      // This is not secure for production, but works for the demo
      const passwordHash = await simpleHash(password);
      
      // Create new user directly with an INSERT
      console.log('Creating new user directly in database...');
      const { data: newUser, error: insertError } = await supabase
        .from('app_users')
        .insert({
          email: email,
          password_hash: passwordHash,
          preferences: preferences || [],
          display_name: email.split('@')[0] // Use part before @ as display name
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting new user:', insertError);
        return { 
          success: false, 
          error: { 
            message: 'Fehler beim Erstellen des Benutzers: ' + insertError.message,
            code: 'create_user_error'
          } 
        };
      }
      
      console.log('User created successfully:', newUser);
      
      // Create user object
      const userData = {
        id: newUser.id,
        email: newUser.email,
        preferences: newUser.preferences || [],
        displayName: newUser.display_name
      };
      
      // Store user in state and local storage
      setUser(userData);
      await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
      
      return { 
        success: true, 
        data: userData 
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

  // Simple hashing function for password (not secure, but functional for demo)
  const simpleHash = async (text) => {
    // For simplicity, we'll use a basic MD5-like algorithm
    // In a real app, you'd use a proper hashing library
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16); // Convert to hex string
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      console.log('Attempting to sign in user with email:', email);
      
      // Create the same hash we'd use when creating the user
      const passwordHash = await simpleHash(password);
      
      // Fetch user with matching email and password
      const { data: userData, error: authError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email)
        .eq('password_hash', passwordHash)
        .maybeSingle();
      
      if (authError) {
        console.error('Error during authentication:', authError);
        return { 
          success: false, 
          error: {
            message: 'Anmeldefehler. Bitte versuche es später erneut.',
            code: 'auth_error'
          }
        };
      }
      
      if (!userData) {
        console.error('Invalid login credentials');
        return { 
          success: false, 
          error: {
            message: 'Falsche E-Mail oder Passwort.',
            code: 'invalid_credentials'
          }
        };
      }
      
      console.log('User authenticated successfully:', userData.id);
      
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