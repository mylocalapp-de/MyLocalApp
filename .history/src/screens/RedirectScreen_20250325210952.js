import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

const RedirectScreen = () => {
  const { refreshAuthState } = useAuth();
  
  useEffect(() => {
    // Force refresh auth state when this screen is shown
    console.log('RedirectScreen: Refreshing auth state');
    refreshAuthState();
  }, []);
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' }}>
      <ActivityIndicator size="large" color="#4285F4" />
    </View>
  );
};

export default RedirectScreen; 