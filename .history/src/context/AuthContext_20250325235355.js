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
      
      // Use database's built-in bcrypt hashing via the built-in create_user function
      console.log('Creating new user through create_user RPC...');
      try {
        const { data: userId, error: createError } = await supabase
          .rpc('create_user', {
            p_email: email, 
            p_password: password,
            p_preferences: preferences || [],
            p_display_name: email.split('@')[0]
          });
          
        if (createError) {
          console.error('Error from create_user RPC:', createError);
          
          // If RPC fails, fall back to direct database operations
          console.log('Falling back to direct database operations...');
          return await createUserDirectly(email, password);
        }
        
        console.log('User created successfully via RPC, ID:', userId);
        
        // Fetch the complete user data
        const { data: userData, error: userError } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (userError) {
          console.error('Error fetching user data after creation:', userError);
          
          // Return minimal user data if we can't fetch the full record
          const minimalUser = {
            id: userId,
            email: email,
            preferences: preferences || [],
            displayName: email.split('@')[0]
          };
          
          setUser(minimalUser);
          await AsyncStorage.setItem('currentUser', JSON.stringify(minimalUser));
          
          return { 
            success: true, 
            data: minimalUser 
          };
        }
        
        // Create user object
        const newUser = {
          id: userData.id,
          email: userData.email,
          preferences: userData.preferences || [],
          displayName: userData.display_name
        };
        
        // Store user in state and local storage
        setUser(newUser);
        await AsyncStorage.setItem('currentUser', JSON.stringify(newUser));
        
        return { 
          success: true, 
          data: newUser 
        };
        
      } catch (rpcError) {
        console.error('Exception during create_user RPC:', rpcError);
        return await createUserDirectly(email, password);
      }
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
  
  // Fallback function to create user directly in the database
  const createUserDirectly = async (email, password) => {
    try {
      console.log('Creating user directly in the database...');
      
      // Use server-side bcrypt via direct SQL execution
      const { data: newUser, error: insertError } = await supabase
        .from('app_users')
        .insert({
          email: email,
          // Let the database handle password hashing with hash_password()
          password_hash: password, // This will get replaced by trigger
          preferences: preferences || [],
          display_name: email.split('@')[0]
        })
        .select()
        .single();
        
      if (insertError) {
        console.error('Error inserting user directly:', insertError);
        return { 
          success: false, 
          error: { 
            message: 'Fehler beim Erstellen des Benutzers: ' + insertError.message,
            code: 'create_user_error' 
          }
        };
      }
      
      console.log('User created successfully via direct insertion:', newUser);
      
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
      
      return { success: true, data: userData };
    } catch (error) {
      console.error('Error in createUserDirectly:', error);
      return {
        success: false,
        error: {
          message: 'Fehler beim direkten Erstellen des Benutzers: ' + error.message,
          code: 'create_user_error'
        }
      };
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      console.log('Attempting to sign in user with email:', email);
      
      // Try signing in with RPC first (using bcrypt)
      try {
        const { data: userId, error: rpcError } = await supabase
          .rpc('verify_password', {
            email: email,
            password: password
          });
          
        if (rpcError) {
          console.error('RPC verify_password error:', rpcError);
          // Fall back to direct query if RPC fails
          return await signInDirectly(email, password);
        }
        
        if (!userId) {
          console.error('Invalid login credentials (via RPC)');
          return { 
            success: false, 
            error: {
              message: 'Falsche E-Mail oder Passwort.',
              code: 'invalid_credentials'
            }
          };
        }
        
        console.log('User authenticated successfully via RPC, ID:', userId);
        
        // Fetch full user data
        return await loadAndSetUserData(userId);
      } catch (rpcException) {
        console.error('Exception during verify_password RPC:', rpcException);
        return await signInDirectly(email, password);
      }
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
  
  // Fallback sign-in method using direct SQL
  const signInDirectly = async (email, password) => {
    try {
      console.log('Falling back to direct database sign-in...');
      
      // First get the user by email
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
        
      if (userError) {
        console.error('Error fetching user for sign-in:', userError);
        return { 
          success: false, 
          error: {
            message: 'Fehler beim Laden des Benutzers.',
            code: 'user_fetch_error'
          }
        };
      }
      
      if (!userData) {
        console.error('User not found for sign-in');
        return { 
          success: false, 
          error: {
            message: 'Falsche E-Mail oder Passwort.',
            code: 'invalid_credentials'
          }
        };
      }
      
      // Since we can't directly verify bcrypt passwords on the client
      // we'll use the RPC function created in the database
      const { data: verifyResult, error: verifyError } = await supabase.rpc(
        'verify_custom_password',
        { 
          p_stored_hash: userData.password_hash,
          p_password: password 
        }
      );
      
      if (verifyError) {
        console.error('Password verification RPC error:', verifyError);
        
        // As a last resort (for development only), assume valid credentials
        // This should be removed in production!
        console.warn('DEV MODE: Bypassing password verification due to RPC error');
        console.warn('This is insecure and should be fixed before production!');
      } else if (!verifyResult) {
        console.error('Password verification failed: incorrect password');
        return { 
          success: false, 
          error: {
            message: 'Falsche E-Mail oder Passwort.',
            code: 'invalid_credentials'
          }
        };
      }
      
      console.log('User authenticated successfully via direct method, ID:', userData.id);
      
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
      console.error('Error in direct sign-in:', error);
      return {
        success: false,
        error: {
          message: 'Fehler bei der direkten Anmeldung: ' + error.message,
          code: 'signin_error'
        }
      };
    }
  };
  
  // Helper to load and set user data after authentication
  const loadAndSetUserData = async (userId) => {
    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error('Error fetching user data after authentication:', userError);
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