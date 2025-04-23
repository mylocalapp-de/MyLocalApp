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

- **Simplified Onboarding:**
  - Clicking "Neu hier?" on the Welcome Screen navigates to an onboarding screen.
  - Onboarding requires a display name and offers an optional email address.
- **Temporary Accounts:**
  - Completing onboarding creates a full Supabase Auth account immediately, but marked as temporary (`is_temporary: true` in `profiles` table).
  - If no email is provided, a placeholder email (`username.uuid@temp.mylocalapp.de`) is generated.
  - A random, secure password is generated (user doesn't know it).
  - All preferences are pre-selected by default for temporary accounts.
- **Account Permanence:**
  - Temporary users can later make their account permanent via the Profile screen by setting a real email (if they used a placeholder) and a chosen password.
- **Robust Error Handling:**
  - Validation for display name and optional email during onboarding.
  - Handles Supabase errors during temporary account creation (e.g., email conflicts).
- **Account Management:**
  - All users (temporary and permanent) can edit their display name and preferences.
  - Only permanent users can change their email or password.
  - Secure sign-out is available for all.
  - Account deletion is available (requires transferring admin rights first if applicable).
- **Data Persistence:**
  - User data (profile, preferences, temporary status) stored in Supabase.
  - AsyncStorage primarily used for the `hasCompletedOnboarding` flag and active organization ID.
- **Organization Mode:**
  - Requires a permanent (non-temporary) account to create/join/manage organizations.

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

Initialize your Supabase database with the SQL script provided in `supabase/init_new.sql`.
This script sets up all necessary tables, views, functions (including `delete_user_account`), and RLS policies.

## Project Structure

```
/src
  /components       - Reusable components
  /context          - Context providers for state management
    /AuthContext.js - Authentication state management
    /OrganizationContext.js - Active organization state
    /NetworkContext.js - Offline status management
  /screens          - Main screen components
    /WelcomeScreen.js - Onboarding and preferences selection
    /DirectMessagesScreen.js - List of direct messages (user & org)
    /NewDirectMessageScreen.js - Screen to start new DMs
    /DirectMessageDetailScreen.js - Screen showing a single DM conversation
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

1.  **Welcome Screen:** User sees "Neu hier?" and "Login mit existierendem Account" options.
2.  **Login:** Existing users log in via the login form.
3.  **Onboarding:**
    *   User clicks "Neu hier?", navigates to Onboarding Screen.
    *   Enters display name, optionally provides an email.
    *   Clicks "Account erstellen & Loslegen".
4.  **Temporary Account Creation:**
    *   `createTemporaryAccount` function in `AuthContext` is called.
    *   Supabase account created with provided/generated credentials and `is_temporary: true` metadata.
    *   `handle_new_user` trigger creates the `profiles` entry with `is_temporary=true`.
    *   Auth state changes, `AppNavigator` detects `user` and `profile`, sets `hasCompletedOnboarding` flag in AsyncStorage, and navigates to the main app.
5.  **Using the App:** User interacts with the app using their temporary account (can edit name/prefs, react, comment, etc.).
6.  **Making Account Permanent (Optional):**
    *   User goes to Profile screen and clicks "Passwort festlegen & Sichern".
    *   A dedicated modal appears where the password can be set; the email is prefilled and not editable.
    *   Upon confirmation, the `updatePassword` function marks the account as permanent (`is_temporary=false`).

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
 
## Code Review Findings

Below is a summary of observations and recommendations based on a code review of the React Native codebase:

### Project Structure
- The `src` folder is well-organized into `components`, `context`, `navigation`, `screens`, and `utils`, but many screens are large and could be further broken down into smaller, reusable components.
- The repository includes generated build artifacts (`dist/`, `android/`, `ios/`) and backup files (`app.json.bak`, `package.json.sha`) that bloat the repository. Consider adding these to `.gitignore` and removing them from version control.

### Tech Stack & Tooling
- The code is written in JavaScript, though `tsconfig.json` and `typescript` are present. Migrating to TypeScript would improve type safety and maintainability.
- There is no ESLint or Prettier configuration. Adding linting and formatting tools will enforce consistent code style and catch errors early.
- No CI/CD setup is provided. Integrating automated builds, tests, and linting (e.g., via GitHub Actions) would improve code quality and deployment reliability.

### State Management & Data Fetching
- Context providers (`AuthContext`, `NetworkContext`, `OrganizationContext`) contain complex logic and multiple state flags. Consider extracting custom hooks or adopting a data-fetching library like React Query to simplify and centralize loading/error states.
- Repetitive Supabase queries and error handling could be abstracted into a service layer to reduce duplication.

### Code Quality & Maintenance
- Screens and providers include extensive `console.log` statements. Remove or gate logs behind a debug flag for production builds.
- There is no automated testing in place. Adding unit tests for utility functions, context logic, and key components is highly recommended.
- Forms and navigation props lack PropTypes or TypeScript interfaces for validation. This can lead to runtime errors if parameters or props change.

### Performance & Offline Mode
- The offline data strategy uses `AsyncStorage` for large datasets, which can be slow. Consider using a more robust local database (e.g., SQLite or Realm) for offline caching.
- The `saveDataForOffline` function performs multiple large network requests in parallel; ensure the UI provides adequate progress feedback and handles cancellation gracefully.

### Documentation & Environment
- There is no example or template `.env.example` file for environment variables. Adding one will clarify required keys and formats.
- The README could document coding conventions, branching strategy, and commit message guidelines to onboard new contributors more smoothly.

---

These findings are intended to guide improvements in code quality, maintainability, and developer experience. Please review and prioritize changes according to project goals and release timelines.