import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert, ActivityIndicator, Clipboard, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useNetwork } from '../context/NetworkContext';
import { supabase } from '../lib/supabase';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 3% of screen height for Android

const ProfileScreen = () => {
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
    // Get moved functions from OrganizationContext
    fetchOrganizationMembers, 
    updateOrganizationDetails, // Assuming this will be used later
    updateOrganizationName,
    removeOrganizationMember,
    transferOrganizationAdmin
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
    profile,
    preferences,
    displayName,
    userOrganizations,
    // fetchOrganizationMembers, // REMOVE
    leaveOrganization, // Keep: User leaves, part of Auth context
    signOut, 
    upgradeToFullAccount, 
    // updateDisplayName, // Keep: Relates to user profile
    // updatePreferences, // Keep: Relates to user profile
    // updateEmail, // Keep: Relates to user auth
    // updatePassword, // Keep: Relates to user auth
    loadUserProfile, 
    loading: authLoading,
    // updateOrganizationName, // REMOVE
    createOrganization, // Keep: User creates, part of Auth context
    joinOrganizationByInviteCode, // Keep: User joins, part of Auth context
    deleteCurrentUserAccount 
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
  
  // State for Organization Management
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [orgMgmtError, setOrgMgmtError] = useState('');
  const [memberManagementLoading, setMemberManagementLoading] = useState(false);
  // State for Org Edit Modal
  const [showOrgEditModal, setShowOrgEditModal] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [isOrgEditLoading, setIsOrgEditLoading] = useState(false);
  const [orgEditError, setOrgEditError] = useState('');


  // Derived state: Check if user has a full Supabase account
  const hasFullAccount = !!user?.id;
  
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
  
  // Helper function to reload members
  const reloadMembers = useCallback(async () => {
    // Ensure user is logged in and org context is active
    if (user && isOrganizationActive && activeOrganizationId) {
      setIsFetchingMembers(true);
      setOrgMgmtError('');
      console.log(`[ProfileScreen] Calling fetchOrganizationMembers (from OrgContext) for org: ${activeOrganizationId}`);
      // Use fetchOrganizationMembers directly from useOrganization context
      const result = await fetchOrganizationMembers(activeOrganizationId);
      if (result.success) {
          console.log("[ProfileScreen] Members received:", result.data);
          setOrganizationMembers(result.data || []);
      } else {
          console.error("[ProfileScreen] Error fetching members:", result.error);
          setOrgMgmtError(result.error?.message || 'Mitglieder konnten nicht geladen werden.');
          setOrganizationMembers([]);
      }
      setIsFetchingMembers(false);
    }
  }, [user, isOrganizationActive, activeOrganizationId, fetchOrganizationMembers]); // Add fetchOrganizationMembers dependency

  // Fetch organization members when context becomes active (use the helper)
  useEffect(() => {
    reloadMembers();
  }, [reloadMembers]); // Depend on the memoized function

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
      console.log(`Attempting account upgrade for email: ${createEmail}`);
      const result = await upgradeToFullAccount(createEmail, createPassword);

      if (result.success) {
        console.log('Account upgrade process successful in AuthContext');
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
    
    console.log('Saving personal profile changes...');
    
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
    
    let nameUpdateSuccess = true;
    let prefUpdateSuccess = true;
    let nameWarning = null;
    let prefWarning = null;

    try {
      // Update display name if changed
      if (editDisplayName !== displayName) {
          const nameResult = await updateDisplayName(editDisplayName);
          if (!nameResult.success) {
              console.error('Failed to update display name:', nameResult.error);
              setEditFormError(nameResult.error?.message || 'Fehler beim Speichern des Namens.');
              nameWarning = nameResult.warning;
              nameUpdateSuccess = false;
          } else {
              nameWarning = nameResult.warning;
          }
      }

      // Update preferences if changed
      const preferencesChanged = JSON.stringify(editPreferences.sort()) !== JSON.stringify((preferences || []).sort());
      if (preferencesChanged) {
          const prefResult = await updatePreferences(editPreferences);
          if (!prefResult.success) {
              console.error('Failed to update preferences:', prefResult.error);
              setEditFormError(prev => 
                  prev ? `${prev} ${prefResult.error?.message || 'Fehler beim Speichern der Präferenzen.'}` 
                  : (prefResult.error?.message || 'Fehler beim Speichern der Präferenzen.')
              );
              prefWarning = prefResult.warning;
              prefUpdateSuccess = false;
          } else {
              prefWarning = prefResult.warning;
          }
      }
      
      setIsEditLoading(false);

      if (nameUpdateSuccess && prefUpdateSuccess) {
          if (nameWarning || prefWarning) {
              Alert.alert(
                  'Teilweise erfolgreich',
                  'Deine Änderungen wurden lokal gespeichert, aber es gab Probleme bei der Server-Synchronisierung.'
              );
          } else {
              Alert.alert('Erfolgreich', 'Profil aktualisiert.');
          }
          setShowProfileEditModal(false);
      } else {
          if (nameWarning || prefWarning) {
              Alert.alert(
                  'Hinweis',
                  'Änderungen lokal übernommen, aber Datenbank-Update fehlgeschlagen.'
              ); 
          }
      }

    } catch (error) {
      console.error('Unexpected error during profile update:', error);
      setEditFormError('Ein unerwarteter Fehler ist aufgetreten.');
      setIsEditLoading(false);
    }
  };
  
  // --- NEW: Open Org Edit Modal ---
  const handleOpenOrgEdit = () => {
    if (!isOrganizationActive || !activeOrganization) return;
    setEditOrgName(activeOrganization.name || '');
    setOrgEditError('');
    setShowOrgEditModal(true);
  };

  // --- NEW: Save Org Name ---
  const handleSaveOrgName = async () => {
    if (!isOrganizationActive || !activeOrganizationId) return;
    if (!editOrgName.trim()) {
      setOrgEditError('Organisationsname darf nicht leer sein.');
      return;
    }
    if (editOrgName.trim() === activeOrganization?.name) {
      setShowOrgEditModal(false); // Nothing changed
      return;
    }

    setIsOrgEditLoading(true);
    setOrgEditError('');

    try {
      // Use updateOrganizationName from useOrganization context
      const result = await updateOrganizationName(activeOrganizationId, editOrgName.trim());
      if (result.success) {
        Alert.alert('Erfolg', 'Organisationsname aktualisiert.');
        setShowOrgEditModal(false);
        // Active organization name in OrganizationContext will update automatically 
        // because updateOrganizationName calls loadUserProfileAndOrgs, which updates userOrganizations,
        // and OrganizationContext has a useEffect listening to userOrganizations to update its state.
        // A direct update here might cause race conditions.
        // You *could* potentially update the `activeOrganization` state in *this* component
        // immediately for faster UI feedback, but it's usually better to rely on the context flow.
      } else {
        console.error("Failed to update org name:", result.error);
        setOrgEditError(result.error?.message || 'Fehler beim Speichern des Namens.');
      }
    } catch (error) {
      console.error('Unexpected error saving org name:', error);
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
    // No password needed if confirmation disabled
    // if (!emailCurrentPassword) {
    //   setAccountSettingsError('Bitte gib dein aktuelles Passwort ein, um die Änderung zu bestätigen.');
    //   return;
    // }
    
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    
    try {
      const result = await updateEmail(newEmail.trim(), emailCurrentPassword);
      
      if (result.success) {
        setShowAccountSettingsModal(false);
        Alert.alert('Erfolgreich', 'Deine E-Mail-Adresse wurde aktualisiert.');
        // No confirmation needed now
        // if (result.needsConfirmation) { ... } else { ... }
      } else {
        console.error('Failed to update email:', result.error);
        const errorMessage = result.error?.message || 'E-Mail konnte nicht geändert werden.';
        setAccountSettingsError(errorMessage);
      }
    } catch (error) {
      console.error('Unexpected error during email update:', error);
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
        setShowAccountSettingsModal(false);
        Alert.alert('Erfolgreich', 'Dein Passwort wurde aktualisiert.');
      } else {
        console.error('Failed to update password:', result.error);
        setAccountSettingsError(result.error?.message || 'Passwort konnte nicht geändert werden.');
      }
    } catch (error) {
      console.error('Unexpected error during password update:', error);
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
            [{ text: "OK", onPress: () => loadUserProfile() }]
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
    const currentUserRole = isOrganizationActive && activeOrganization ? activeOrganization.currentUserRole : null;
    const headerTitle = isOrganizationActive ? `Organisation: ${currentOrgName || '... '}` : 'Dein Profil';
    const avatarInitial = isOrganizationActive ? (currentOrgName?.charAt(0) || 'O') : (displayName?.charAt(0) || '?');
    const isAdmin = isOrganizationActive && currentUserRole === 'admin'; // Use derived role
    
    return (
      <View style={styles.profileHeader}>
         <View style={[styles.avatar, isOrganizationActive && styles.orgAvatar]}>
            <Text style={styles.avatarLetter}>{avatarInitial}</Text>
        </View>
        <View style={styles.profileInfo}>
           <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          {hasFullAccount && !isOrganizationActive && (
             <Text style={styles.email}>{user?.email || ''}</Text>
          )}
          {!hasFullAccount && (
            <Text style={styles.accountStatus}>Lokaler Account (nicht synchronisiert)</Text>
          )}
          {/* Maybe show user role within org? */} 
          {isOrganizationActive && currentUserRole && ( // Check currentUserRole exists
             <Text style={styles.roleText}>Deine Rolle: {currentUserRole === 'admin' ? 'Administrator' : 'Mitglied'}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {/* Personal Profile Edit Button - shown for local AND logged-in users when NOT in org context */}
          {!isOrganizationActive && (
            <>
              <TouchableOpacity 
                  style={styles.headerIconButton}
                  onPress={handleOpenProfileEdit}
              >
                  <Ionicons name="pencil" size={20} color="#4285F4" />
              </TouchableOpacity>
              {/* Personal Context Reload Button */}
              <TouchableOpacity
                  style={styles.headerIconButton} 
                  onPress={() => loadUserProfile(user?.id)} // Reload personal profile/orgs
                  disabled={authLoading} // Disable while auth context is loading
              >
                  <Ionicons name="refresh-outline" size={22} color="#4285F4" />{/* Blue color for personal */}
              </TouchableOpacity>
            </>
          )}
          {/* Org Actions Wrapper (Edit + Reload) - Show only when org active */}
          {isOrganizationActive && (
            <>
              {/* Org Edit Button - Show only for admin when org active */} 
              {isAdmin === true && (
                  <TouchableOpacity
                      style={styles.headerIconButton} // Use consistent styling
                      onPress={handleOpenOrgEdit}
                  >
                      <Ionicons name="pencil" size={20} color="#34A853" />
                  </TouchableOpacity>
              )}
              {/* Org Reload Button - Show for admin and members when org active */} 
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
        console.log("ProfileScreen: renderOrgManagementSection - Bailing out due to missing activeOrganization data.");
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
              {/* Organization Selection/Creation - Show ONLY for logged-in users */}
              {hasFullAccount && (
                <View style={[
                    styles.card, 
                    // Apply special styling if the user has no organizations
                    hasNoOrganizations && styles.highlightedOrgCard 
                ]}>
                    <Text style={[
                        styles.cardTitle,
                        // White text for highlighted card
                        hasNoOrganizations && styles.highlightedOrgTitle
                    ]}>Organisationen</Text>
                    
                    {/* Show existing organizations OR the highlighted prompt */}
                    {userOrganizations && userOrganizations.length > 0 ? (
                        <View>
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
                            <View style={styles.separator} />
                        </View>
                    ) : (
                         <Text style={[
                             styles.orgPromptText, 
                             hasNoOrganizations && styles.highlightedOrgPromptText
                         ]}>
                             Werde <Text style={styles.boldText}>aktiv</Text> und <Text style={styles.boldText}>gestalte</Text> die App mit!
                         </Text>
                     )}
                     {/* Second part of the text, only shown when no organizations exist */}
                     {hasNoOrganizations && (
                         <Text style={[styles.orgPromptText, styles.highlightedOrgPromptText]}>
                             Veröffentliche <Text style={styles.boldText}>Artikel</Text>, gründe <Text style={styles.boldText}>Gruppen</Text> oder trage <Text style={styles.boldText}>Veranstaltungen</Text> ein – Entdecke die Möglichkeiten!
                         </Text>
                     )}
                     
                     <TouchableOpacity 
                       style={[
                           // Apply standard button style only if NOT highlighted
                           !hasNoOrganizations && styles.primaryButton,
                           { marginTop: 10 } // Apply margin always
                       ]} 
                       onPress={() => navigation.navigate('OrganizationSetup')}
                     >
                        {hasNoOrganizations ? (
                          // Render gradient button when highlighted
                          <LinearGradient
                            colors={['#7b4397', '#dc2430']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.gradientButton}
                          >
                            <Ionicons name="business-outline" size={20} color="#fff" style={styles.buttonIcon} />
                            <Text style={styles.primaryButtonText}>Organisation erstellen / beitreten</Text>
                          </LinearGradient>
                        ) : (
                          // Render standard button content when not highlighted
                          <>
                            <Ionicons name="business-outline" size={20} color="#fff" style={styles.buttonIcon} />
                            <Text style={styles.primaryButtonText}>Organisation erstellen / beitreten</Text>
                          </>
                        )}
                     </TouchableOpacity>
                </View>
              )}

              {/* Personal Preferences - Show for both local and logged-in */}
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
          </>
      );
  };

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
          
          {/* Tabs */} 
          <View style={styles.tabContainer}>
             <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'email' && styles.tabButtonActive]}
                onPress={() => {setActiveTab('email'); setAccountSettingsError('');}}
             >
                 <Text style={[styles.tabText, activeTab === 'email' && styles.tabTextActive]}>E-Mail ändern</Text>
             </TouchableOpacity>
             <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'password' && styles.tabButtonActive]}
                onPress={() => {setActiveTab('password'); setAccountSettingsError('');}}
             >
                 <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>Passwort ändern</Text>
             </TouchableOpacity>
          </View>
          
          {/* Content based on active tab */} 
          {activeTab === 'email' && (
             <View>
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
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton, styles.singleButton, isAccountSettingsLoading && styles.buttonDisabled]} 
                  onPress={handleUpdateEmail}
                  disabled={isAccountSettingsLoading}
                >
                  {isAccountSettingsLoading ? 
                     <ActivityIndicator color="#fff" size="small" /> : 
                     <Text style={styles.modalButtonText}>E-Mail Aktualisieren</Text> 
                  }
                </TouchableOpacity>
             </View>
          )}
          
          {activeTab === 'password' && (
             <View>
                {/* Current password field removed as not needed for Supabase update */} 
                <Text style={styles.inputLabel}>Neues Passwort</Text>
                <TextInput
                   style={styles.input}
                   placeholder="Neues Passwort (min. 6 Zeichen)"
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
                 <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton, styles.singleButton, isAccountSettingsLoading && styles.buttonDisabled]} 
                  onPress={handleUpdatePassword}
                  disabled={isAccountSettingsLoading}
                 >
                  {isAccountSettingsLoading ? 
                     <ActivityIndicator color="#fff" size="small" /> : 
                     <Text style={styles.modalButtonText}>Passwort Aktualisieren</Text>
                  }
                 </TouchableOpacity>
             </View>
          )}
          
          <TouchableOpacity 
            style={[styles.modalButton, styles.cancelButton, styles.marginTop]} 
            onPress={() => setShowAccountSettingsModal(false)}
            disabled={isAccountSettingsLoading}
          >
            <Text style={styles.modalButtonText}>Abbrechen</Text>
          </TouchableOpacity>

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
              onPress={handleSaveOrgName}
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


  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {renderHeader()}

      {/* Show EITHER Org Management OR Personal Sections */}
      {isOrganizationActive ? (
         renderOrgManagementSection()
      ) : (
         <>
            {/* Show "Create Permanent Account" card ONLY if user has NO full account */}
            {!hasFullAccount && renderNoAccountSection()}
            
            {/* Show Personal Profile Section for BOTH local and logged-in users when not in org mode */}
            {renderPersonalProfileSection()} 
         </>
      )}

      {/* Sign Out Button - Always shown for personal context */} 
      {!isOrganizationActive && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
            disabled={isAccountSettingsLoading} // Disable if delete is in progress
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
                  disabled={isAccountSettingsLoading} // Disable during sign out/delete
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
      {renderAccountSettingsModal()}
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
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    marginRight: 15,
    backgroundColor: '#4285F4', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAvatar: {
      backgroundColor: '#34A853', // Different color for orgs
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
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
    color: '#333', // Darker text for better contrast on gray background
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
});

export default ProfileScreen; 