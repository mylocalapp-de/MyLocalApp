# Push Notifications - Technische Dokumentation

Diese Dokumentation beschreibt die vollständige Push-Notification-Architektur der MyLocalApp React Native App.

---

## Inhaltsverzeichnis

1. [Architektur-Übersicht](#architektur-übersicht)
2. [Client-Side Implementation](#client-side-implementation)
3. [Token-Management](#token-management)
4. [Deep-Link Navigation](#deep-link-navigation)
5. [Badge-Management](#badge-management)
6. [Backend-Integration](#backend-integration)
7. [Notification-Typen](#notification-typen)
8. [Datenbank-Schema](#datenbank-schema)
9. [Troubleshooting](#troubleshooting)

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REACT NATIVE APP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. App startet → registerForPushNotificationsAsync()                       │
│           ↓                                                                 │
│  2. Permission anfragen (iOS/Android)                                       │
│           ↓                                                                 │
│  3. Expo Push Token abrufen                                                 │
│           ↓                                                                 │
│  4. Token an AuthContext übergeben                                          │
│           ↓                                                                 │
│  5. Token in Supabase `push_tokens` Tabelle speichern (mit user_id)         │
│           ↓                                                                 │
│  6. Notification Listener registrieren                                      │
│      - Foreground: addNotificationReceivedListener                          │
│      - Tap: addNotificationResponseReceivedListener                         │
│      - Cold Start: getLastNotificationResponseAsync                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE DATABASE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  User-Aktion (neue DM, neuer Kommentar)                                     │
│           ↓                                                                 │
│  INSERT Trigger feuert                                                      │
│           ↓                                                                 │
│  Trigger-Funktion holt Push-Token aus `push_tokens`                         │
│           ↓                                                                 │
│  HTTP POST via pg_net Extension zum Backend                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ADMIN BACKEND                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  API Endpoint empfängt Request                                              │
│           ↓                                                                 │
│  Validierung (Token-Format, Payload)                                        │
│           ↓                                                                 │
│  Expo Push API aufrufen                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPO PUSH SERVICE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Notification an APNs (iOS) / FCM (Android) weiterleiten                    │
│           ↓                                                                 │
│  Notification erscheint auf dem Gerät des Users                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Client-Side Implementation

### Dateistruktur

```
src/
├── App.js                          # Haupt-Notification-Setup
├── navigation/
│   ├── AppNavigator.js             # NavigationContainer mit ref
│   └── navigationRef.js            # Programmatische Navigation
└── context/
    └── AuthContext.js              # Token-Persistierung in Supabase
```

### App.js - Notification Handler

```javascript
// Konfiguration des Notification-Handlers
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // Notification im Vordergrund anzeigen
    shouldPlaySound: true,   // Sound abspielen
    shouldSetBadge: true,    // Badge aktualisieren
  }),
});
```

### Token-Registrierung

```javascript
async function registerForPushNotificationsAsync() {
  // 1. Android: Notification Channel erstellen
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // 2. Permission prüfen/anfragen
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // 3. Expo Push Token abrufen
  if (finalStatus === 'granted' && Device.isDevice) {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token; // Format: "ExponentPushToken[xxxxxx]"
  }
  
  return null;
}
```

---

## Token-Management

### AuthContext.js - Token-Persistierung

Der Push-Token wird in der Supabase `push_tokens` Tabelle gespeichert und mit der User-ID verknüpft:

```javascript
const registerOrUpdatePushToken = useCallback(async (token, userId) => {
  if (!token) return;

  const upsertData = [{ expo_push_token: token, user_id: userId }];

  await supabase
    .from('push_tokens')
    .upsert(upsertData, { 
      onConflict: 'expo_push_token', 
      returning: 'minimal' 
    });
}, []);
```

### Token-Lifecycle

| Event | Aktion |
|-------|--------|
| App-Start | Token registrieren (anonym oder mit User-ID) |
| User Login | Token mit User-ID verknüpfen |
| User Logout | Token auf `user_id = null` setzen |
| Token-Refresh | Automatisch via Expo SDK |

---

## Deep-Link Navigation

### navigationRef.js

Ermöglicht Navigation von außerhalb der React-Komponenten:

```javascript
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    // Retry nach kurzer Verzögerung
    setTimeout(() => navigate(name, params), 100);
  }
}
```

### Navigation Handler

```javascript
const handleNotificationNavigation = useCallback((data) => {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'new_dm':
      navigate('DirectMessageDetail', {
        conversationId: data.conversationId,
        recipientId: data.senderId || null,
      });
      break;

    case 'article_comment':
      navigate('ArticleDetail', {
        articleId: data.articleId,
      });
      break;

    case 'new_chat_message':
      navigate('ChatDetail', {
        chatGroup: { id: data.chatGroupId, name: data.chatGroupName || 'Chat' },
      });
      break;

    case 'new_event':
      navigate('EventDetail', {
        eventId: data.eventId,
      });
      break;
  }
}, []);
```

### Notification Listener

```javascript
useEffect(() => {
  // Foreground Notifications
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received in foreground:', notification);
  });

  // Notification Tap (App war im Hintergrund)
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    handleNotificationNavigation(data);
  });

  // Cold Start (App war geschlossen)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data;
      setTimeout(() => handleNotificationNavigation(data), 500);
    }
  });
}, []);
```

---

## Badge-Management

### Badge-Funktionen

```javascript
// Badge laden (beim App-Start)
const loadBadgeCount = async () => {
  const stored = await AsyncStorage.getItem('app_badge_count');
  const count = stored ? parseInt(stored, 10) : 0;
  await Notifications.setBadgeCountAsync(count);
};

// Badge inkrementieren (bei neuer Notification)
const incrementBadge = async () => {
  const newCount = badgeCount + 1;
  await AsyncStorage.setItem('app_badge_count', String(newCount));
  await Notifications.setBadgeCountAsync(newCount);
};

// Badge löschen
const clearBadge = async () => {
  await AsyncStorage.setItem('app_badge_count', '0');
  await Notifications.setBadgeCountAsync(0);
};
```

### Badge-Verhalten

| Szenario | Badge-Aktion |
|----------|--------------|
| Notification im Hintergrund (iOS) | Automatisch durch `badge` Feld vom Backend |
| Notification im Vordergrund (Android) | Manuell inkrementieren |
| Notification angetippt | Badge löschen |
| App in Vordergrund gebracht | Badge löschen |
| App geöffnet (Cold Start) | Badge löschen |

---

## Backend-Integration

### Notification Payload Format

Das Backend sendet Notifications über die Expo Push API mit folgendem Format:

#### DM Notification

```javascript
{
  to: "ExponentPushToken[xxxxxx]",
  sound: 'default',
  title: "Neue Nachricht von Max Mustermann",
  body: "Hey, wie geht's?",
  badge: 1,
  data: {
    conversationId: "uuid-der-konversation",
    senderId: "uuid-des-senders",
    type: "new_dm"
  }
}
```

#### Article Comment Notification

```javascript
{
  to: "ExponentPushToken[xxxxxx]",
  sound: 'default',
  title: "Neuer Kommentar von Lisa Schmidt",
  body: "\"Dein Artikel-Titel\": Toller Beitrag!",
  badge: 1,
  data: {
    articleId: "uuid-des-artikels",
    commentId: "uuid-des-kommentars",
    commenterId: "uuid-des-kommentierenden",
    type: "article_comment"
  }
}
```

### API Endpoints

| Endpoint | Beschreibung |
|----------|--------------|
| `POST /api/internal/notify-dm` | Sendet DM-Benachrichtigung |
| `POST /api/internal/notify-article-comment` | Sendet Kommentar-Benachrichtigung |

---

## Notification-Typen

| Type | Screen | Required Params |
|------|--------|-----------------|
| `new_dm` | DirectMessageDetail | `conversationId`, optional: `senderId` |
| `article_comment` | ArticleDetail | `articleId` |
| `new_chat_message` | ChatDetail | `chatGroupId`, optional: `chatGroupName` |
| `new_event` | EventDetail | `eventId` |

---

## Datenbank-Schema

### push_tokens Tabelle

```sql
CREATE TABLE public.push_tokens (
    expo_push_token TEXT NOT NULL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index für schnelle User-Lookups
CREATE INDEX push_tokens_user_id_idx 
ON public.push_tokens (user_id) 
WHERE user_id IS NOT NULL;
```

### RLS Policies

```sql
-- Authentifizierte User können ihren eigenen Token verwalten
CREATE POLICY "Allow users to manage their own token" 
ON public.push_tokens
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Anonyme User können Token ohne user_id erstellen
CREATE POLICY "Allow anonymous insert" 
ON public.push_tokens
FOR INSERT TO anon
WITH CHECK (user_id IS NULL);
```

---

## Troubleshooting

### Häufige Probleme

| Problem | Ursache | Lösung |
|---------|---------|--------|
| Token ist `null` | Simulator/Emulator | Physisches Gerät verwenden |
| Permission denied | User hat abgelehnt | In App-Einstellungen aktivieren |
| Navigation funktioniert nicht | Navigator nicht bereit | Verzögerung einbauen (setTimeout) |
| Badge wird nicht aktualisiert | iOS: Badge nicht im Payload | Backend muss `badge` Feld senden |

### Debug-Logging

```javascript
// In App.js - alle Notifications loggen
Notifications.addNotificationReceivedListener((notification) => {
  console.log('=== NOTIFICATION RECEIVED ===');
  console.log('Title:', notification.request.content.title);
  console.log('Body:', notification.request.content.body);
  console.log('Data:', JSON.stringify(notification.request.content.data, null, 2));
});

Notifications.addNotificationResponseReceivedListener((response) => {
  console.log('=== NOTIFICATION TAPPED ===');
  console.log('Data:', JSON.stringify(response.notification.request.content.data, null, 2));
});
```

### Token validieren

```javascript
import { Expo } from 'expo-server-sdk';

// Prüfen ob Token gültig ist
const isValid = Expo.isExpoPushToken(token);
console.log('Token valid:', isValid);
```

---

## Abhängigkeiten

```json
{
  "expo-notifications": "~0.x.x",
  "expo-device": "~x.x.x",
  "@react-navigation/native": "^6.x.x",
  "@react-native-async-storage/async-storage": "^x.x.x"
}
```

---

## Weiterführende Ressourcen

- [Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)
- [Expo Notification API Reference](https://docs.expo.dev/versions/latest/sdk/notifications/)
