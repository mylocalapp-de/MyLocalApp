import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { CommonActions } from '@react-navigation/native';

const RedirectScreen = ({ navigation }) => {
  const { refreshAuthState } = useAuth();
  
  useEffect(() => {
    const handleRedirect = async () => {
      console.log('RedirectScreen: Starting redirect process');
      
      // First refresh the auth state
      await refreshAuthState();
      
      // Reset the navigation state and redirect to Main
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        })
      );
    };
    
    handleRedirect();
  }, []);
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' }}>
      <ActivityIndicator size="large" color="#4285F4" />
    </View>
  );
};

export default RedirectScreen; 