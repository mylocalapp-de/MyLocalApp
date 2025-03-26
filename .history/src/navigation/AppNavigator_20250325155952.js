import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

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
            height: 60,
            paddingTop: 5,
            paddingBottom: 10,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#f1f1f1',
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
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
          component={ChatScreen} 
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