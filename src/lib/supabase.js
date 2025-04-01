import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// First, try to get environment variables directly from process.env
// This works with Expo's static replacement of environment variables
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// If not available through process.env, try to get them from Constants
if (!supabaseUrl || !supabaseAnonKey) {
  const { extra = {} } = Constants.expoConfig || {};
  supabaseUrl = extra.supabaseUrl;
  supabaseAnonKey = extra.supabaseAnonKey;
}

// Log a warning if the variables are still undefined
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase URL or Anon Key is undefined. Make sure environment variables are set correctly. ' +
    'Check that your .env file contains EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, ' + 
    'or that they are set in the Expo dashboard.'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});

// For debugging in development
if (__DEV__) {
  console.log("Supabase URL:", supabaseUrl || "Undefined");
  console.log("Supabase Anon Key:", supabaseAnonKey ? "Defined" : "Undefined");
  
  // Check if Supabase URL is reachable
  if (supabaseUrl) {
    fetch(supabaseUrl)
      .then(response => {
        console.log(`Supabase URL connectivity check: Success (${response.status})`);
      })
      .catch(error => {
        console.error(`Supabase URL connectivity check failed: ${error.message}`);
        console.error('This could indicate network issues or an incorrect Supabase URL');
      });
  }
} 