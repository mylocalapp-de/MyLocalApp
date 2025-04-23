# App Offline Mode Documentation

## 1. Overview

The application provides an offline mode ("Offline Modus") allowing users to access certain pre-saved content when they lack an internet connection. This mode is primarily read-only, with most interactive features disabled. Users can manually trigger the saving of data for offline use when connected.

## 2. Core Implementation (`NetworkContext.js`)

The central logic for managing network state and offline mode resides in `NetworkContext.js`.

*   **Network Monitoring:** Uses `@react-native-community/netinfo` to monitor the device's network connection status (`isConnected` state: `true` if connected and internet is reachable).
*   **Offline Mode State:** Maintains a boolean state `isOfflineMode` to track if the user has explicitly chosen to be in offline mode. This state is persisted using `storageUtils.js` (`saveOfflineModeStatus`, `loadOfflineModeStatus`).
*   **User Prompting:**
    *   If the app detects no connection on the initial check (`initialCheckDone === false`), it prompts the user via an `Alert` ("Keine Internetverbindung") asking if they want to switch to "Offline Modus".
    *   If the connection drops *after* the initial check and the user is *not* currently in offline mode, the same prompt is shown.
*   **Toggling Mode:**
    *   Users can enter offline mode via the network loss prompt.
    *   Users can manually exit offline mode using the "Offline verlassen" button in the `ScreenHeader`.
    *   The `toggleOfflineMode` function updates the `isOfflineMode` state and persists it.
*   **Data Saving (`saveDataForOffline`):**
    *   Can only be triggered manually from the `ProfileScreen` when the user is connected (`isConnected === true`).
    *   A loading state (`isSavingData`) prevents concurrent saves.
    *   Fetches the following data concurrently from Supabase using `Promise.allSettled`:
        *   `article_listings`
        *   `article_filters`
        *   `event_listings`
        *   `chat_group_listings` (excluding type 'bot')
        *   *Note:* `event_categories` are also saved, likely fetched separately or within `fetchEventData` in `CalendarScreen` before being potentially saved via `loadOfflineData` (which seems misused for saving here).
    *   Saves the fetched data to local storage using `saveOfflineData` (from `storageUtils.js`), keyed by type (e.g., 'articles', 'events').
    *   Updates and persists the `lastOfflineSaveTimestamp`.
*   **Data Loading:** Uses `loadOfflineData` (from `storageUtils.js`) within specific screens (`ArticleDetailScreen`, `CalendarScreen`) to retrieve previously saved data when `isOfflineMode` is true.
*   **Timestamp:** Tracks the last successful data save time (`lastOfflineSaveTimestamp`), persisted via `storageUtils.js`.

## 3. UI Indicators

*   **`ScreenHeader.js`:** Displays an "Offline verlassen" button when `isOfflineMode` is true.
*   **`ProfileScreen.js`:**
    *   Shows the "Zuletzt gespeichert" timestamp.
    *   Disables the "Daten für Offline-Modus speichern" button and shows a warning if `!isConnected`.
    *   Shows a loading indicator (`isSavingData`) on the save button during the process.
*   **Screen-Specific Messages:**
    *   `ChatScreen`: Displays "Chats und Direktnachrichten sind offline nicht verfügbar."
    *   `ArticleDetailScreen`: Shows a warning box: "Vollständiger Artikelinhalt ist im Offline-Modus nicht verfügbar."
    *   Error messages related to missing offline data might appear if `loadOfflineData` fails or returns empty (e.g., "Keine Offline-Events gefunden.").

## 4. Screen-Specific Behavior

*   **`App.js`:** Wraps the entire application in `NetworkProvider`.
*   **`ProfileScreen.js`:**
    *   Allows triggering `saveDataForOffline`.
    *   Displays the last save timestamp.
    *   Does not load any profile-specific data offline. Actions requiring network (profile updates, org management, account deletion, sign out) are implicitly disabled as they don't check for offline mode before making API calls.
*   **`ChatScreen.js`:**
    *   Fetching chat groups and DMs is skipped if `isOfflineMode` is true.
    *   The chat list displays a message indicating chats/DMs are unavailable offline.
    *   The button to create new chats/DMs is hidden.
*   **`ArticleDetailScreen.js`:**
    *   Loads basic article data (title, author, date) from local storage (`loadOfflineData('articles')`) via `loadArticleFromStorage`.
    *   Does **not** load the full HTML `content`. Displays a warning instead.
    *   Disables comments and reactions sections entirely (fetching and display).
    *   Disables the comment input field.
    *   Disables article editing and deletion features.
    *   Disables linking to user/org profiles from the author name.
*   **`CalendarScreen.js`:**
    *   Loads event data from local storage (`loadOfflineData('events')`, potentially `loadOfflineData('event_categories')`) via `loadDataFromStorage`.
    *   Displays events based on the loaded data, including expanding recurring events.
    *   Disables the button to create new events (`handleCreateEvent`).
    *   Does not refresh data on screen focus when offline.
*   **`AuthContext.js`:** No specific offline handling. Assumes network connectivity for all authentication, profile, and organization-related actions performed within this context.
*   **`AppNavigator.js` / `HomeScreen.js` / `MapScreen.js`:** No specific offline logic detected in the provided `AppNavigator`. Behavior for `HomeScreen` (likely reads articles offline similar to `ArticleDetailScreen`) and `MapScreen` (likely requires network) is inferred.

## 5. Data Storage (`storageUtils.js` - Inferred)

Utility functions (likely interacting with `AsyncStorage`) are used to persist offline data and state:

*   `saveOfflineData(key, data)`
*   `loadOfflineData(key)`
*   `saveOfflineModeStatus(status)`
*   `loadOfflineModeStatus()`
*   `saveLastOfflineSaveTimestamp(timestamp)`
*   `loadLastOfflineSaveTimestamp()`

## 6. Limitations & Unavailable Features Offline

The following features are **unavailable** when the app is in offline mode or the device has no connection (unless explicitly entered offline mode):

*   **Chat & Messaging:** Viewing chat lists, chat details, DMs, Dorfbot, sending messages.
*   **Articles:**
    *   Viewing full article content (HTML).
    *   Viewing comments and reactions.
    *   Adding comments or reactions.
    *   Creating, editing, or deleting articles.
*   **Events:**
    *   Creating or editing events.
    *   (Viewing event details might work if basic data is saved, but interactions likely disabled - Needs confirmation).
*   **Profile & Account:**
    *   Creating a permanent account or upgrading a temporary one.
    *   Signing in / Signing out (Sign out might clear local state but relies on network call).
    *   Updating profile information (display name, preferences, about me, email, password, profile picture).
    *   Deleting the user account.
*   **Organizations:**
    *   Creating, joining, leaving, or deleting organizations.
    *   Viewing/managing members (other than potentially cached list in `ProfileScreen`).
    *   Switching organization context (relies on fetching data).
    *   Updating organization details (name, logo).
*   **Map:** (Assumed) Viewing map data, creating POIs.
*   **Real-time Updates:** All data displayed is only as current as the last successful manual save via the `ProfileScreen`. 