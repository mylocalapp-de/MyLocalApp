import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Debugging environment variables
console.log('Supabase URL is set:', !!supabaseUrl);
console.log('Supabase Anon Key is set:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Add a debug function to log Supabase requests/responses
export const logSupabaseRequest = (method, url, data) => {
  console.log('Supabase Request:', { method, url, data });
};

// Helper function to check if user is logged in
export const isUserLoggedIn = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error checking session:', error);
      return false;
    }
    return !!data?.session;
  } catch (error) {
    console.error('Unexpected error checking if user is logged in:', error);
    return false;
  }
}; 