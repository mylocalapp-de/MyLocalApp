import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import DorfbotScreen from '../screens/DorfbotScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import CreateArticleScreen from '../screens/CreateArticleScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const Tab = createBottomTabNavigator();
const ChatStack = createStackNavigator();
const HomeStack = createStackNavigator();
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
      <ChatStack.Screen name="Dorfbot" component={DorfbotScreen} />
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
      <HomeStack.Screen name="CreateArticle" component={CreateArticleScreen} />
    </HomeStack.Navigator>
  );
};

// Main tab navigator
const TabNavigator = () => {
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

const AppNavigator = () => {
  const { loading, hasCompletedOnboarding, user } = useAuth();
  const [authChecked, setAuthChecked] = React.useState(false);
  
  // Force a re-render when auth state changes
  React.useEffect(() => {
    console.log('Navigation: Auth state changed. User:', user ? 'Logged in' : 'Not logged in');
    console.log('Navigation: hasCompletedOnboarding:', hasCompletedOnboarding);
    setAuthChecked(true);
  }, [user, hasCompletedOnboarding]);

  // Show a loading screen if we're still checking auth state
  if (loading) {
    return null; // You could add a loading spinner here
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {hasCompletedOnboarding ? (
          <RootStack.Screen 
            name="MainApp" 
            component={TabNavigator} 
          />
        ) : (
          <RootStack.Screen 
            name="Welcome" 
            component={WelcomeScreen} 
            options={{ gestureEnabled: false }}
          />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 