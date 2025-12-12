import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogBox, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AppConfigProvider } from './src/context/AppConfigContext';
import { OrganizationProvider } from './src/context/OrganizationContext';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { navigate } from './src/navigation/navigationRef';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for badge count
const BADGE_COUNT_KEY = 'app_badge_count';

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Function to register for push notifications
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      // Consider showing an alert or explanation to the user
      console.log('Failed to get push token for push notification! Status:', finalStatus);
      // alert('Failed to get push token for push notification!');
      return null; // Return null if permission is not granted
    }
    // Learn more about projectId: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    // Note: you must have the projectId correctly set in your app.json / app.config.js
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.error("Error getting Expo push token:", e);
      // alert('Error getting push token. Ensure projectId is set.');
      return null;
    }
  } else {
    // alert('Must use physical device for Push Notifications');
    console.log('Push notifications require a physical device. Returning null.');
    return null;
  }

  return token;
}

export default function App() {
  // Suppress non-actionable library warnings from third-party toolbar
  LogBox.ignoreLogs([
    'ToggleIconButton: Support for defaultProps',
    'Warning: ToggleIconButton: Support for defaultProps',
  ]);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const notificationListener = useRef();
  const responseListener = useRef();
  const appState = useRef(AppState.currentState);

  // --- Badge Management Functions ---
  const loadBadgeCount = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(BADGE_COUNT_KEY);
      const count = stored ? parseInt(stored, 10) : 0;
      setBadgeCount(count);
      await Notifications.setBadgeCountAsync(count);
    } catch (e) {
      console.error('Error loading badge count:', e);
    }
  }, []);

  const incrementBadge = useCallback(async () => {
    try {
      const newCount = badgeCount + 1;
      setBadgeCount(newCount);
      await AsyncStorage.setItem(BADGE_COUNT_KEY, String(newCount));
      await Notifications.setBadgeCountAsync(newCount);
      console.log('Badge incremented to:', newCount);
    } catch (e) {
      console.error('Error incrementing badge:', e);
    }
  }, [badgeCount]);

  const clearBadge = useCallback(async () => {
    try {
      setBadgeCount(0);
      await AsyncStorage.setItem(BADGE_COUNT_KEY, '0');
      await Notifications.setBadgeCountAsync(0);
      console.log('Badge cleared');
    } catch (e) {
      console.error('Error clearing badge:', e);
    }
  }, []);

  // --- Deep Link Navigation Handler ---
  const handleNotificationNavigation = useCallback((data) => {
    if (!data || !data.type) {
      console.log('No notification data or type, skipping navigation');
      return;
    }

    console.log('Handling notification navigation:', data);

    switch (data.type) {
      case 'new_dm':
        // Navigate to DirectMessageDetail screen
        if (data.conversationId) {
          console.log('Navigating to DirectMessageDetail with conversationId:', data.conversationId);
          navigate('DirectMessageDetail', {
            conversationId: data.conversationId,
            recipientId: data.senderId || null,
          });
        }
        break;

      case 'article_comment':
        // Navigate to ArticleDetail screen
        if (data.articleId) {
          console.log('Navigating to ArticleDetail with articleId:', data.articleId);
          navigate('ArticleDetail', {
            articleId: data.articleId,
          });
        }
        break;

      case 'new_chat_message':
        // Navigate to ChatDetail screen (for group chats)
        if (data.chatGroupId) {
          console.log('Navigating to ChatDetail with chatGroupId:', data.chatGroupId);
          navigate('ChatDetail', {
            chatGroup: { id: data.chatGroupId, name: data.chatGroupName || 'Chat' },
          });
        }
        break;

      case 'new_event':
        // Navigate to EventDetail screen
        if (data.eventId) {
          console.log('Navigating to EventDetail with eventId:', data.eventId);
          navigate('EventDetail', {
            eventId: data.eventId,
          });
        }
        break;

      default:
        console.log('Unknown notification type:', data.type);
    }
  }, []);

  // --- App State Change Handler (clear badge when app becomes active) ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - clear badge
        console.log('App came to foreground, clearing badge');
        await clearBadge();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [clearBadge]);

  // --- Initial Badge Load ---
  useEffect(() => {
    loadBadgeCount();
  }, [loadBadgeCount]);

  // --- Notification Setup ---
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // Listener for received notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      setNotification(notification);
      console.log('Notification received in foreground:', notification);
      
      // Increment badge when notification received in foreground
      // (Badge is auto-set by iOS when app is in background)
      if (Platform.OS === 'android') {
        await incrementBadge();
      }
    });

    // Listener for user interaction with notifications (tapped)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('Notification tapped:', response);
      
      // Clear badge when user taps notification
      await clearBadge();
      
      // Extract notification data and navigate
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data);
    });

    // Check if app was opened from a notification (cold start)
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (response) {
        console.log('App opened from notification (cold start):', response);
        await clearBadge();
        const data = response.notification.request.content.data;
        // Delay navigation slightly to ensure navigator is ready
        setTimeout(() => handleNotificationNavigation(data), 500);
      }
    });

    // Cleanup listeners
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [handleNotificationNavigation, incrementBadge, clearBadge]);

  return (
    <SafeAreaProvider>
      <AppConfigProvider>
        <AuthProvider expoPushToken={expoPushToken}>
          <OrganizationProvider>
            <NetworkProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </NetworkProvider>
          </OrganizationProvider>
        </AuthProvider>
      </AppConfigProvider>
    </SafeAreaProvider>
  );
} 