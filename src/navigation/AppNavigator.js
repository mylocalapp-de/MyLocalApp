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
import EditArticleScreen from '../screens/EditArticleScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import ManageBroadcastGroupsScreen from '../screens/CreateBroadcastGroupScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import EditEventScreen from '../screens/EditEventScreen';
import OrganizationSetupScreen from '../screens/OrganizationSetupScreen';
import CreatePoiScreen from '../screens/CreatePoiScreen';
import DirectMessagesScreen from '../screens/DirectMessagesScreen';
import NewDirectMessageScreen from '../screens/NewDirectMessageScreen';
import DirectMessageDetailScreen from '../screens/DirectMessageDetailScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import UserProfileViewScreen from '../screens/UserProfileViewScreen';
import OrganizationProfileViewScreen from '../screens/OrganizationProfileViewScreen';

const Tab = createBottomTabNavigator();
const ChatStack = createStackNavigator();
const HomeStack = createStackNavigator();
const CalendarStack = createStackNavigator();
const RootStack = createStackNavigator();
const AuthStack = createStackNavigator();

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
      <ChatStack.Screen name="ManageBroadcastGroups" component={ManageBroadcastGroupsScreen} />
      <ChatStack.Screen name="DirectMessages" component={DirectMessagesScreen} />
      <ChatStack.Screen name="NewDirectMessage" component={NewDirectMessageScreen} />
      <ChatStack.Screen name="DirectMessageDetail" component={DirectMessageDetailScreen} />
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
      <HomeStack.Screen name="EditArticle" component={EditArticleScreen} />
    </HomeStack.Navigator>
  );
};

// Calendar stack navigator
const CalendarStackNavigator = () => {
  return (
    <CalendarStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <CalendarStack.Screen name="CalendarList" component={CalendarScreen} />
      <CalendarStack.Screen name="EventDetail" component={EventDetailScreen} />
      <CalendarStack.Screen name="CreateEvent" component={CreateEventScreen} />
      <CalendarStack.Screen name="EditEvent" component={EditEventScreen} />
    </CalendarStack.Navigator>
  );
};

// Auth stack navigator for Welcome/Onboarding flow
const AuthStackNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen 
        name="Welcome"
        component={WelcomeScreen}
        options={{ gestureEnabled: false }} 
      />
      <AuthStack.Screen 
        name="Onboarding"
        component={OnboardingScreen}
      />
    </AuthStack.Navigator>
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
        component={CalendarStackNavigator} 
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
            name="AuthFlow" 
            component={AuthStackNavigator}
            options={{ gestureEnabled: false }}
          />
        )}
        <RootStack.Screen 
            name="OrganizationSetup" 
            component={OrganizationSetupScreen}
            options={{ presentation: 'modal' }}
        />
        <RootStack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="CreateEvent" component={CreateEventScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen name="EditEvent" component={EditEventScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen name="CreatePoi" component={CreatePoiScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen 
            name="ArticleDetail" 
            component={ArticleDetailScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="CreateArticle" 
            component={CreateArticleScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="EditArticle" 
            component={EditArticleScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="ChatDetail" 
            component={ChatDetailScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="DirectMessages" 
            component={DirectMessagesScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="NewDirectMessage" 
            component={NewDirectMessageScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="DirectMessageDetail" 
            component={DirectMessageDetailScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="UserProfileView" 
            component={UserProfileViewScreen} 
            options={{ headerShown: false }} 
        />
        <RootStack.Screen 
            name="OrganizationProfileView" 
            component={OrganizationProfileViewScreen} 
            options={{ headerShown: false }} 
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 