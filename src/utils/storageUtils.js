import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_DATA_PREFIX = '@offline_data:';
const OFFLINE_MODE_KEY = '@app_status:isOfflineMode';
const LAST_OFFLINE_SAVE_KEY = '@app_status:lastOfflineSaveTimestamp';

/**
 * Saves data for a specific key to AsyncStorage for offline use.
 * @param {string} key - A unique key identifying the data (e.g., 'articles', 'filters').
 * @param {any} data - The data to save.
 */
export const saveOfflineData = async (key, data) => {
  try {
    const storageKey = `${OFFLINE_DATA_PREFIX}${key}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(data));
    console.log(`[StorageUtils] Offline data saved for key: ${key}`);
  } catch (error) {
    console.error(`[StorageUtils] Error saving offline data for key ${key}:`, error);
  }
};

/**
 * Loads offline data for a specific key from AsyncStorage.
 * @param {string} key - The key identifying the data to load.
 * @returns {Promise<any|null>} The loaded data, or null if not found or error.
 */
export const loadOfflineData = async (key) => {
  try {
    const storageKey = `${OFFLINE_DATA_PREFIX}${key}`;
    const jsonData = await AsyncStorage.getItem(storageKey);
    if (jsonData !== null) {
      console.log(`[StorageUtils] Offline data loaded for key: ${key}`);
      return JSON.parse(jsonData);
    }
    console.log(`[StorageUtils] No offline data found for key: ${key}`);
    return null;
  } catch (error) {
    console.error(`[StorageUtils] Error loading offline data for key ${key}:`, error);
    return null;
  }
};

/**
 * Saves the offline mode status to AsyncStorage.
 * @param {boolean} isOffline - Whether the app is in offline mode.
 */
export const saveOfflineModeStatus = async (isOffline) => {
    try {
        await AsyncStorage.setItem(OFFLINE_MODE_KEY, JSON.stringify(isOffline));
    } catch (error) {
        console.error('[StorageUtils] Error saving offline mode status:', error);
    }
};

/**
 * Loads the offline mode status from AsyncStorage.
 * @returns {Promise<boolean>} The offline mode status (defaults to false).
 */
export const loadOfflineModeStatus = async () => {
    try {
        const status = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
        return status !== null ? JSON.parse(status) : false;
    } catch (error) {
        console.error('[StorageUtils] Error loading offline mode status:', error);
        return false;
    }
};

/**
 * Saves the timestamp of the last offline data save.
 * @param {number} timestamp - The timestamp (Date.now()).
 */
export const saveLastOfflineSaveTimestamp = async (timestamp) => {
    try {
        await AsyncStorage.setItem(LAST_OFFLINE_SAVE_KEY, String(timestamp));
    } catch (error) {
        console.error('[StorageUtils] Error saving last offline save timestamp:', error);
    }
};

/**
 * Loads the timestamp of the last offline data save.
 * @returns {Promise<number|null>} The timestamp, or null if not set.
 */
export const loadLastOfflineSaveTimestamp = async () => {
    try {
        const timestamp = await AsyncStorage.getItem(LAST_OFFLINE_SAVE_KEY);
        return timestamp !== null ? parseInt(timestamp, 10) : null;
    } catch (error) {
        console.error('[StorageUtils] Error loading last offline save timestamp:', error);
        return null;
    }
}; 