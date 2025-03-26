import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys for AsyncStorage
const LOCAL_USER_KEY = 'myLocalApp_localUser';
const LOCAL_PREFERENCES_KEY = 'myLocalApp_preferences';

/**
 * Save a local user
 * @param {string} email Email address of local user
 * @returns {Promise<void>}
 */
export const saveLocalUser = async (email) => {
  try {
    const userData = {
      email,
      isLocal: true,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
    console.log('Local user saved:', email);
    return true;
  } catch (error) {
    console.error('Error saving local user:', error);
    return false;
  }
};

/**
 * Get the local user data
 * @returns {Promise<Object|null>} Local user data or null
 */
export const getLocalUser = async () => {
  try {
    const userData = await AsyncStorage.getItem(LOCAL_USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting local user:', error);
    return null;
  }
};

/**
 * Check if local user exists
 * @returns {Promise<boolean>}
 */
export const hasLocalUser = async () => {
  const user = await getLocalUser();
  return !!user;
};

/**
 * Remove the local user data
 * @returns {Promise<void>}
 */
export const removeLocalUser = async () => {
  try {
    await AsyncStorage.removeItem(LOCAL_USER_KEY);
    console.log('Local user removed');
    return true;
  } catch (error) {
    console.error('Error removing local user:', error);
    return false;
  }
};

/**
 * Save preferences for the local user
 * @param {Array} preferences Array of preference IDs
 * @returns {Promise<boolean>}
 */
export const saveLocalPreferences = async (preferences) => {
  try {
    await AsyncStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
    console.log('Local preferences saved:', preferences);
    return true;
  } catch (error) {
    console.error('Error saving local preferences:', error);
    return false;
  }
};

/**
 * Get the local user preferences
 * @returns {Promise<Array>} Array of preference IDs
 */
export const getLocalPreferences = async () => {
  try {
    const preferences = await AsyncStorage.getItem(LOCAL_PREFERENCES_KEY);
    return preferences ? JSON.parse(preferences) : [];
  } catch (error) {
    console.error('Error getting local preferences:', error);
    return [];
  }
};

/**
 * Convert a local account to a permanent Supabase account
 * @param {Function} createAccountFn Function to create permanent account
 * @param {string} password Password for the new account
 * @returns {Promise<Object>} Result of account creation
 */
export const convertLocalToPermanent = async (createAccountFn, password) => {
  try {
    const localUser = await getLocalUser();
    if (!localUser) {
      return { success: false, error: 'No local user found' };
    }
    
    const preferences = await getLocalPreferences();
    
    // Create permanent account using the provided function
    const result = await createAccountFn(localUser.email, password, preferences);
    
    if (result.success) {
      // If successful, remove local user data
      await removeLocalUser();
      await AsyncStorage.removeItem(LOCAL_PREFERENCES_KEY);
    }
    
    return result;
  } catch (error) {
    console.error('Error converting local user to permanent:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}; 