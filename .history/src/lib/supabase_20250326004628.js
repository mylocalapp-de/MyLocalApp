import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

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

// Helper function to get authenticated user
export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
};

// Helper function to fetch user details from our custom user table
export const getUserDetails = async (userId) => {
  if (!userId) return null;
  
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
  
  return data;
};

// Helper function to sign in with email/password
export const signInWithEmail = async (email, password) => {
  try {
    // First try to authenticate via Supabase RPC
    const { data, error } = await supabase.rpc('verify_password', {
      email: email, 
      password: password
    });
    
    if (error) {
      console.error('Error in RPC auth:', error);
      return { error };
    }
    
    if (data) {
      console.log('User authenticated successfully via RPC, ID:', data);
      
      // Get user details
      const userDetails = await getUserDetails(data);
      
      return { 
        user: {
          id: data,
          email: email,
          ...userDetails
        } 
      };
    }
    
    return { error: { message: 'Invalid login credentials' } };
  } catch (error) {
    console.error('Error in signInWithEmail:', error);
    return { error };
  }
};

// Helper function to register a new user
export const registerUser = async (email, password, displayName, preferences = []) => {
  try {
    // Create a new user in our custom table
    const { data, error } = await supabase.rpc('create_user', {
      p_email: email,
      p_password: password,
      p_display_name: displayName,
      p_preferences: preferences
    });
    
    if (error) {
      console.error('Error creating user:', error);
      return { error };
    }
    
    if (data) {
      console.log('User created successfully, ID:', data);
      
      // Return user object
      return { 
        user: {
          id: data,
          email,
          display_name: displayName,
          preferences
        } 
      };
    }
    
    return { error: { message: 'Error creating user account' } };
  } catch (error) {
    console.error('Error in registerUser:', error);
    return { error };
  }
};

// Helper function to update user preferences
export const updateUserPreferences = async (userId, preferences) => {
  if (!userId) return { error: { message: 'No user ID provided' } };
  
  try {
    const { data, error } = await supabase
      .from('app_users')
      .update({ preferences })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating preferences:', error);
      return { error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in updateUserPreferences:', error);
    return { error };
  }
};

// Helper function to update user display name
export const updateUserDisplayName = async (userId, displayName) => {
  if (!userId) return { error: { message: 'No user ID provided' } };
  
  try {
    console.log('Updating display name from:', await getUserDetails(userId).then(data => data?.display_name), 'to:', displayName);
    
    const { data, error } = await supabase
      .from('app_users')
      .update({ display_name: displayName })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating display name:', error);
      return { error };
    }
    
    console.log('Display name successfully updated to:', displayName);
    return { success: true };
  } catch (error) {
    console.error('Error in updateUserDisplayName:', error);
    return { error };
  }
}; 