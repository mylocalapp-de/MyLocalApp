import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { OrganizationProvider } from './src/context/OrganizationContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <OrganizationProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </OrganizationProvider>
    </SafeAreaProvider>
  );
} 