import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { OrganizationProvider } from './src/context/OrganizationContext';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OrganizationProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </OrganizationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
} 