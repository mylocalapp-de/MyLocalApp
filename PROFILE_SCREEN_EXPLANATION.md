# ProfileScreen.js Overview

`ProfileScreen.js` is a large, self‑contained React Native screen component responsible for displaying and managing:

- User profile (display name, preferences, avatar, **Über Mich** section)
- Account lifecycle (temporary vs full account, upgrade, deletion)
- Organization context (switching, creating, joining, editing, managing members, logos)
- Offline mode (saving/reloading data)
- Account settings modals (email & password changes)

---

## 1. Imports & Context Hooks

```js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert, ActivityIndicator, Clipboard, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useNetwork } from '../context/NetworkContext';
import { supabase } from '../lib/supabase';
```

- **useAuth**: Auth state (user, profile, preferences, session) and actions (signIn, signOut, create/upgrade account, updateProfile, updateProfilePicture, deleteAccount).
- **useOrganization**: Organization context (activeOrg, members, create/join/delete org, update details & logo, transfer admin, leave org).
- **useNetwork**: Offline connectivity management (isConnected, saveDataForOffline).

---

## 2. State Variables

### Global UI State
- Loading flags for auth (`authLoading`), org context, image uploads (`uploadingImage`, `loadingProfilePicture`, `loadingOrgLogo`), modals, form errors.
- Flags for temporary vs full account flow (`isTemporaryAccount`, `isMakingPermanent`).

### Profile & Preferences
- `editDisplayName`, `editPreferences`, `editAboutMe` for profile editing.
- `showProfileEditModal`, and equivalent for **Über Mich**.

### Organization Management
- `organizationMembers`, `isFetchingMembers`, `orgMgmtError`, `memberManagementLoading`.
- `editOrgName`, `editOrgAboutMe`, `showOrgEditModal`, `orgEditError`.

### Account Settings & Creation
- Modals and inputs for email/password change, account creation, and account deletion.

---

## 3. Effects & Data Loading

- **reloadMembers**: Fetch org members when active organization changes.
- **useEffect** hooks track auth & org context loading to show a full‐screen spinner when needed.

---

## 4. Handlers & Actions

### Profile Handlers
- `handleOpenProfileEdit` / `handleSaveProfile`: Edit display name, preferences, and **Über Mich**.
- `handleSelectProfilePicture`: Pick & upload avatar via `updateProfilePicture` (AuthContext).
- `handleOpenAboutMeModal` / `handleSaveAboutMe`: Separate modal for editing **Über Mich**.

### Account Lifecycle
- `handleOpenCreateAccountModal` / `handleCreateAccount`: Upgrade temporary account to full via `upgradeToFullAccount`.
- `handleOpenAccountSettings` / `handleUpdateEmail` / `handleUpdatePassword`: Change email or password. Supports an extended flow for making temporary accounts permanent.
- `handleOpenMakePermanentSettings` / `handleMakePermanent`: Shortcut to secure a temporary account by setting a password and (optionally) email.
- `handleDeleteAccount`: Calls `deleteCurrentUserAccount` then sign out.

### Organization Handlers
- `handleOpenOrgEdit` / `handleSaveOrgDetails`: Edit organization name & **about_me** via `updateOrganizationDetails`.
- `handleSelectOrgLogo`: Pick & upload org logo via `updateOrganizationLogo`.
- `handleSwitchToOrg`, `handleSwitchToPersonal`: Change active context.
- `handleLeaveOrg`, `handleDeleteOrg`, `handleRemoveMember`, `handleMakeAdmin`: Member & org lifecycle actions.
- `handleReloadOrgContext`: Re-trigger fetch for active org.

### Miscellaneous
- Manual profile/org refresh buttons, offline save button, and sign out / app reset via `handleSignOut`.

---

## 5. Rendering Structure

1. **Header**: Avatar / logo, user or org name, role badge, action icons (edit, refresh).
2. **Main Content** (conditionally):
   - **Organization active**: Org details card (invite code, members list, leave/delete actions).
   - **Personal context**:
     - New account prompt for local users.
     - **Make permanent** card for temporary accounts.
     - Personal profile card (interests, **Über Mich**).
     - Organization list & switcher.
     - Account settings card.
     - Offline mode card.
3. **Bottom Buttons**: Sign out / app reset, and delete account for full users.
4. **Modals**: Overlaid forms for create account, edit profile, edit **Über Mich**, account settings, org edit, and make permanent flows.

---

## 6. Styles

- Defined via `StyleSheet.create`, using consistent spacing, colors, and responsive units.
- Reusable button, card, modal, and avatar styles.

---

### Key Takeaways

- **Dual Context**: Manages both personal & organization flows within one screen.
- **Complex State**: Numerous flags & modal states; separation of concerns (Auth vs Org vs Network).
- **Rich Feature Set**: Handles account onboarding (temp → full), offline support, profile customization, org management, and image upload.
- **Responsiveness**: Conditional rendering simplifies the UX based on context and user role.

This summary provides an at‑a‑glance view of how `ProfileScreen.js` orchestrates user and organization workflows, balancing form complexity with a modular handler approach. 