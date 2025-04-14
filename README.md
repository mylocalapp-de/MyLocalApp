# MeinHavelaue - Village Community App

A mobile application designed to strengthen community spirit in rural villages by providing hyper-localized information and interactivity.

## Features

- **Home Screen:** Local news and articles scraped from the web by AI tools
  - Article detail view with full content, comments, and emoji reactions
- **Chat Tab:** Open chat groups for community interaction and organization broadcast channels
  - Distinct chat types: open groups (read/write), broadcast channels (read/comment), and AI assistant
  - Support for emoji reactions and comments in broadcast channels
- **Event Calendar:** Interactive calendar highlighting local village events
- **Map:** Interactive map showing important locations in the village
- **Profile:** User settings and organization account options
  - Toggle between regular and organization account modes
  - Organization-specific features when in organization mode
  - Both local (anonymous) and logged-in users can edit their display name and preferences.
  - User account management with Supabase integration
  - Preference-based content personalization
- **Offline Mode:** Save essential data (articles, filters) for viewing when internet connectivity is unavailable. Manage offline data and status via the Profile screen.

## Authentication System

- **One-Click Account Creation:** Users can instantly create a local account with all preferences pre-selected
- **Frictionless Onboarding:** Alternative manual preference selection available for customized experience
- **Progressive Authentication:** 
  - Start with localStorage account (preferences and display name only)
  - Option to upgrade to permanent account with email/password
  - Seamless migration of preferences when upgrading
- **Robust Error Handling:**
  - Comprehensive validation for email and password
  - Specific error messages for common scenarios (invalid email, duplicate accounts, etc.)
  - Fallback mechanisms for account creation and authentication
- **Account Management:**
  - Profile editing with display name and preferences
  - Email and password change functionality
  - Secure sign-out with onboarding reset option
- **Data Persistence:**
  - AsyncStorage for local account data
  - Supabase for permanent account storage
  - Automatic preference sync across devices
  - Local users can modify their display name and preferences directly in the Profile tab.
- **Organization Mode:** Separate functionality for organizations to create content

## Technology Stack

- React Native 0.76.7
- Expo SDK 52
- React Navigation (Stack and Tab Navigators)
- React Native Maps
- Context API for state management
- Supabase for authentication and data storage
- AsyncStorage for local data persistence
- Various UI libraries
- @react-native-community/netinfo for network detection

## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- npm or yarn
- Expo Go app (SDK 52 compatible)
- Supabase account (self-hosted or cloud service)

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/meinhavelaue.git
cd meinhavelaue
```

2. Install dependencies:
```
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with your Supabase credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

4. Start the development server:
```
npm start
```

5. Use the Expo Go app on your mobile device to scan the QR code and test the application.

## Database Setup

The application requires the following tables in your Supabase database:

1. User profiles table (automatically created by Supabase Auth)
2. Article preferences relationship

Initialize your Supabase database with the SQL query provided in the `supabase/init.sql` file.

## Project Structure

```
/src
  /components       - Reusable components
  /context          - Context providers for state management
    /AuthContext.js - Authentication state management
  /screens          - Main screen components
    /WelcomeScreen.js - Onboarding and preferences selection
  /navigation       - Navigation configurations
  /theme            - Styling constants
  /assets           - Images and assets
App.js              - Main application entry point
```

## Important Notes

- Expo SDK 52 requires Hermes JavaScript engine (default in Expo Go)
- This project uses TypeScript for improved developer experience
- **Maps Implementation**: 
  - Apple Maps is used on iOS and Google Maps on Android due to Expo Go limitations
  - In Expo SDK 51+, Google Maps is not supported in Expo Go on iOS devices
  - To use Google Maps on iOS, a development build is required (using `expo prebuild`)
  - The app automatically selects the appropriate map provider based on platform
- **Calendar Implementation**:
  - Calendar uses `react-native-calendars` library with custom styling
  - Date range selection is implemented for event filtering
  - Period marking type is used for better date range visualization
- **Organization Mode**:
  - Toggle organization mode in the Profile screen
  - Create content buttons (blue plus buttons) only appear when in organization mode
  - Organization mode allows creating articles, events, and chat groups
- **Authentication Implementation**:
  - Local storage is used for initial account creation
  - AsyncStorage maintains user preferences and authentication state
  - Progressive authentication flow allows users to start using the app immediately
  - Supabase provides the backend for permanent account storage and authentication

## Authentication Flow

1. First launch: User sees Welcome screen with "Neu hier?" and "Login mit existierendem Account" options
2. New user selects "Neu hier?", chooses content preferences (Kultur, Sport, Verkehr, Politik)
3. Preferences are stored in AsyncStorage and user enters the main app
4. In Profile tab, user can create a permanent account with email and password
5. Account data is securely stored in Supabase for future sessions

## Known Issues

- Using `PROVIDER_GOOGLE` on iOS in Expo Go will cause "Cannot read property 'bubblingEventTypes' of null" error
- If you need Google Maps functionality on iOS, create a development build using:
  ```
  npx expo prebuild
  ```
  This requires proper `ios.bundleIdentifier` configuration in app.json

## Future Enhancements

- Backend integration for dynamic content
- Push notifications for local events
- Enhanced AI integration for content generation
- Location-based services and recommendations
- Persistent storage for organization mode settings 
- Social login options (Google, Apple, etc.)
- Content moderation and reporting system 

# How to build the app?

Just use 
npx expo prebuild
 npx expo run:android --variant release   
 npx expo run:ios