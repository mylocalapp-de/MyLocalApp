import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize the Supabase client with placeholders
// Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// Initialize the Supabase client
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Simplified mock functions for development
export const getUser = async () => {
  // For development, return a mock user
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
  };
};

export const getUserDetails = async (userId) => {
  // For development, return mock user details
  return {
    id: userId || '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    display_name: 'Test User',
    preferences: ['kultur', 'sport', 'verkehr']
  };
};

// Mock implementation for signInWithEmail
export const signInWithEmail = async (email, password) => {
  // For development, always return success
  return { 
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: email,
      display_name: 'Test User',
      preferences: ['kultur', 'sport', 'verkehr']
    } 
  };
};

// Mock implementation for registerUser
export const registerUser = async (email, password, displayName, preferences = []) => {
  // For development, always return success
  return { 
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: email,
      display_name: displayName,
      preferences: preferences
    } 
  };
};

// Mock implementation for updateUserPreferences
export const updateUserPreferences = async (userId, preferences) => {
  console.log('Mock: Updated preferences to', preferences);
  return { success: true };
};

// Mock implementation for updateUserDisplayName
export const updateUserDisplayName = async (userId, displayName) => {
  console.log('Mock: Updated display name to', displayName);
  return { success: true };
}; 