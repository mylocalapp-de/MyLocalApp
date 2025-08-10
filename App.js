import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AppConfigProvider } from './src/context/AppConfigContext';
import { OrganizationProvider } from './src/context/OrganizationContext';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notifications handler (optional but recommended)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
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
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // Listener for received notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notification received:', notification);
    });

    // Listener for user interaction with notifications (tapped)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      // You can navigate based on the notification content here
      // e.g., response.notification.request.content.data
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
  }, []);

  return (
    <SafeAreaProvider>
      <AppConfigProvider>
        <AuthProvider expoPushToken={expoPushToken}>
          <OrganizationProvider>
            <NetworkProvider>
              <StatusBar style="auto" translucent backgroundColor="transparent" />
              <AppNavigator />
            </NetworkProvider>
          </OrganizationProvider>
        </AuthProvider>
      </AppConfigProvider>
    </SafeAreaProvider>
  );
} 