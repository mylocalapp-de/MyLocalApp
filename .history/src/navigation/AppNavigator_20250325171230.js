import React from 'react';
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

const Tab = createBottomTabNavigator();
const ChatStack = createStackNavigator();

// Chat stack navigator
const ChatStackNavigator = () => {
  return (
    <ChatStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ChatStack.Screen name="ChatList" component={ChatScreen} />
    </ChatStack.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
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
          component={HomeScreen} 
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
    </NavigationContainer>
  );
};

export default AppNavigator; 