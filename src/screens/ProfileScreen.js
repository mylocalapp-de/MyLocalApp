import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert, ActivityIndicator, Clipboard, Platform, Dimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker'; // Import ImagePicker
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useNetwork } from '../context/NetworkContext';
// supabase import removed — use services instead
import Constants from 'expo-constants'; // Import Constants to access env vars
import { useAppConfig } from '../context/AppConfigContext';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 3% of screen height for Android

// Helper to interpret boolean-like env values
const isTrue = (val) => val === true || val === 'true' || val === '1';

// Feature toggle default fallback using env/extra (for very early render)
const defaultDisablePreferences = isTrue(process.env.EXPO_PUBLIC_DISABLE_PREFERENCES) ||
  isTrue(Constants?.expoConfig?.extra?.disablePreferences);

const ProfileScreen = () => {
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  // Prefer remote config when loaded, fallback otherwise
  const disablePreferences = appConfigLoading
    ? defaultDisablePreferences
    : isTrue(appConfig.EXPO_PUBLIC_DISABLE_PREFERENCES);

  // DEBUG: Log component render and loading state
  // console.log(`ProfileScreen rendering - isAccountSettingsLoading: ${isAccountSettingsLoading}`);

  // Use navigation hook
  const navigation = useNavigation();
  
  // Use the refactored Organization Context for active org state
  const {
    activeOrganizationId, 
    activeOrganization,
    isOrganizationActive, 
    switchOrganizationContext,
    deleteOrganization,
    isLoading: isOrgContextLoading, // Renamed to avoid clash
    // Member management (centralized, race-safe)
    organizationMembers, // From context
    loadingMembers: isFetchingMembers, // From context (aliased)
    membersError: orgMgmtError, // From context (aliased)
    fetchOrganizationMembers,
    removeOrganizationMember,
    transferOrganizationAdmin,
    // Org details management
    updateOrganizationDetails,
    updateOrganizationName,
    updateOrganizationLogo,
    loadingOrgLogo,
  } = useOrganization();

  // **** ADDED LOGGING: Inspect the function from context ****
  // console.log(`%%%% ProfileScreen: Inspected switchOrganizationContext from useOrganization: Type = ${typeof switchOrganizationContext}, Value =`, switchOrganizationContext);

  // Use network context
  const {
    isConnected,
    lastOfflineSaveTimestamp,
    isSavingData,
    saveDataForOffline
  } = useNetwork();

  // Use auth context with Supabase - Remove the functions that were moved
  const { 
    user, 
    profile, // Now includes avatar_url
    preferences,
    displayName,
    userOrganizations,
    // fetchOrganizationMembers, // REMOVE
    leaveOrganization, // Keep: User leaves, part of Auth context
    signOut, 
    upgradeToFullAccount, 
    updateDisplayName, // Keep: Relates to user profile
    updatePreferences, // Keep: Relates to user profile
    updateEmail, // Keep: Relates to user auth
    updatePassword, // Keep: Relates to user auth
    loadUserProfile,
    refreshCurrentUserProfile, // Safe parameterless refresh 
    loading: authLoading,
    // updateOrganizationName, // REMOVE
    createOrganization, // Keep: User creates, part of Auth context
    joinOrganizationByInviteCode, // Keep: User joins, part of Auth context
    deleteCurrentUserAccount,
    updateProfilePicture, // Get the new function
    loadingProfilePicture, // Get the loading state
    updateProfile, // Add this line
  } = useAuth();
  
  // State for account creation modal
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmCreatePassword, setConfirmCreatePassword] = useState('');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createFormError, setCreateFormError] = useState('');
  
  // State for manual refresh (Keep for user profile refresh)
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for profile edit modal (Name and Personal Preferences)
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPreferences, setEditPreferences] = useState([]);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  
  // State for account settings modal (email and password change)
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'password'
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState(''); // Password required for email change
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [accountSettingsError, setAccountSettingsError] = useState('');
  
  // Ensure loading state is properly initialized
  const [isAccountSettingsLoading, setIsAccountSettingsLoading] = useState(false);
  // --- NEW: State to track if the modal is opened for making the account permanent ---
  const [isMakingPermanent, setIsMakingPermanent] = useState(false);
  // State for image picker status
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // State for Organization Management (members now from context)
  const [memberManagementLoading, setMemberManagementLoading] = useState(false);
  // State for Org Edit Modal
  const [showOrgEditModal, setShowOrgEditModal] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [isOrgEditLoading, setIsOrgEditLoading] = useState(false);
  const [orgEditError, setOrgEditError] = useState('');
  const [editAboutMe, setEditAboutMe] = useState(''); // <<< ADD THIS LINE
  // <<< ADD THIS STATE VARIABLE >>>
  const [editOrgAboutMe, setEditOrgAboutMe] = useState('');
  // Open About Me modal
  const [showAboutMeModal, setShowAboutMeModal] = useState(false);
  // Visibility toggle loading
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);


  // Derived state: Check if user has a full Supabase account
  const hasFullAccount = !!user?.id;
  // --- NEW: Derived state to check if the full account is temporary ---
  const isTemporaryAccount = hasFullAccount && profile?.is_temporary === true;

  // Combine loading states
  const overallLoading = authLoading || isOrgContextLoading;

  // Categories for preferences selection
  const categories = [
    { id: 'kultur', name: 'Kultur', icon: 'film-outline' },
    { id: 'sport', name: 'Sport', icon: 'football-outline' },
    { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
    { id: 'politik', name: 'Politik', icon: 'megaphone-outline' },
    { id: 'vereine', name: 'Vereine', icon: 'people-outline' }, // Added Vereine
    { id: 'gemeinde', name: 'Gemeinde', icon: 'business-outline' }, // Added Gemeinde
  ];
  
  // Toggle preference selection in edit modal
  const togglePreference = (id) => {
    setEditPreferences(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };
  
  // Helper function to reload members (delegates to context)
  const reloadMembers = useCallback(() => {
    if (activeOrganizationId) {
      fetchOrganizationMembers(activeOrganizationId);
    }
  }, [activeOrganizationId, fetchOrganizationMembers]);
  // Note: Members are auto-fetched by the context when org becomes active

  // Log relevant context state changes (DEBUG)
  // useEffect(() => {
  //   console.log('ProfileScreen - User state:', user ? `ID: ${user.id}, Email: ${user.email}` : 'No auth user');
  //   console.log('ProfileScreen - Profile state:', profile);
  //   console.log('ProfileScreen - Display Name:', displayName);
  //   console.log('ProfileScreen - Preferences:', preferences);
  //   console.log('ProfileScreen - Has Full Account:', hasFullAccount);
  //   console.log('ProfileScreen - User Organizations:', userOrganizations);
  //   console.log('ProfileScreen - Is Org Active:', isOrganizationActive);
  //   console.log('ProfileScreen - Active Org Details:', activeOrganization);
  // }, [user, profile, displayName, preferences, hasFullAccount, userOrganizations, isOrganizationActive, activeOrganization]);

  // Open profile edit modal with current values from context (for personal profile)
  const handleOpenProfileEdit = () => {
    setEditDisplayName(displayName || ''); // Use context displayName
    setEditPreferences(preferences || []); // Use context preferences
    setEditAboutMe(profile?.about_me || ''); // <<< ADD THIS LINE: Use context profile.about_me
    setEditFormError('');
    setShowProfileEditModal(true);
  };
  
  // Open account settings modal (only if user has a full account)
  const handleOpenAccountSettings = () => {
    if (!hasFullAccount) {
      // This case should ideally not happen if the button isn't shown, but good failsafe
      Alert.alert('Fehler', 'Account-Einstellungen sind nur für eingeloggte Benutzer verfügbar.');
      return;
    }
    // Reset the "make permanent" flag if opened normally
    setIsMakingPermanent(false);

    setNewEmail(user.email || '');
    setEmailCurrentPassword(''); // Clear password field
    setNewPassword('');
    setConfirmNewPassword('');
    setActiveTab('email');
    setAccountSettingsError('');
    setShowAccountSettingsModal(true);
  };
  
  // Open create account modal
  const handleOpenCreateAccountModal = () => {
    setCreateEmail('');
    setCreatePassword('');
    setConfirmCreatePassword('');
    setCreateFormError('');
    setShowCreateAccountModal(true);
  };
  
  // Handle account creation (upgrade from local)
  const handleCreateAccount = async () => {
    if (!createEmail.trim() || !createEmail.includes('@')) {
      setCreateFormError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (!createPassword) {
      setCreateFormError('Bitte gib ein Passwort ein.');
      return;
    }
    if (createPassword.length < 6) {
      setCreateFormError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (createPassword !== confirmCreatePassword) {
      setCreateFormError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setIsCreateLoading(true);
    setCreateFormError('');

    try {
      // console.log(`Attempting account upgrade for email: ${createEmail}`);
      const result = await upgradeToFullAccount(createEmail, createPassword);

      if (result.success) {
        // console.log('Account upgrade process successful in AuthContext');
        Alert.alert(
          'Erfolgreich',
          'Dein Account wurde erstellt. Du bist jetzt eingeloggt.'
        );
        setShowCreateAccountModal(false);
      } else {
        console.error('Account upgrade failed:', result.error);
        setCreateFormError(result.error?.message || 'Account konnte nicht erstellt werden.');
      }
    } catch (error) {
      console.error('Unexpected error during account creation:', error);
      setCreateFormError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsCreateLoading(false);
    }
  };
  
  // Save profile changes (Name and Preferences) - Only for PERSONAL profile
  const handleSaveProfile = async () => {
    if (isOrganizationActive) return; // Prevent saving personal profile while org active
    
    // console.log('Saving personal profile changes (including about_me)...'); // Updated log
    
    if (!editDisplayName.trim()) {
      setEditFormError('Bitte gib einen Benutzernamen ein.');
      return;
    }
    // Allow zero preferences? Maybe not needed.
    // if (editPreferences.length === 0) {
    //   setEditFormError('Bitte wähle mindestens eine Präferenz aus.');
    //   return;
    // }
    
    setIsEditLoading(true);
    setEditFormError('');
    
    // Combine updates into a single object for clarity
    const updates = {};
    let needsUpdate = false;

    if (editDisplayName !== displayName) {
        updates.display_name = editDisplayName.trim();
        needsUpdate = true;
    }

    const preferencesChanged = JSON.stringify(editPreferences.sort()) !== JSON.stringify((preferences || []).sort());
    if (preferencesChanged) {
        updates.preferences = editPreferences;
        needsUpdate = true;
    }

    // <<< START ADDED SECTION >>>
    // Check if about_me changed
    if (editAboutMe !== (profile?.about_me || '')) {
        // Allow empty string, treat null/undefined as empty for comparison
        updates.about_me = editAboutMe.trim(); 
        needsUpdate = true;
    }
    // <<< END ADDED SECTION >>>

    if (!needsUpdate) {
        // console.log("No profile changes detected.");
        setShowProfileEditModal(false);
        setIsEditLoading(false);
        return; // Nothing to save
    }

    try {
        // Call updateUserProfile from AuthContext (assuming it handles partial updates)
        // console.log("Calling updateUserProfile with updates:", updates);
        const result = await updateProfile(updates); // Use updateProfile from AuthContext

        if (result.success) {
            if (result.warning) {
                 Alert.alert(
                    'Teilweise erfolgreich',
                    'Deine Änderungen wurden lokal gespeichert, aber es gab Probleme bei der Server-Synchronisierung.'
                 );
            } else {
                 Alert.alert('Erfolgreich', 'Profil aktualisiert.');
            }
            setShowProfileEditModal(false);
        } else {
            console.error('Failed to update profile:', result.error);
            setEditFormError(result.error?.message || 'Fehler beim Speichern des Profils.');
            if (result.warning) {
                 Alert.alert(
                    'Hinweis',
                    'Änderungen lokal übernommen, aber Datenbank-Update fehlgeschlagen.'
                 );
            }
        }

    } catch (error) {
        console.error('Unexpected error during profile update:', error);
        setEditFormError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
        setIsEditLoading(false);
    }
  };
  
  // --- NEW: Open Org Edit Modal ---
  const handleOpenOrgEdit = () => {
    if (!isOrganizationActive || !activeOrganization) return;
    setEditOrgName(activeOrganization.name || '');
    setOrgEditError('');
    setShowOrgEditModal(true);
    // <<< ADD THIS LINE >>>
    setEditOrgAboutMe(activeOrganization.about_me || ''); 
  };

  // --- NEW: Save Org Name ---
  // <<< RENAME this function from handleSaveOrgName to handleSaveOrgDetails >>>
  const handleSaveOrgDetails = async () => { 
    if (!isOrganizationActive || !activeOrganizationId) return;
    
    const trimmedName = editOrgName.trim();
    const trimmedAboutMe = editOrgAboutMe.trim(); // <<< ADD THIS LINE >>>

    if (!trimmedName) { // <<< Use trimmedName >>>
      setOrgEditError('Organisationsname darf nicht leer sein.');
      return;
    }

    // <<< START MODIFIED SECTION >>>
    const updates = {};
    let needsUpdate = false;

    if (trimmedName !== activeOrganization?.name) {
      updates.name = trimmedName;
      needsUpdate = true;
    }
    // Check if about_me changed (treat null/undefined as empty string for comparison)
    if (trimmedAboutMe !== (activeOrganization?.about_me || '')) {
        updates.about_me = trimmedAboutMe;
        needsUpdate = true;
    }

    if (!needsUpdate) {
        // console.log("No organization details changed.");
        setShowOrgEditModal(false); // Nothing changed
        return;
    }
    // <<< END MODIFIED SECTION >>>

    setIsOrgEditLoading(true);
    setOrgEditError('');

    try {
      // <<< MODIFY: Use updateOrganizationDetails (assuming it exists/handles partial updates) >>>
      // If updateOrganizationDetails doesn't exist, you'll need to add it to OrganizationContext
      // or modify updateOrganizationName to accept an object.
      // console.log("Calling updateOrganizationDetails with updates:", updates); 
      const result = await updateOrganizationDetails(activeOrganizationId, updates); 
      // <<< END MODIFICATION >>>

      if (result.success) {
        Alert.alert('Erfolg', 'Organisationsdetails aktualisiert.');
        setShowOrgEditModal(false);
        // Context should update automatically
      } else {
        console.error("Failed to update org details:", result.error);
        setOrgEditError(result.error?.message || 'Fehler beim Speichern der Details.');
      }
    } catch (error) {
      console.error('Unexpected error saving org details:', error);
      setOrgEditError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsOrgEditLoading(false);
    }
  };

  // Handle email update
  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAccountSettingsError('Bitte gib eine gültige neue E-Mail-Adresse ein.');
      return;
    }
    if (newEmail.trim() === user?.email) {
       setAccountSettingsError('Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden.');
       return;
    }
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    try {
      const result = await updateEmail(newEmail.trim(), emailCurrentPassword);
      if (result.success) {
        setShowAccountSettingsModal(false);
        Alert.alert('Erfolgreich', 'Deine E-Mail-Adresse wurde aktualisiert.');
      } else {
        // console.error removed to avoid expo error overlay
        // console.log('Failed to update email:', result.error);
        const errorMessage = result.error?.message || 'E-Mail konnte nicht geändert werden.';
        setAccountSettingsError(errorMessage);
      }
    } catch (error) {
      // console.error removed
      // console.log('Unexpected error during email update:', error);
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };
  
  // Handle password update
  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setAccountSettingsError('Bitte gib ein neues Passwort ein.');
      return;
    }
    if (newPassword.length < 6) {
      setAccountSettingsError('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountSettingsError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    try {
      const result = await updatePassword(newPassword);
      if (result.success) {
        // existing success handling
        const needsEmailUpdate = isMakingPermanent && user?.email?.includes('@temp.mylocalapp.de') && newEmail.trim() && newEmail.trim() !== user.email;
        if (needsEmailUpdate) {
          if (!newEmail.trim() || !newEmail.includes('@')) {
            setAccountSettingsError('Bitte gib eine gültige neue E-Mail-Adresse ein, um den Account permanent zu machen.');
            setIsAccountSettingsLoading(false);
            return;
          }
          const emailResult = await updateEmail(newEmail.trim());
          if (!emailResult.success) {
             Alert.alert('Passwort gesetzt, E-Mail fehlgeschlagen', `Dein Passwort wurde festgelegt, aber die E-Mail konnte nicht geändert werden: ${emailResult.error?.message || 'Fehler'}. Bitte versuche die E-Mail später erneut zu ändern.`);
          } else {
             Alert.alert('Erfolgreich', 'Dein Passwort wurde festgelegt und die E-Mail aktualisiert. Dein Account ist jetzt permanent.');
          }
        } else {
             Alert.alert('Erfolgreich', isMakingPermanent ? 'Dein Passwort wurde festgelegt. Dein Account ist jetzt permanent.' : 'Dein Passwort wurde aktualisiert.');
        }
        setShowAccountSettingsModal(false);
        setIsMakingPermanent(false);
      } else {
        // console.error removed
        // console.log('Failed to update password:', result.error);
        setAccountSettingsError(result.error?.message || 'Passwort konnte nicht geändert werden.');
      }
    } catch (error) {
      // console.error removed
      // console.log('Unexpected error during password update:', error);
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };

  // Handle sign out / reset
  const handleSignOut = async () => {
    if (hasFullAccount) {
      // Existing logic for logged-in users
      Alert.alert(
        "Abmelden",
        "Möchtest du dich wirklich abmelden?",
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Abmelden",
            style: "destructive",
            onPress: async () => {
              const { success, error } = await signOut();
              if (!success) {
                Alert.alert("Fehler", `Abmeldung fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`);
              }
              // Navigation handled by AppNavigator via AuthContext change
            },
          },
        ]
      );
    } else {
      // Logic for local/temporary users (reset app state by signing out)
      Alert.alert(
        "App Zurücksetzen",
        "Möchtest du die App wirklich zurücksetzen und dich abmelden?", // Updated text
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Zurücksetzen & Abmelden", // Updated text
            style: "destructive",
            onPress: async () => {
              // Replace resetOnboarding with signOut
              const { success, error } = await signOut(); 
              if (!success) {
                Alert.alert("Fehler", `Zurücksetzen fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`);
              }
              // Navigation handled by AppNavigator via AuthContext change
            },
          },
        ]
      );
    }
  };
  
  // Handle switch to organization context
  const handleSwitchToOrg = (orgId) => {
    // **** ADDED LOGGING ****
    // console.log(`%%%% ProfileScreen: handleSwitchToOrg CALLED with orgId: ${orgId} %%%%`);

    //setIsOrgContextLoading(true); // Temporarily disable loading state changes
    
    // **** MODIFIED: Call function without await/result handling ****
    // console.log(`ProfileScreen: Calling switchOrganizationContext (from OrganizationContext) for orgId: ${orgId} - WITHOUT AWAIT`);
    switchOrganizationContext(orgId).then(result => {
      if (!result.success) {
        if (result.error && result.error.includes('not found')) {
          Alert.alert(
            "Organisation nicht gefunden", 
            "Diese Organisation existiert nicht mehr. Die Organisationsliste wird aktualisiert.",
            [{ text: "OK", onPress: () => refreshCurrentUserProfile() }]
          );
        } else {
          Alert.alert(
            "Fehler", 
            result.error || "Konnte nicht zur Organisation wechseln."
          );
        }
      }
    }).catch(error => {
      console.error("Error in switchOrganizationContext:", error);
      Alert.alert("Fehler", "Ein unerwarteter Fehler ist aufgetreten.");
    });
    
    // console.log(`ProfileScreen: Call to switchOrganizationContext initiated (without await).`);

    //setIsOrgContextLoading(false); // Temporarily disable
    // if (!result.success) { // Temporarily disable result check
    //   Alert.alert("Fehler", result.error || "Konnte nicht zur Organisation wechseln.");
    // }
    // UI will update based on context change (hopefully)
  };

  // Handle switch back to personal context
  const handleSwitchToPersonal = async () => {
     // REMOVED: setIsOrgContextLoading(true);
     const result = await switchOrganizationContext(null);
     // REMOVED: setIsOrgContextLoading(false);
     if (!result.success) {
        Alert.alert("Fehler", result.error || "Konnte nicht zum persönlichen Account wechseln.");
     }
     // UI will update based on context change (isLoading from useOrganization)
  };

  // Handle leaving an organization
  const handleLeaveOrg = async (orgId, orgName) => {
      if (!orgId || !orgName) return;
      Alert.alert(
          "Organisation verlassen",
          `Möchtest du die Organisation "${orgName}" wirklich verlassen?`,
          [
              { text: "Abbrechen", style: "cancel" },
              {
                  text: "Verlassen",
                  style: "destructive",
                  onPress: async () => {
                      // REMOVED: setIsOrgContextLoading(true);
                      const result = await leaveOrganization(orgId);
                      // REMOVED: setIsOrgContextLoading(false);
                      if (result.success) {
                          Alert.alert("Erfolg", `Du hast "${orgName}" verlassen.`);
                          // Context should update automatically via AuthProvider listener
                          // *** ADDED: Explicitly switch back to personal context ***
                          await switchOrganizationContext(null);
                      } else {
                          // Display a more user-friendly error
                          const errorMessage = result.error?.message === 'Database Error: Cannot leave as the last admin.' 
                              ? 'Du kannst die Organisation nicht verlassen, da du der letzte Administrator bist.'
                              : result.error?.message || "Verlassen fehlgeschlagen.";
                          Alert.alert("Fehler", errorMessage);
                      }
                  },
              },
          ]
      );
  };
  
  // Handle deleting an organization (admin only)
  const handleDeleteOrg = (orgId, orgName) => {
    if (!orgId || !orgName) return;
    Alert.alert(
      "Organisation löschen",
      `Möchtest du die Organisation "${orgName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden und entfernt alle Mitglieder aus der Organisation.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            const result = await deleteOrganization(orgId);
            if (result.success) {
              Alert.alert("Erfolg", `Die Organisation "${orgName}" wurde gelöscht.`);
              // Context will update automatically
            } else {
              Alert.alert("Fehler", result.error || "Löschen fehlgeschlagen.");
            }
          },
        },
      ]
    );
  };
  
  // --- Member Management Handlers ---

  const handleRemoveMember = (memberUserId, memberName) => {
    if (!activeOrganizationId) return;
    Alert.alert(
      "Mitglied entfernen",
      `Möchtest du "${memberName || 'dieses Mitglied'}" wirklich aus der Organisation entfernen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entfernen",
          style: "destructive",
          onPress: async () => {
            setMemberManagementLoading(true);
            // Use removeOrganizationMember from useOrganization context
            const result = await removeOrganizationMember(activeOrganizationId, memberUserId);
            setMemberManagementLoading(false);
            if (result.success) {
              Alert.alert("Erfolg", `"${memberName || 'Mitglied'}" wurde entfernt.`);
              reloadMembers(); // Refetch members list
            } else {
              Alert.alert("Fehler", result.error?.message || "Entfernen fehlgeschlagen.");
            }
          },
        },
      ]
    );
  };

  const handleMakeAdmin = (newAdminUserId, memberName) => {
    if (!activeOrganizationId) return;
    Alert.alert(
      "Admin ernennen",
      `Möchtest du "${memberName || 'dieses Mitglied'}" zum neuen Administrator ernennen? Du wirst dadurch zum normalen Mitglied herabgestuft.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ernennen",
          style: "default", // Or "destructive" if preferred
          onPress: async () => {
            setMemberManagementLoading(true);
            // Use transferOrganizationAdmin from useOrganization context
            const result = await transferOrganizationAdmin(activeOrganizationId, newAdminUserId);
            setMemberManagementLoading(false);
            if (result.success) {
              Alert.alert("Erfolg", `"${memberName || 'Mitglied'}" ist jetzt der neue Administrator.`);
              // The OrganizationContext and AuthContext should update the user's role automatically.
              // Reload members needed to update the visual roles in the list.
              reloadMembers(); 
            } else {
              Alert.alert("Fehler", result.error?.message || "Admin-Übertragung fehlgeschlagen.");
            }
          },
        },
      ]
    );
  };
  
  // --- NEW: Handler for Reload Button ---
  const handleReloadOrgContext = () => {
    if (activeOrganizationId) {
      // Simply call switchOrganizationContext again with the same ID
      // It will refetch data and update the state, triggering a re-render.
      // The isLoading state from useOrganization will show activity.
      switchOrganizationContext(activeOrganizationId);
    }
  };

  // --- NEW: Handle Account Deletion --- 
  const handleDeleteAccount = async () => {
    if (!hasFullAccount) return; // Should not happen, but safety check

    // Check if user is admin in any organization
    const isAdminAnywhere = userOrganizations?.some(org => org.role === 'admin');

    if (isAdminAnywhere) {
      Alert.alert(
        "Fehler",
        "Du kannst deinen Account nicht löschen, solange du Administrator in einer Organisation bist. Bitte übertrage zuerst die Admin-Rechte in allen betroffenen Organisationen.",
        [{ text: "OK" }]
      );
      return;
    }

    // Confirmation Alert
    Alert.alert(
      "Account löschen",
      "Warnung: Möchtest du deinen Account wirklich endgültig löschen? Alle deine Daten (Profil, Kommentare, Reaktionen usw.) werden unwiderruflich entfernt. Diese Aktion kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Endgültig löschen",
          style: "destructive",
          onPress: async () => {
            setIsAccountSettingsLoading(true); // Reuse loading state for visual feedback
            try {
              // Call the new function from AuthContext
              // This function should call the `delete_user_account` RPC
              // and then call signOut().
              const result = await deleteCurrentUserAccount(); 

              if (!result.success) {
                  // Handle specific error for admin check (though UI should catch it)
                  if (result.error?.message?.includes('User is an admin')) {
                      Alert.alert("Fehler", "Du musst zuerst die Admin-Rechte übertragen.");
                  } else {
                      Alert.alert("Fehler", `Account konnte nicht gelöscht werden: ${result.error?.message || 'Unbekannter Fehler'}`);
                  }
                  setIsAccountSettingsLoading(false);
              }
              // On success, signOut within deleteCurrentUserAccount should trigger navigation
              // No need to set loading false here if sign out navigates away.

            } catch (error) {
              console.error("Error during account deletion process:", error);
              Alert.alert("Fehler", "Ein unerwarteter Fehler ist beim Löschen des Accounts aufgetreten.");
              setIsAccountSettingsLoading(false);
            }
          },
        },
      ]
    );
  };

  // --- Render Functions --- 

  const renderHeader = () => {
    // Ensure activeOrganization exists before accessing properties
    const currentOrgName = isOrganizationActive && activeOrganization ? activeOrganization.name : null;
    const currentOrgLogoUrl = isOrganizationActive && activeOrganization ? activeOrganization.logo_url : null; // <-- ADDED
    const currentUserRole = isOrganizationActive && activeOrganization ? activeOrganization.currentUserRole : null;
    const headerTitle = isOrganizationActive 
      ? `Organisation: ${currentOrgName || '... '}` 
      : (displayName || 'Dein Profil'); // Use displayName or fallback
    const avatarInitial = isOrganizationActive ? (currentOrgName?.charAt(0) || 'O') : (displayName?.charAt(0) || '?');
    const isAdmin = isOrganizationActive && currentUserRole === 'admin'; // Use derived role
    const userAvatarUrl = !isOrganizationActive ? profile?.avatar_url : null; // Get avatar URL only in personal context
    
    return (
      <View style={styles.profileHeader}>
        {/* Display Image or Initials Avatar */}
        <TouchableOpacity
           onPress={isOrganizationActive ? handleSelectOrgLogo : handleSelectProfilePicture} // Allow any org member to change logo
           disabled={uploadingImage || loadingProfilePicture || loadingOrgLogo} // Disable only during loading
           style={styles.avatarContainer} // Added container for better layout
        >
          {/* Personal Avatar Logic */}
          {userAvatarUrl && !isOrganizationActive ? (
              <Image source={{ uri: userAvatarUrl }} style={styles.avatarImage} />
          ) : 
          /* Organization Logo/Avatar Logic */
          isOrganizationActive ? (
              currentOrgLogoUrl ? (
                 <Image source={{ uri: currentOrgLogoUrl }} style={styles.avatarImage} />
              ) : (
                 <View style={[styles.avatar, styles.orgAvatar]}>
                   <Text style={styles.avatarLetter}>{avatarInitial}</Text>
                 </View>
              )
          ) : (
              /* Fallback Personal Avatar (Initials) */
              <View style={[styles.avatar]}>
                 <Text style={styles.avatarLetter}>{avatarInitial}</Text>
              </View>
          )}
          
          {/* Edit Icon Overlay */}
          {/* Personal Context Edit Icon */}
          {!isOrganizationActive && !uploadingImage && !loadingProfilePicture && (
              <View style={styles.avatarEditIcon}>
                 <Ionicons name="camera-outline" size={18} color="#fff" />
              </View>
          )}
          {/* Organization Context Edit Icon (for all members) */}
          {isOrganizationActive && !loadingOrgLogo && (
             <View style={styles.avatarEditIcon}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
             </View>
          )}
          
          {/* Loading Indicator */}
          {/* Personal Context Loading */}
          {(uploadingImage || loadingProfilePicture) && !isOrganizationActive && (
              <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
              </View>
          )}
          {/* Organization Context Loading */}
          {loadingOrgLogo && isOrganizationActive && (
              <View style={styles.avatarLoadingOverlay}>
                 <ActivityIndicator size="small" color="#fff" />
              </View>
          )}
        </TouchableOpacity>

        {/* Rest of the header */}
        <View style={styles.profileInfo}>
           <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          {hasFullAccount && !isOrganizationActive && (
             user?.email?.endsWith('@users.mylocalapp.de')
               ? <Text style={styles.email}>Registriert seit: {user?.created_at ? new Date(user.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</Text>
               : <Text style={styles.email}>{user?.email || ''}</Text>
          )}
          {!hasFullAccount && (
            <Text style={styles.accountStatus}>Lokaler Account (nicht synchronisiert)</Text>
          )}
          {isOrganizationActive && currentUserRole && ( // Check currentUserRole exists
             <Text style={styles.roleText}>Deine Rolle: {currentUserRole === 'admin' ? 'Administrator' : 'Mitglied'}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {/* Personal Profile Edit Button - NO LONGER NEEDED HERE? (Handled by avatar tap) */}
          {/* {!isOrganizationActive && (
            <TouchableOpacity
                style={styles.headerIconButton}
                onPress={handleOpenProfileEdit} // Keep if needed for Name/Prefs
            >
                <Ionicons name="pencil" size={20} color="#4285F4" />
            </TouchableOpacity>
          )} */}
          {/* Separated Reload Buttons */}
          {!isOrganizationActive && (
              <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => loadUserProfile(user?.id)}
                  disabled={authLoading || loadingProfilePicture}
              >
                  <Ionicons name="refresh-outline" size={22} color="#4285F4" />
              </TouchableOpacity>
          )}
          {isOrganizationActive && (
            <>
              {/* Edit button available for all org members */}
              <TouchableOpacity
                  style={styles.headerIconButton} // Use consistent styling
                  onPress={handleOpenOrgEdit}
              >
                  <Ionicons name="pencil" size={20} color="#34A853" />
              </TouchableOpacity>
              <TouchableOpacity
                  style={styles.headerIconButton} // Use consistent styling
                  onPress={handleReloadOrgContext}
                  disabled={isOrgContextLoading} // Disable while loading
              >
                  <Ionicons name="refresh-outline" size={22} color="#17a2b8" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderNoAccountSection = () => (
    <View style={[styles.card, styles.highlightedOrgCard]}>
       <Text style={[styles.cardTitle, styles.highlightedOrgTitle]}>Account erstellen</Text>
       <Text style={[styles.cardText, styles.highlightedOrgPromptText]}>
           Sichere deine Daten, sei <Text style={styles.boldText}>interaktiv dabei</Text> und nutze <Text style={styles.boldText}>alle Funktionen</Text>!
       </Text>
       <TouchableOpacity onPress={handleOpenCreateAccountModal} style={{ marginTop: 10 }}>
         <LinearGradient
           colors={['#7b4397', '#dc2430']}
           start={{ x: 0, y: 0.5 }}
           end={{ x: 1, y: 0.5 }}
           style={styles.gradientButton}
         >
           <Ionicons name="person-add-outline" size={20} color="#fff" style={styles.buttonIcon} />
           <Text style={styles.primaryButtonText}>Permanenten Account erstellen</Text>
         </LinearGradient>
       </TouchableOpacity>
    </View>
  );
  
  const renderOrgManagementSection = () => {
    // Strengthen the guard: Ensure activeOrganization is fully loaded
    if (!isOrganizationActive || !activeOrganization || !activeOrganization.currentUserRole) {
        // console.log("ProfileScreen: renderOrgManagementSection - Bailing out due to missing activeOrganization data.");
        // Optionally render a placeholder or loading indicator here
        return (
             <View style={styles.card}>
                 <ActivityIndicator color="#4285F4" />
             </View>
         ); 
    }

    const copyInviteCode = () => {
      if (activeOrganization.invite_code) {
        Clipboard.setString(activeOrganization.invite_code);
        Alert.alert("Kopiert!", "Einladungscode wurde in die Zwischenablage kopiert.");
      }
    };

    // activeOrganization is guaranteed to exist here now
    const isAdmin = activeOrganization.currentUserRole === 'admin';
    const currentUserId = user?.id;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Organisationsdetails</Text>
        {/* Check activeOrganization AND invite_code */}
        {activeOrganization && activeOrganization.invite_code && (
            <View style={styles.inviteCodeContainer}>
                <Text style={styles.inviteLabel}>Einladungscode:</Text>
                <Text style={styles.inviteCodeText}>{activeOrganization.invite_code}</Text>
                <TouchableOpacity onPress={copyInviteCode} style={styles.copyButton}>
                    <Ionicons name="copy-outline" size={20} color="#4285F4" />
                </TouchableOpacity>
            </View>
        )}
        
        <Text style={styles.membersTitle}>Mitglieder ({organizationMembers.length})</Text>
        {isFetchingMembers ? (
            <ActivityIndicator color="#4285F4" style={{ marginVertical: 10 }}/>
        ) : orgMgmtError ? (
            <Text style={styles.errorText}>{orgMgmtError}</Text>
        ) : organizationMembers.length > 0 ? (
            <View style={styles.memberListContainer}>
              {organizationMembers.map(item => (
                  <View key={item.user_id} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.display_name || 'Unbekannter Benutzer'}{item.user_id === currentUserId ? ' (Du)' : ''}</Text>
                        <Text style={styles.memberRole}>{item.role === 'admin' ? 'Admin' : 'Mitglied'}</Text>
                      </View>
                      {/* Admin actions - Show only if current user is admin AND the item is NOT the current user */}
                      {isAdmin && item.user_id !== currentUserId && (
                        <View style={styles.memberActions}>
                          <TouchableOpacity 
                            style={[styles.memberActionButton, styles.removeButton]} 
                            onPress={() => handleRemoveMember(item.user_id, item.display_name)}
                            disabled={memberManagementLoading}
                          >
                            <Text style={styles.memberActionButtonTextRemove}>Entfernen</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.memberActionButton, styles.makeAdminButton]} 
                            onPress={() => handleMakeAdmin(item.user_id, item.display_name)}
                            disabled={memberManagementLoading}
                          >
                            <Text style={styles.memberActionButtonTextAdmin}>Admin ernennen</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                  </View>
              ))}
            </View>
        ) : (
             <Text style={styles.noMembersText}>Keine Mitglieder gefunden.</Text>
        )}
        
        {/* Show loading indicator during member management actions */} 
        {memberManagementLoading && <ActivityIndicator size="small" color="#666" style={{ marginVertical: 5 }}/>}
        
        {/* Link list to org member actions - Moved here */}
        <View style={styles.linkListContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('CreateArticle')} style={styles.linkItem}>
            <Text style={styles.linkText}>Neuen Artikel erstellen</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ManageBroadcastGroups')} style={styles.linkItem}>
            <Text style={styles.linkText}>Chatgruppen verwalten</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} style={styles.linkItem}>
            <Text style={styles.linkText}>Neues Event erstellen</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreatePoi')} style={styles.linkItem}>
            <Text style={styles.linkText}>Neuen Marker auf der Karte setzen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.separator} />

        {/* --- Action Buttons for Active Org --- */}
        <TouchableOpacity 
            style={[styles.button, styles.switchButton]} 
            onPress={handleSwitchToPersonal}
            disabled={isOrgContextLoading}
        >
            {isOrgContextLoading ? <ActivityIndicator size="small" color="#4285F4" /> : <Text style={styles.switchButtonText}>Zu persönlichem Account wechseln</Text>}
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity 
              style={[styles.button, styles.leaveButton]} 
              onPress={() => handleDeleteOrg(activeOrganizationId, activeOrganization.name)}
              disabled={isOrgContextLoading || authLoading}
          >
              {(isOrgContextLoading || authLoading) ? <ActivityIndicator size="small" color="#dc3545" /> : <Text style={styles.leaveButtonText}>Organisation löschen</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
              style={[styles.button, styles.leaveButton]} 
              onPress={() => handleLeaveOrg(activeOrganizationId, activeOrganization.name)}
              disabled={isOrgContextLoading || authLoading}
          >
              {(isOrgContextLoading || authLoading) ? <ActivityIndicator size="small" color="#dc3545" /> : <Text style={styles.leaveButtonText}>Organisation verlassen</Text>}
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  const renderPersonalProfileSection = () => {
      if (isOrganizationActive) return null; // Don't show personal stuff when org active
      
      // Determine if the user has any organizations
      const hasNoOrganizations = !userOrganizations || userOrganizations.length === 0;

      // Format last save timestamp
      const lastSaveDate = lastOfflineSaveTimestamp
        ? new Date(lastOfflineSaveTimestamp).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'nie';

      return (
          <>
              {/* Organization membership display - creation/joining is handled via Admin Panel */}
              {hasFullAccount && userOrganizations && userOrganizations.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Organisationen</Text>
                    <Text style={styles.cardText}>Du bist Mitglied in:</Text>
                    {userOrganizations.map(org => (
                        <View key={org.id} style={styles.orgSelectItem}>
                            <Text style={styles.orgSelectName}>{org.name}</Text>
                            <TouchableOpacity 
                                style={[styles.buttonSmall, styles.switchButtonSmall]} 
                                onPress={() => handleSwitchToOrg(org.id)}
                                disabled={isOrgContextLoading}
                            >
                                {isOrgContextLoading ? <ActivityIndicator size="small" color="#4285F4" /> : <Text style={styles.buttonSmallText}>Zu dieser Organisation wechseln</Text>}
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
              )}

              {/* Personal Preferences - hidden when disablePreferences flag is true */}
              {!disablePreferences && (
              <View style={styles.card}>
                  <Text style={styles.cardTitle}>Deine Interessen</Text>
                  {/* Use context preferences directly, works for local and logged-in */}
                  {(preferences || []).length > 0 ? (
                    <View style={styles.preferencesContainer}>
                      {(preferences || []).map((prefId) => {
                         const category = categories.find(cat => cat.id === prefId);
                         return (
                           <View key={prefId} style={styles.preferenceChip}>
                             <Ionicons 
                                name={category?.icon || 'help-circle-outline'} 
                                size={16} 
                                color="#4285F4" 
                                style={styles.preferenceIcon}
                             />
                             <Text style={styles.preferenceText}>{category?.name || prefId}</Text>
                           </View>
                         );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noPreferencesText}>Keine Präferenzen ausgewählt.</Text>
                  )}
                  <TouchableOpacity 
                    style={styles.editButtonInline} 
                    onPress={handleOpenProfileEdit}
                  >
                    <Text style={styles.editButtonText}>Name & Interessen bearbeiten</Text>
                    <Ionicons name="chevron-forward" size={16} color="#4285F4" />
                  </TouchableOpacity>
              </View>
              )}
              
              {/* Visibility / Privacy */}
              <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sichtbarkeit</Text>
                  <View style={styles.settingItem}>
                    <Ionicons name="eye-outline" size={22} style={styles.settingIcon} />
                    <Text style={styles.settingText}>In Personenliste anzeigen</Text>
                    <Switch
                      value={profile?.show_in_list === true}
                      onValueChange={async (value) => {
                        if (isUpdatingVisibility) return;
                        setIsUpdatingVisibility(true);
                        try {
                          const result = await updateProfile({ show_in_list: !!value });
                          if (!result.success) {
                            Alert.alert('Fehler', result.error?.message || 'Konnte Sichtbarkeit nicht ändern.');
                          }
                        } finally {
                          setIsUpdatingVisibility(false);
                        }
                      }}
                      disabled={isUpdatingVisibility}
                    />
                  </View>
                  <Text style={styles.modalInfoText}>Wenn aktiviert, können andere dich in der Personenliste finden und direkt anschreiben.</Text>
              </View>

              {/* About Me Section - Show for both local and logged-in, but edit only personal */} 
              <View style={styles.card}>
                  <Text style={styles.cardTitle}>Über Mich</Text>
                  <Text style={styles.aboutMeText}>
                      {profile?.about_me || 'Keine Beschreibung hinterlegt.'}
                  </Text>
                  {/* Edit button can also trigger opening the main profile edit modal */}
                  <TouchableOpacity 
                    style={styles.editButtonInline} 
                    onPress={handleOpenAboutMeModal}
                  >
                    <Text style={styles.editButtonText}>Über mich bearbeiten</Text>
                    <Ionicons name="chevron-forward" size={16} color="#4285F4" />
                  </TouchableOpacity>
              </View>

              {/* Account Settings (Email/Password) - Show ONLY for logged-in users */}
              {hasFullAccount && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Account Einstellungen</Text>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    onPress={handleOpenAccountSettings}
                  >
                      <Ionicons name="settings-outline" size={22} style={styles.settingIcon} />
                      <Text style={styles.settingText}>E-Mail & Passwort ändern</Text>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                   {/* Maybe add delete account later */} 
                </View>
              )}

              {/* Offline Mode Management - Show for all users (local and logged-in) */}
              <View style={styles.card}>
                  <Text style={styles.cardTitle}>Offline Modus</Text>
                  <TouchableOpacity
                    style={[styles.button, styles.saveOfflineButton, (!isConnected || isSavingData) && styles.buttonDisabled]}
                    onPress={saveDataForOffline}
                    disabled={!isConnected || isSavingData}
                  >
                    {isSavingData ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="download-outline" size={20} color="#fff" style={styles.buttonIcon} />
                    )}
                    <Text style={styles.saveOfflineButtonText}>
                        {isSavingData ? 'Speichern...' : 'Daten für Offline-Modus speichern'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.lastSaveText}>
                      Zuletzt gespeichert: {lastSaveDate}
                  </Text>
                  {!isConnected && (
                      <Text style={styles.offlineWarningText}>
                          Keine Internetverbindung zum Speichern vorhanden.
                      </Text>
                  )}
              </View>
              {/* Legal Links */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Rechtliches</Text>
                <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://mylocalapp.de/agb')}>
                  <Text style={styles.settingText}>AGB / Terms of Use</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://mylocalapp.de/datenschutz')}>
                  <Text style={styles.settingText}>Datenschutz / Privacy Policy</Text>
                </TouchableOpacity>
              </View>
          </>
      );
  };

  // --- NEW: Render Card for Temporary Accounts ---
  const renderMakePermanentSection = () => (
      <View style={[styles.card, styles.highlightedOrgCard]}>
         <Text style={[styles.cardTitle, styles.highlightedOrgTitle]}>Account dauerhaft sichern</Text>
         <Text style={[styles.cardText, styles.highlightedOrgPromptText]}>
             Dein Account ist aktuell temporär. Sichere deine Daten, und nutze <Text style={styles.boldText}>alle Funktionen</Text>!
         </Text>
         <TouchableOpacity onPress={handleOpenMakePermanentSettings} style={{ marginTop: 15 }}>
           <LinearGradient
             colors={['#7b4397', '#dc2430']} // Using same gradient as create account
             start={{ x: 0, y: 0.5 }}
             end={{ x: 1, y: 0.5 }}
             style={styles.gradientButton}
           >
             <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.buttonIcon} />
             <Text style={styles.primaryButtonText}>Passwort festlegen & Sichern</Text>
           </LinearGradient>
         </TouchableOpacity>
      </View>
  );

  // --- MAIN RETURN --- 
  
  // Show loading indicator during initial auth check or context switching
  if (overallLoading) {
      return (
          <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
          </View>
      );
  }
  
  // Define modal render functions inside the component to access state/handlers
  const renderCreateAccountModal = () => (
    <Modal
      visible={showCreateAccountModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCreateAccountModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Account erstellen</Text>
          <Text style={styles.modalSubtitle}>Sichere deine Daten und nutze die App auf mehreren Geräten.</Text>
          
          <TextInput
            style={styles.input}
            placeholder="E-Mail"
            value={createEmail}
            onChangeText={setCreateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Passwort (min. 6 Zeichen)"
            value={createPassword}
            onChangeText={setCreatePassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <TextInput
            style={styles.input}
            placeholder="Passwort bestätigen"
            value={confirmCreatePassword}
            onChangeText={setConfirmCreatePassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          
          {createFormError ? <Text style={styles.errorTextModal}>{createFormError}</Text> : null}
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={() => setShowCreateAccountModal(false)}
              disabled={isCreateLoading}
            >
              <Text style={styles.modalButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton, isCreateLoading && styles.buttonDisabled]} 
              onPress={handleCreateAccount}
              disabled={isCreateLoading}
            >
              {isCreateLoading ? 
                 <ActivityIndicator color="#fff" size="small" /> : 
                 <Text style={styles.modalButtonText}>Erstellen</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderProfileEditModal = () => (
    <Modal
      visible={showProfileEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowProfileEditModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Profil bearbeiten</Text>
          
          <Text style={styles.inputLabel}>Anzeigename</Text>
          <TextInput
            style={styles.input}
            value={editDisplayName}
            onChangeText={setEditDisplayName}
            placeholder="Dein Name oder Spitzname"
            autoCapitalize="words"
          />
          
          <Text style={styles.inputLabel}>Interessen</Text>
          <View style={styles.categoriesContainerModal}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryItemModal,
                  editPreferences.includes(category.id) && styles.categoryItemModalSelected
                ]}
                onPress={() => togglePreference(category.id)}
              >
                <Ionicons 
                  name={category.icon} 
                  size={20} 
                  color={editPreferences.includes(category.id) ? '#fff' : '#4285F4'} 
                  style={styles.categoryIconModal}
                />
                <Text 
                  style={[
                    styles.categoryTextModal,
                    editPreferences.includes(category.id) && styles.categoryTextModalSelected
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {editFormError ? <Text style={styles.errorTextModal}>{editFormError}</Text> : null}
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={() => setShowProfileEditModal(false)}
              disabled={isEditLoading}
            >
              <Text style={styles.modalButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton, isEditLoading && styles.buttonDisabled]} 
              onPress={handleSaveProfile}
              disabled={isEditLoading}
            >
              {isEditLoading ? 
                 <ActivityIndicator color="#fff" size="small" /> : 
                 <Text style={styles.modalButtonText}>Speichern</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderAccountSettingsModal = () => (
    <Modal
      visible={showAccountSettingsModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAccountSettingsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Account Einstellungen</Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'email' && styles.tabButtonActive]}
              onPress={() => { setActiveTab('email'); setAccountSettingsError(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'email' && styles.tabTextActive]}>E-Mail ändern</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'password' && styles.tabButtonActive]}
              onPress={() => { setActiveTab('password'); setAccountSettingsError(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>Passwort ändern</Text>
            </TouchableOpacity>
          </View>
          {activeTab === 'email' && (
            <>
              <Text style={styles.inputLabel}>Neue E-Mail-Adresse</Text>
              <TextInput
                style={styles.input}
                placeholder="Neue E-Mail"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Text style={styles.inputLabel}>Aktuelles Passwort zur Bestätigung</Text>
              <TextInput
                style={styles.input}
                placeholder="Aktuelles Passwort"
                value={emailCurrentPassword}
                onChangeText={setEmailCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
              />
              {accountSettingsError ? <Text style={styles.errorTextModal}>{accountSettingsError}</Text> : null}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAccountSettingsModal(false)}
                  disabled={isAccountSettingsLoading}
                >
                  <Text style={styles.modalButtonText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, isAccountSettingsLoading && styles.buttonDisabled]}
                  onPress={handleUpdateEmail}
                  disabled={isAccountSettingsLoading}
                >
                  {isAccountSettingsLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>E-Mail aktualisieren</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
          {activeTab === 'password' && (
            <>
              <Text style={styles.inputLabel}>Neues Passwort (min. 6 Zeichen)</Text>
              <TextInput
                style={styles.input}
                placeholder="Neues Passwort"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <Text style={styles.inputLabel}>Neues Passwort bestätigen</Text>
              <TextInput
                style={styles.input}
                placeholder="Neues Passwort bestätigen"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
              {accountSettingsError ? <Text style={styles.errorTextModal}>{accountSettingsError}</Text> : null}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAccountSettingsModal(false)}
                  disabled={isAccountSettingsLoading}
                >
                  <Text style={styles.modalButtonText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, isAccountSettingsLoading && styles.buttonDisabled]}
                  onPress={handleUpdatePassword}
                  disabled={isAccountSettingsLoading}
                >
                  {isAccountSettingsLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Passwort aktualisieren</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // --- NEW: Render Org Edit Modal ---
  const renderOrgEditModal = () => (
    <Modal
      visible={showOrgEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowOrgEditModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Organisation bearbeiten</Text>

          <Text style={styles.inputLabel}>Organisationsname</Text>
          <TextInput
            style={styles.input}
            value={editOrgName}
            onChangeText={setEditOrgName}
            placeholder="Neuer Name der Organisation"
            autoCapitalize="words"
          />

          {/* <<< START ADDED SECTION >>> */}
          <Text style={styles.inputLabel}>Über die Organisation (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]} // Reuse textArea style
            value={editOrgAboutMe}
            onChangeText={setEditOrgAboutMe}
            placeholder="Beschreibe deine Organisation..."
            multiline={true}
            numberOfLines={4} // Suggest initial height
          />
          {/* <<< END ADDED SECTION >>> */}

          {orgEditError ? <Text style={styles.errorTextModal}>{orgEditError}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowOrgEditModal(false)}
              disabled={isOrgEditLoading}
            >
              <Text style={styles.modalButtonTextCancel}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, isOrgEditLoading && styles.buttonDisabled]}
              onPress={handleSaveOrgDetails} // <<< Use the renamed handler >>>
              disabled={isOrgEditLoading}
            >
              {isOrgEditLoading ?
                 <ActivityIndicator color="#fff" size="small" /> :
                 <Text style={styles.modalButtonText}>Speichern</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // --- NEW: Open account settings modal specifically for making account permanent ---
  const handleOpenMakePermanentSettings = () => {
    if (!isTemporaryAccount) {
      Alert.alert('Fehler', 'Diese Funktion ist nur für temporäre Accounts.');
      return;
    }
    setIsMakingPermanent(true);
    setNewEmail(user?.email || ''); // Always pre-fill email
    setEmailCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setActiveTab('password');
    setAccountSettingsError('');
    setShowAccountSettingsModal(true);
  };

  // --- NEW: Handler to select and upload profile picture ---
  const handleSelectProfilePicture = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Nur eingeloggte Benutzer können ein Profilbild hochladen.');
      return;
    }
    if (isOrganizationActive) {
        Alert.alert('Hinweis', 'Profilbild kann nur im persönlichen Kontext geändert werden.');
        return;
    }
    if (uploadingImage || loadingProfilePicture) return; // Prevent multiple uploads

    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Berechtigung benötigt', 'Zugriff auf die Fotobibliothek wird benötigt, um ein Bild auszuwählen.');
      return;
    }

    // Launch image picker
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio
      quality: 0.7, // Compress image slightly
    });

    if (pickerResult.canceled) {
      return; // User cancelled picker
    }

    // Start upload process
    setUploadingImage(true);
    try {
      // Use the first asset if available
      if (pickerResult.assets && pickerResult.assets.length > 0) {
        const imageUri = pickerResult.assets[0].uri;
        const result = await updateProfilePicture(imageUri);

        if (result.success) {
          Alert.alert('Erfolg', 'Profilbild erfolgreich aktualisiert.');
          // Profile state in context is updated, UI should refresh automatically
        } else {
          console.error("Error uploading profile picture:", result.error);
          Alert.alert('Fehler', result.error?.message || 'Profilbild konnte nicht hochgeladen werden.');
        }
      } else {
          // Handle the case where assets array might be missing or empty
          console.warn("ImagePicker did not return any assets.");
          Alert.alert('Fehler', 'Kein Bild ausgewählt oder ein Fehler ist aufgetreten.');
      }
    } catch (error) {
      console.error("Unexpected error selecting/uploading picture:", error);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setUploadingImage(false);
    }
  };

  // --- Handler to select and upload organization logo (available to all members) ---
  const handleSelectOrgLogo = async () => {
    if (!user || !isOrganizationActive || !activeOrganizationId) {
      Alert.alert('Fehler', 'Keine aktive Organisation oder Benutzer.');
      return;
    }
    // All org members can now change the logo (RLS handles authorization)
    if (loadingOrgLogo) return; // Prevent multiple uploads

    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Berechtigung benötigt', 'Zugriff auf die Fotobibliothek wird benötigt.');
      return;
    }

    // Launch image picker
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio
      quality: 0.7, // Compress image slightly
    });

    if (pickerResult.canceled) {
      return; // User cancelled picker
    }

    // Start upload process
    try {
      // Use the first asset if available
      if (pickerResult.assets && pickerResult.assets.length > 0) {
        const imageUri = pickerResult.assets[0].uri;
        // Use updateOrganizationLogo from OrganizationContext
        const result = await updateOrganizationLogo(activeOrganizationId, imageUri);

        if (result.success) {
          Alert.alert('Erfolg', 'Organisationslogo erfolgreich aktualisiert.');
          // Active org state in context is updated, UI should refresh
        } else {
          console.error("Error uploading organization logo:", result.error);
          Alert.alert('Fehler', result.error?.message || 'Logo konnte nicht hochgeladen werden.');
        }
      } else {
          console.warn("ImagePicker did not return any assets for org logo.");
          Alert.alert('Fehler', 'Kein Bild ausgewählt oder ein Fehler ist aufgetreten.');
      }
    } catch (error) {
      console.error("Unexpected error selecting/uploading org logo:", error);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } 
    // Loading state is handled within updateOrganizationLogo and OrganizationContext
  };

  // Handler to make temporary account permanent using upgradeToFullAccount
  const handleMakePermanent = async () => {
    if (!newPassword) {
      setAccountSettingsError('Bitte gib ein neues Passwort ein.');
      return;
    }
    if (newPassword.length < 6) {
      setAccountSettingsError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountSettingsError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    try {
      const result = await upgradeToFullAccount(newEmail.trim(), newPassword);
      if (result.success) {
        Alert.alert('Erfolgreich', 'Dein Account ist jetzt permanent.');
        setIsMakingPermanent(false);
        setShowAccountSettingsModal(false);
      } else {
        setAccountSettingsError(result.error?.message || 'Konnte Account nicht permanent machen.');
      }
    } catch (error) {
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };

  // Add a dedicated modal for making temporary accounts permanent
  const renderMakePermanentModal = () => (
    <Modal
      visible={showAccountSettingsModal && isMakingPermanent}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setIsMakingPermanent(false);
        setShowAccountSettingsModal(false);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Account dauerhaft sichern</Text>

          <Text style={styles.inputLabel}>E-Mail-Adresse</Text>
          <TextInput
            style={[styles.input, { backgroundColor: '#e0e0e0' }]}
            value={newEmail}
            editable={false}
          />

          <Text style={styles.inputLabel}>Neues Passwort (min. 6 Zeichen)</Text>
          <TextInput
            style={styles.input}
            placeholder="Neues Passwort"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Passwort bestätigen</Text>
          <TextInput
            style={styles.input}
            placeholder="Passwort bestätigen"
            secureTextEntry
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            autoCapitalize="none"
          />

          {accountSettingsError ? <Text style={styles.errorTextModal}>{accountSettingsError}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setIsMakingPermanent(false);
                setShowAccountSettingsModal(false);
              }}
              disabled={isAccountSettingsLoading}
            >
              <Text style={styles.modalButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, isAccountSettingsLoading && styles.buttonDisabled]}
              onPress={handleMakePermanent}
              disabled={isAccountSettingsLoading}
            >
              {isAccountSettingsLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalButtonText}>Passwort festlegen & Sichern</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Open About Me modal
  const handleOpenAboutMeModal = () => {
    setEditAboutMe(profile?.about_me || '');
    setEditFormError('');
    setShowAboutMeModal(true);
  };

  // Save About Me changes
  const handleSaveAboutMe = async () => {
    if (editAboutMe.trim() === (profile?.about_me || '')) {
      setShowAboutMeModal(false);
      return;
    }
    setIsEditLoading(true);
    setEditFormError('');
    try {
      const result = await updateProfile({ about_me: editAboutMe.trim() });
      if (result.success) {
        Alert.alert('Erfolgreich', 'Beschreibung aktualisiert.');
        setShowAboutMeModal(false);
      } else {
        setEditFormError(result.error?.message || 'Fehler beim Speichern.');
      }
    } catch {
      setEditFormError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsEditLoading(false);
    }
  };

  // Modal for editing Über Mich
  const renderAboutMeModal = () => (
    <Modal
      visible={showAboutMeModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAboutMeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Über Mich bearbeiten</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editAboutMe}
            onChangeText={setEditAboutMe}
            placeholder="Erzähl etwas über dich..."
            multiline={true}
            numberOfLines={4}
          />
          {editFormError ? <Text style={styles.errorTextModal}>{editFormError}</Text> : null}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowAboutMeModal(false)}
              disabled={isEditLoading}
            >
              <Text style={styles.modalButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, isEditLoading && styles.buttonDisabled]}
              onPress={handleSaveAboutMe}
              disabled={isEditLoading}
            >
              {isEditLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Speichern</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {renderHeader()}

      {/* Show EITHER Org Management OR Personal Sections */}
      {isOrganizationActive ? (
         renderOrgManagementSection()
      ) : (
         <>
            {/* Render based on account status */}
            {!hasFullAccount && renderNoAccountSection()}
            {hasFullAccount && (
              <>
                {/* Show make permanent card if needed */}
                {isTemporaryAccount && renderMakePermanentSection()}
                {/* Always show personal sections if user has an account */}
                {renderPersonalProfileSection()}
              </>
            )}
         </>
      )}

      {/* Sign Out Button - Always shown for personal context */}
      {!isOrganizationActive && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
            disabled={isAccountSettingsLoading || loadingProfilePicture} // Disable if delete/upload in progress
          >
            <Ionicons name="log-out-outline" size={22} style={[styles.settingIcon, styles.signOutIcon]} />
            <Text style={[styles.settingText, styles.signOutText]}>
              {hasFullAccount ? 'Abmelden' : 'App Zurücksetzen'}
            </Text>
          </TouchableOpacity>

          {/* --- NEW: Delete Account Button --- */}
          {/* Show only for full accounts in personal context */} 
          {hasFullAccount && (
              <TouchableOpacity
                  style={[styles.button, styles.deleteButton]} // New style needed
                  onPress={handleDeleteAccount}
                  disabled={isAccountSettingsLoading || loadingProfilePicture} // Disable during sign out/delete/upload
              >
                  <Ionicons name="trash-outline" size={22} style={[styles.settingIcon, styles.deleteIcon]} />
                  <Text style={[styles.settingText, styles.deleteButtonText]}>Account löschen</Text>
              </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modals */}
      {renderCreateAccountModal()}
      {renderProfileEditModal()}
      {renderAboutMeModal()}
      {isMakingPermanent ? renderMakePermanentModal() : renderAccountSettingsModal()}
      {renderOrgEditModal()}
    </ScrollView>
  );
};

// --- Styles --- 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8', // Slightly different background
  },
  loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20, // Keep horizontal padding
    paddingBottom: 20, // Keep bottom padding
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 70, // Apply conditional top padding
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  // NEW: Container for avatar + edit icon
  avatarContainer: {
      width: 55,
      height: 55,
      borderRadius: 27.5,
      marginRight: 15,
      position: 'relative', // Needed for absolute positioning of edit icon
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#ccc', // Fallback background
  },
  avatar: { // Style for the initial-based avatar
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { // Style for the Image component
      width: 55,
      height: 55,
      borderRadius: 27.5,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  // NEW: Edit icon overlay
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 3,
  },
  // NEW: Loading overlay for avatar
  avatarLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 27.5,
      justifyContent: 'center',
      alignItems: 'center',
  },
  orgAvatar: {
      backgroundColor: '#34A853', // Different color for orgs
  },
  profileInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  displayName: { // Keep if needed elsewhere, headerTitle is primary now
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  roleText: {
      fontSize: 13,
      color: '#555',
      fontStyle: 'italic',
  },
  accountStatus: {
      fontSize: 14,
      color: '#888',
      fontStyle: 'italic',
  },
  editProfileButton: {
      padding: 8,
      marginLeft: 10,
  },
  card: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 20,
      marginHorizontal: 15,
      marginTop: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  cardText: {
      fontSize: 14,
      color: '#555',
      lineHeight: 20,
      marginBottom: 15,
  },
  primaryButton: {
      flexDirection: 'row',
      backgroundColor: '#4285F4',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
  },
  primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 10,
  },
   button: { // General button styling for reuse
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginVertical: 8,
  },
  buttonIcon: {
      marginRight: 8,
  },
  buttonSmall: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 5,
  },
  buttonSmallText: {
      fontSize: 13,
      fontWeight: '600',
  },
  switchButton: {
      backgroundColor: '#e7f0fe',
  },
  switchButtonText: {
      color: '#4285F4',
      fontWeight: '600',
  },
   switchButtonSmall: {
      backgroundColor: '#e7f0fe',
  },
  leaveButton: {
      backgroundColor: '#fdeded',
  },
  leaveButtonText: {
      color: '#dc3545',
      fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fff', // Changed background
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonContainer: { // Container for Sign Out and Delete buttons
      marginTop: 30,
      paddingHorizontal: 15,
  },
  signOutText: {
    color: '#dc3545', // Red color for sign out
    fontWeight: '600',
  },
  signOutIcon: {
      color: '#dc3545',
  },
  // --- NEW Styles for Delete Button ---
  deleteButton: {
    backgroundColor: '#fff', // Same background as sign out
    borderWidth: 1,
    borderColor: '#cc0000', // More prominent red border
  },
  deleteButtonText: {
    color: '#cc0000', // Darker red text
    fontWeight: '600',
  },
  deleteIcon: {
      color: '#cc0000', // Darker red icon
  },
  // -------------------------------------
  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f0fe',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  preferenceIcon: {
    marginRight: 5,
  },
  preferenceText: {
    fontSize: 13,
    color: '#4285F4',
  },
  noPreferencesText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  editButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  editButtonText: {
    color: '#4285F4',
    fontSize: 14,
    marginRight: 3,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1, // Add border top for separation
    borderTopColor: '#f0f0f0',
  },
  settingIcon: {
    marginRight: 15,
    color: '#666',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  orgSelectItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
  },
  orgSelectName: {
      fontSize: 15,
      color: '#444',
      flex: 1, // Allow name to take space
      marginRight: 10,
  },
  separator: {
      height: 1,
      backgroundColor: '#e0e0e0',
      marginVertical: 15,
  },
  orgPromptText: {
      fontSize: 15,
      color: '#555',
      textAlign: 'center',
      marginTop: 10, // Add margin if separator exists
      marginBottom: 15,
  },
  inviteCodeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f0f0f0',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      marginBottom: 20,
  },
  inviteLabel: {
      fontSize: 14,
      color: '#666',
      marginRight: 5,
  },
  inviteCodeText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#333',
      flex: 1, // Take available space
  },
  copyButton: {
      padding: 5,
  },
  membersTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: '#444',
      marginBottom: 10,
  },
  memberListContainer: {
    marginBottom: 15,
  },
  memberItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f5f5f5',
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberName: {
      fontSize: 14,
      color: '#555',
      fontWeight: '500',
  },
  memberRole: {
      fontSize: 13,
      color: '#888',
      fontStyle: 'italic',
  },
   noMembersText: {
      fontSize: 14,
      color: '#888',
      fontStyle: 'italic',
      textAlign: 'center',
      marginVertical: 10,
  },
  errorText: {
      color: '#dc3545',
      fontSize: 14,
      textAlign: 'center',
      marginVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
   modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: -5,
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
    marginTop: 10,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  errorTextModal: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    marginTop: -5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    flex: 1, // Make buttons take equal width
  },
  cancelButton: {
    backgroundColor: '#6c757d', // Gray
  },
  saveButton: {
    backgroundColor: '#4285F4', // Blue
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonTextCancel: {
    color: '#fff', // White text on gray for consistency
    fontSize: 16,
    fontWeight: 'bold',
  },
   buttonDisabled: {
    opacity: 0.7,
    backgroundColor: '#ccc', // More prominent disabled style
  },
  categoriesContainerModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  categoryItemModal: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    width: '48%', // Adjust for spacing
    justifyContent: 'center',
  },
  categoryItemModalSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  categoryIconModal: {
      marginRight: 6,
  },
  categoryTextModal: {
    fontSize: 14,
    color: '#4285F4',
  },
  categoryTextModalSelected: {
    color: '#fff',
  },
  tabContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
  },
  tabButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
  },
  tabButtonActive: {
      borderBottomColor: '#4285F4',
  },
  tabText: {
      fontSize: 16,
      color: '#666',
  },
  tabTextActive: {
      color: '#4285F4',
      fontWeight: 'bold',
  },
  singleButton: {
      marginHorizontal: 0, // No horizontal margin when it's the only button
      marginTop: 10,
  },
  marginTop: {
      marginTop: 10,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  removeButton: {
      backgroundColor: '#fdeded',
  },
  makeAdminButton: {
      backgroundColor: '#e7f0fe',
  },
  memberActionButtonText: {
      fontSize: 12,
      fontWeight: '600',
  },
  memberActionButtonTextRemove: {
      color: '#dc3545',
      fontSize: 12,
      fontWeight: '600',
  },
  memberActionButtonTextAdmin: {
      color: '#4285F4',
      fontSize: 12,
      fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto', // Push actions to the right
  },
  headerIconButton: {
    padding: 8, 
    marginLeft: 8, // Spacing between icons
  },
  reloadButton: {
    backgroundColor: '#e2f7fa', // Light cyan background
  },
  // Styles for the highlighted organization card when no orgs exist
  highlightedOrgCard: {
      backgroundColor: '#007BFF', // Bright blue background
      shadowColor: '#007BFF', // Shadow color matching background for glow effect
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 10,
  },
  highlightedOrgTitle: {
      color: '#fff', // White text
      textAlign: 'center', // Center title
  },
  highlightedOrgPromptText: {
      color: '#fff', // White text
      fontSize: 16, // Slightly larger font
      lineHeight: 24, // Improved line spacing
  },
  highlightedOrgButton: {
      // No longer needed for background
  },
  // Style for gradient buttons
  gradientButton: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      // Background color is handled by LinearGradient itself
  },
  // Style for bold text within other text components
  boldText: {
      fontWeight: 'bold',
  },
  saveOfflineButton: {
      backgroundColor: '#17a2b8', // Teal color for save button
      marginBottom: 10,
  },
  saveOfflineButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 10,
  },
  lastSaveText: {
      fontSize: 13,
      color: '#666',
      textAlign: 'center',
      marginTop: 5,
  },
  offlineWarningText: {
      fontSize: 13,
      color: '#ffc107', // Warning color
      textAlign: 'center',
      marginTop: 8,
      fontWeight: '500',
  },
  modalInfoText: { // --- NEW STYLE ---
      fontSize: 13,
      color: '#666',
      textAlign: 'center',
      marginVertical: 10,
      fontStyle: 'italic',
  },
  textArea: {
    height: 100, // Give it some initial height
    textAlignVertical: 'top', // Start text at the top for multiline
  },
  aboutMeText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 15,
    fontStyle: 'italic', // Optional: Style it differently
  },
  linkListContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginTop: 10,
  },
  linkItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#e7f0fe',
    borderRadius: 5,
    marginBottom: 8,
    // full width
    alignSelf: 'stretch',
  },
  linkText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileScreen; 