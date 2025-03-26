import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

// Import auth context
import { useAuth } from '../context/AuthContext';

// Create navigators
const Tab = createBottomTabNavigator();
const ChatStack = createStackNavigator();
const HomeStack = createStackNavigator();
const AuthStack = createStackNavigator();
const RootStack = createStackNavigator();

// Chat stack navigator
const ChatStackNavigator = () => {
  return (
    <ChatStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ChatStack.Screen name="ChatList" component={ChatScreen} />
      <ChatStack.Screen name="ChatDetail" component={ChatDetailScreen} />
    </ChatStack.Navigator>
  );
};

// Home stack navigator
const HomeStackNavigator = () => {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <HomeStack.Screen name="HomeList" component={HomeScreen} />
      <HomeStack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
    </HomeStack.Navigator>
  );
};

// Auth navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
    </AuthStack.Navigator>
  );
};

// Main app tabs
const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: '#888',
        headerShown: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingTop: 5,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f1f1f1',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          paddingBottom: Platform.OS === 'ios' ? 5 : 0,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStackNavigator} 
        options={{ tabBarLabel: 'Start' }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatStackNavigator} 
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen 
        name="Calendar" 
        component={CalendarScreen} 
        options={{ tabBarLabel: 'Kalender' }}
      />
      <Tab.Screen 
        name="Map" 
        component={MapScreen} 
        options={{ tabBarLabel: 'Karte' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

// Root navigator that handles auth flow
const AppNavigator = () => {
  const { user, loading } = useAuth();
  
  // Log whenever user state changes
  useEffect(() => {
    console.log('AppNavigator: Auth state updated -', user ? `User logged in: ${user.id}` : 'No user');
  }, [user]);
  
  // Show loading screen while checking auth state
  if (loading) {
    console.log('AppNavigator: Still loading auth state...');
    return null; // You could add a splash screen here
  }

  console.log('AppNavigator: Rendering with user state:', user ? 'Authenticated' : 'Not authenticated');

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 