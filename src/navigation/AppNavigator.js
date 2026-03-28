import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';
import { navigationRef } from './navigationRef';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/Profile';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import DorfbotScreen from '../screens/DorfbotScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import ArticleFormScreen from '../screens/ArticleFormScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import ManageBroadcastGroupsScreen from '../screens/CreateBroadcastGroupScreen';
import EventFormScreen from '../screens/EventFormScreen';
import OrganizationSetupScreen from '../screens/OrganizationSetupScreen';
import CreatePoiScreen from '../screens/CreatePoiScreen';
import DirectMessagesScreen from '../screens/DirectMessagesScreen';
import NewDirectMessageScreen from '../screens/NewDirectMessageScreen';
import DirectMessageDetailScreen from '../screens/DirectMessageDetailScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerificationScreen from '../screens/VerificationScreen';
import UserProfileViewScreen from '../screens/UserProfileViewScreen';
import OrganizationProfileViewScreen from '../screens/OrganizationProfileViewScreen';
import EventArticleFormScreen from '../screens/EventArticleFormScreen';

const Tab = createBottomTabNavigator();
const ChatStack = createStackNavigator();
const HomeStack = createStackNavigator();
const CalendarStack = createStackNavigator();
const RootStack = createStackNavigator();
const AuthStack = createStackNavigator();

// Helper to interpret boolean-like env values
const isTrue = (val) => val === true || val === 'true' || val === '1';

// Fallback flag (used until remote config is available)
const fallbackDisableMap = isTrue(process.env.EXPO_PUBLIC_DISABLE_MAP) || isTrue(Constants?.expoConfig?.extra?.disableMap);

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
      <HomeStack.Screen name="CreateArticle" component={ArticleFormScreen} />
      <HomeStack.Screen name="EditArticle" component={ArticleFormScreen} />
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
      <CalendarStack.Screen name="CreateEvent" component={EventFormScreen} />
      <CalendarStack.Screen name="EditEvent" component={EventFormScreen} />
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
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
      />
    </AuthStack.Navigator>
  );
};

// Main tab navigator
const TabNavigator = () => {
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const disableMap = appConfigLoading ? fallbackDisableMap : isTrue(appConfig.EXPO_PUBLIC_DISABLE_MAP);
  const insets = useSafeAreaInsets();

  // Compute additional bottom space for Android devices where the system nav bar/gesture pill
  // can visually overlap or push the tab bar too low (e.g., Samsung Galaxy A15, newer Android).
  const androidApiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0;
  const isSamsung = Platform.OS === 'android' && (
    (Device.brand?.toLowerCase?.() === 'samsung') ||
    (Device.manufacturer?.toLowerCase?.() === 'samsung')
  );
  const isGalaxyA15 = Platform.OS === 'android' && /a15/i.test(Device.modelName ?? '');

  let extraAndroidBottom = 0;
  if (Platform.OS === 'android') {
    if (isSamsung && (isGalaxyA15 || androidApiLevel >= 31)) {
      // Slightly more space on Samsung devices and Android 12+
      extraAndroidBottom = 8;
    } else if (androidApiLevel >= 29) {
      // Small bump on Android 10+
      extraAndroidBottom = 4;
    }
  }

  const basePaddingBottom = Platform.OS === 'ios' ? 25 : 10;
  const computedPaddingBottom = Math.max(
    basePaddingBottom,
    (insets.bottom || 0) + (Platform.OS === 'ios' ? 16 : 8) + extraAndroidBottom
  );
  const baseHeight = Platform.OS === 'ios' ? 85 : 65;
  const computedHeight = baseHeight + (computedPaddingBottom - basePaddingBottom);

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
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: computedHeight,
          paddingTop: 5,
          paddingBottom: computedPaddingBottom,
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
      {!disableMap && (
        <Tab.Screen 
          name="Map" 
          component={MapScreen} 
          options={{ tabBarLabel: 'Karte' }}
        />
      )}
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { loading, hasCompletedOnboarding, user, profile } = useAuth();
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const [authChecked, setAuthChecked] = React.useState(false);
  const isTrue = (val) => val === true || val === 'true' || val === '1';
  const disableVerifyFallback = isTrue(process.env.EXPO_PUBLIC_DISABLE_VERIFY) || isTrue(Constants?.expoConfig?.extra?.disableVerify);
  const disableVerify = appConfigLoading ? disableVerifyFallback : isTrue(appConfig.EXPO_PUBLIC_DISABLE_VERIFY);
  
  // Force a re-render when auth state changes
  React.useEffect(() => {
    // console.log('Navigation: Auth state changed. User:', user ? 'Logged in' : 'Not logged in');
    // console.log('Navigation: hasCompletedOnboarding:', hasCompletedOnboarding);
    setAuthChecked(true);
  }, [user, hasCompletedOnboarding]);

  // Show a loading screen if we're still checking auth state
  if (loading) {
    return null; // You could add a loading spinner here
  }

  const shouldShowVerification = !!user && !!profile && (profile.is_verified === false) && !disableVerify;

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {hasCompletedOnboarding ? (
          shouldShowVerification ? (
            <RootStack.Screen
              name="Verify"
              component={VerificationScreen}
              options={{ gestureEnabled: false }}
            />
          ) : (
            <RootStack.Screen 
              name="MainApp" 
              component={TabNavigator} 
            />
          )
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
        />
        <RootStack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="CreateEvent" component={EventFormScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen name="EditEvent" component={EventFormScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen name="CreateEventArticle" component={EventArticleFormScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen name="EditEventArticle" component={EventArticleFormScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen name="CreatePoi" component={CreatePoiScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <RootStack.Screen 
            name="ArticleDetail" 
            component={ArticleDetailScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="CreateArticle" 
            component={ArticleFormScreen} 
            options={{ headerShown: false, presentation: 'modal' }} 
        />
        <RootStack.Screen 
            name="EditArticle" 
            component={ArticleFormScreen} 
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
