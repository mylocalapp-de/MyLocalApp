import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert, ActivityIndicator, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  // DEBUG: Log component render and loading state
  console.log(`ProfileScreen rendering - isAccountSettingsLoading: ${isAccountSettingsLoading}`);

  // Use navigation hook
  const navigation = useNavigation();
  
  // Use organization context
  const { 
    memberships,
    activeContext,
    isLoading: orgLoading, // Renamed to avoid conflict
    error: orgError,      // Renamed to avoid conflict
    actions: orgActions
  } = useOrganization();
  
  // Use auth context with Supabase
  const { 
    user, // Supabase auth user object (null if not logged in)
    profile, // Profile data from public.profiles (null if not loaded or doesn't exist)
    preferences, // Preferences (from profile or local storage)
    displayName, // Display name (from profile or local storage)
    signOut, 
    upgradeToFullAccount, 
    resetOnboarding, // Keep for testing?
    updateDisplayName,
    updatePreferences,
    updateEmail,
    updatePassword,
    loadUserProfile, // Add this to use the reload function
    loading: authLoading // Auth context loading state
  } = useAuth();
  
  // State for account creation modal
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmCreatePassword, setConfirmCreatePassword] = useState('');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createFormError, setCreateFormError] = useState('');
  
  // State for manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for profile edit modal
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
  // No current password needed for password update via Supabase Auth
  // const [currentPassword, setCurrentPassword] = useState(''); 
  const [accountSettingsError, setAccountSettingsError] = useState('');
  
  // Ensure loading state is properly initialized
  const [isAccountSettingsLoading, setIsAccountSettingsLoading] = useState(false);

  // Derived state: Check if user has a full Supabase account
  const hasFullAccount = !!user?.id;
  const isOrgContext = activeContext !== 'personal';
  const currentOrganization = isOrgContext ? memberships.find(m => m.id === activeContext) : null;

  // Categories for preferences selection
  const categories = [
    { id: 'kultur', name: 'Kultur', icon: 'film-outline' },
    { id: 'sport', name: 'Sport', icon: 'football-outline' },
    { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
    { id: 'politik', name: 'Politik', icon: 'megaphone-outline' },
    { id: 'vereine', name: 'Vereine', icon: 'people-outline' },
    { id: 'gemeinde', name: 'Gemeinde', icon: 'business-outline' },
  ];
  
  // Toggle preference selection in edit modal
  const togglePreference = (id) => {
    if (editPreferences.includes(id)) {
      setEditPreferences(editPreferences.filter(item => item !== id));
    } else {
      setEditPreferences([...editPreferences, id]);
    }
  };
  
  // Log relevant context state changes
  useEffect(() => {
    console.log('ProfileScreen - User state:', user ? `ID: ${user.id}` : 'No auth user');
    console.log('ProfileScreen - Profile state:', profile);
    console.log('ProfileScreen - Display Name:', displayName);
    console.log('ProfileScreen - Has Full Account:', hasFullAccount);
    console.log('ProfileScreen - Active Context:', activeContext);
    console.log('ProfileScreen - Memberships:', memberships);
    console.log('ProfileScreen - Current Org:', currentOrganization);
    console.log('ProfileScreen - Is Org Context:', isOrgContext);
  }, [user, profile, displayName, preferences, hasFullAccount, activeContext, memberships, currentOrganization, isOrgContext]);

  // Open profile edit modal with current values from context
  const handleOpenProfileEdit = () => {
    if (isOrgContext) {
        Alert.alert("Info", "Profilbearbeitung ist im Organisations-Kontext nicht verfügbar.");
        return;
    }
    setEditDisplayName(displayName || ''); // Use context displayName
    setEditPreferences(preferences || []); // Use context preferences
    setEditFormError('');
    setShowProfileEditModal(true);
  };
  
  // Open account settings modal (only if user has a full account)
  const handleOpenAccountSettings = () => {
    if (!hasFullAccount) {
      Alert.alert(
        'Account benötigt',
        'Bitte erstelle einen Account, um E-Mail und Passwort zu ändern.',
        [{ text: 'OK' }, { text: 'Account erstellen', onPress: handleOpenCreateAccountModal }]
      );
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
        console.log('Account upgrade process successful in AuthContext, user ID:', result.data?.user?.id);
        Alert.alert(
          'Erfolgreich',
          'Dein Account wurde erstellt. Du bist jetzt eingeloggt.'
        );
        setShowCreateAccountModal(false);
        // Reload memberships after account creation
        await orgActions.fetchMemberships();
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
  
  // Save profile changes (Name and Preferences)
  const handleSaveProfile = async () => {
    if (isOrgContext) return; // Should not be called in org context

    console.log('Saving profile changes...');
    console.log('New display name:', editDisplayName);
    console.log('New preferences:', editPreferences);
    
    if (!editDisplayName.trim()) {
      setEditFormError('Bitte gib einen Benutzernamen ein.');
      return;
    }
    if (editPreferences.length === 0) {
      setEditFormError('Bitte wähle mindestens eine Präferenz aus.');
      return;
    }
    
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
              nameWarning = nameResult.warning; // Capture potential warning even on failure
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
      
      setIsEditLoading(false); // Stop loading indicator

      if (nameUpdateSuccess && prefUpdateSuccess) {
          if (nameWarning || prefWarning) {
              Alert.alert(
                  'Teilweise erfolgreich',
                  'Deine Änderungen wurden lokal gespeichert, aber es gab Probleme bei der Server-Synchronisierung.'
              );
          } else {
              Alert.alert('Erfolgreich', 'Profil aktualisiert.');
          }
          setShowProfileEditModal(false); // Close modal on full success or partial success with warning
      } else {
          // Error message is already set in the form
          if (nameWarning || prefWarning) {
              Alert.alert(
                  'Hinweis',
                  'Änderungen lokal übernommen, aber Datenbank-Update fehlgeschlagen.'
              ); 
              // Optionally close modal even on DB failure?
              // setShowProfileEditModal(false); 
          }
      }

    } catch (error) {
      console.error('Unexpected error during profile update:', error);
      setEditFormError('Ein unerwarteter Fehler ist aufgetreten.');
      setIsEditLoading(false);
    }
  };
  
  // Handle email update
  const handleUpdateEmail = async () => {
    console.log('Updating email...');
    
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAccountSettingsError('Bitte gib eine gültige neue E-Mail-Adresse ein.');
      return;
    }
    // Check if email is actually different
    if (newEmail.trim() === user?.email) {
       setAccountSettingsError('Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden.');
       return;
    }
    if (!emailCurrentPassword) {
      setAccountSettingsError('Bitte gib dein aktuelles Passwort ein, um die Änderung zu bestätigen.');
      return;
    }
    
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    
    try {
      // Use the updated context function which requires the current password
      const result = await updateEmail(newEmail.trim(), emailCurrentPassword);
      
      if (result.success) {
        // Only close modal on success
        setShowAccountSettingsModal(false);
        if (result.needsConfirmation) {
           Alert.alert(
              'Bestätigung erforderlich', 
              'Wir haben eine Bestätigungs-E-Mail an deine neue Adresse gesendet. Bitte klicke auf den Link darin, um die Änderung abzuschließen.'
           );
        } else {
            Alert.alert('Erfolgreich', 'Deine E-Mail-Adresse wurde aktualisiert.');
        }
      } else {
        console.error('Failed to update email:', result.error);
        // Check for specific rate-limiting error
        const errorMessage = result.error?.message || 'E-Mail konnte nicht geändert werden.';
        if (errorMessage.includes('For security purposes')) {
            setAccountSettingsError('Aus Sicherheitsgründen können Sie diese Anfrage erst nach kurzer Wartezeit erneut stellen. Bitte versuchen Sie es später noch einmal.');
        } else if (errorMessage.includes('Invalid user credentials')) { // Catch incorrect password
            setAccountSettingsError('Falsches aktuelles Passwort. Bitte versuche es erneut.');
        } else {
            setAccountSettingsError(errorMessage);
        }
      }
    } catch (error) {
      console.error('Unexpected error during email update:', error);
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      // Always stop loading, regardless of success or failure
      setIsAccountSettingsLoading(false);
      // DEBUG: Confirm state update executed
      console.log('ProfileScreen: setIsAccountSettingsLoading(false) executed.');
    }
  };
  
  // Handle password update
  const handleUpdatePassword = async () => {
    console.log('ProfileScreen: Attempting password update...');

    // No current password needed for Supabase Auth update
    // if (!currentPassword.trim()) { ... }

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
      // Use the updated context function which only needs the new password
      console.log('ProfileScreen: Calling AuthContext.updatePassword...');
      const result = await updatePassword(newPassword);
      console.log('ProfileScreen: AuthContext.updatePassword result:', result);

      if (result.success) {
        console.log('ProfileScreen: Password update successful. Closing modal and alerting.');
        // Only close modal on success and show alert immediately
        // Do not wait for the background profile refresh
        setShowAccountSettingsModal(false);
        Alert.alert(
          'Erfolgreich',
          'Dein Passwort wurde aktualisiert.'
        );
        // Setting loading false is handled by finally block
      } else {
        console.error('ProfileScreen: Failed to update password:', result.error);
        // Provide more specific feedback if possible (e.g., new password is same as old)
        setAccountSettingsError(result.error?.message || 'Passwort konnte nicht geändert werden.');
        // Setting loading false is handled by finally block
      }
    } catch (error) {
      console.error('ProfileScreen: Unexpected error during password update:', error);
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
       // Setting loading false is handled by finally block
    } finally {
      // Always stop loading, regardless of success or failure
      console.log('ProfileScreen: Resetting loading state in finally block.');
      setIsAccountSettingsLoading(false);
      // DEBUG: Confirm state update executed
      console.log('ProfileScreen: setIsAccountSettingsLoading(false) executed.');
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      "Abmelden",
      "Möchtest du dich wirklich abmelden?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            console.log('Signing out...');
            // Ensure context is switched to personal before signing out
            if (activeContext !== 'personal') {
                await orgActions.switchContext('personal');
            }
            const { success, error } = await signOut();
            
            if (!success) {
              console.error('Sign out failed:', error);
              Alert.alert("Fehler", `Abmeldung fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`);
              return;
            }
            
            console.log('Sign out successful, navigation will be handled by AppNavigator');
            // No need to manually navigate - the AuthContext will set hasCompletedOnboarding to false,
            // which will cause AppNavigator to show the WelcomeScreen
          },
        },
      ]
    );
  };
  
  // Handle reset onboarding (for development/testing)
  const handleResetOnboarding = async () => {
    Alert.alert(
      "Onboarding zurücksetzen",
      "Möchtest du wirklich zum Willkommensbildschirm zurückkehren und lokale Daten löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Zurücksetzen",
          style: "destructive",
          onPress: async () => {
            await orgActions.switchContext('personal'); // Reset context before resetting onboarding
            await resetOnboarding();
          },
        },
      ]
    );
  };

  // Add a function to manually reload the user profile and memberships
  const handleRefreshProfile = async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      console.log('Manually refreshing profile & memberships for user:', user.id);
      await loadUserProfile(user.id); // Reload profile from AuthContext
      await orgActions.fetchMemberships(); // Reload memberships from OrgContext
      Alert.alert('Aktualisiert', 'Dein Profil und deine Organisations-Daten wurden aktualisiert.');
    } catch (error) {
      console.error('Error refreshing profile/memberships:', error);
      Alert.alert("Fehler", "Profil konnte nicht aktualisiert werden.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchContext = async (orgId) => {
    Alert.alert(
        `Kontext wechseln zu ${memberships.find(m => m.id === orgId)?.name || 'Organisation'}?`,
        "Deine Ansicht und Berechtigungen ändern sich entsprechend.",
        [
            { text: "Abbrechen", style: "cancel" },
            { text: "Wechseln", onPress: async () => await orgActions.switchContext(orgId) }
        ]
    );
  };

  const handleSwitchToPersonal = async () => {
    await orgActions.switchContext('personal');
  };

  const handleLeaveOrganization = (orgId, orgName) => {
      Alert.alert(
          `Organisation verlassen?`,
          `Möchtest du ${orgName} wirklich verlassen? Diese Aktion kann nicht rückgängig gemacht werden.`,
          [
              { text: "Abbrechen", style: "cancel" },
              {
                  text: "Verlassen",
                  style: "destructive",
                  onPress: async () => {
                      const result = await orgActions.leaveOrganization(orgId);
                      if (result.success) {
                          Alert.alert("Erfolgreich", `Du hast ${orgName} verlassen.`);
                      } else {
                          Alert.alert("Fehler", result.error?.message || "Austritt fehlgeschlagen.");
                      }
                  }
              }
          ]
      );
  };

  const copyInviteCode = (code) => {
      if (code) {
          Clipboard.setString(code);
          Alert.alert("Kopiert", "Einladungscode wurde in die Zwischenablage kopiert.");
      } else {
          Alert.alert("Fehler", "Kein Einladungscode verfügbar.");
      }
  };

  // --- Render Functions --- 

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <Image
        // Use Org logo if in Org Context, otherwise placeholder
        source={currentOrganization?.logoUrl ? { uri: currentOrganization.logoUrl } : require('../../assets/avatar_placeholder.png')}
        style={styles.avatar}
      />
      <View style={styles.profileInfo}>
        <Text style={styles.displayName}>
            {/* Show Org Name if in Org Context, otherwise User Display Name */} 
            {isOrgContext ? currentOrganization?.name : (displayName || 'Gast')}
        </Text>
        {hasFullAccount ? (
          // Show User Email if personal, or Role in Org if Org Context
          <Text style={styles.email}>
            {isOrgContext ? `Rolle: ${currentOrganization?.role === 'admin' ? 'Administrator' : 'Mitglied'}` : user.email}
          </Text>
        ) : (
          <Text style={styles.accountStatus}>Lokaler Account (nicht synchronisiert)</Text>
        )}
      </View>
      {/* Only show edit button in personal context */} 
      {!isOrgContext && (
        <TouchableOpacity
            style={styles.editProfileButton}
            onPress={handleOpenProfileEdit}
        >
            <Ionicons name="pencil" size={18} color="#4285F4" />
        </TouchableOpacity>
      )}
      {/* Refresh works in both contexts */} 
      {hasFullAccount && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshProfile}
          disabled={isRefreshing || orgLoading || authLoading} // Disable if any loading
        >
          {isRefreshing || orgLoading || authLoading ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <Ionicons name="refresh-circle" size={22} color="#4285F4" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPreferencesSection = () => {
    // Only show personal preferences in personal context
    if (isOrgContext) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deine Interessen</Text>
        {preferences && preferences.length > 0 ? (
          <View style={styles.preferencesContainer}>
            {preferences.map((pref) => {
               const category = categories.find(cat => cat.id === pref);
               return (
                 <View key={pref} style={styles.preferenceChip}>
                   <Ionicons 
                      name={category?.icon || 'help-circle-outline'} 
                      size={16} 
                      color="#4285F4" 
                      style={styles.preferenceIcon}
                   />
                   <Text style={styles.preferenceText}>{category?.name || pref}</Text>
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
          <Text style={styles.editButtonText}>Präferenzen bearbeiten</Text>
          <Ionicons name="chevron-forward" size={16} color="#4285F4" />
        </TouchableOpacity>
      </View>
    );
  };

  // New section for Organizations
  const renderOrganizationSection = () => {
    // Don't show if user isn't logged in
    if (!hasFullAccount) return null;

    // --- A: Currently in Organization Context ---
    if (isOrgContext && currentOrganization) {
      return (
        <View style={styles.section}>
          <View style={styles.orgSectionHeader}>
             <Text style={styles.sectionTitle}>Organisation: {currentOrganization.name}</Text>
             <TouchableOpacity style={styles.switchContextButton} onPress={handleSwitchToPersonal}>
                <Text style={styles.switchContextButtonText}>Zu Persönlich wechseln</Text>
             </TouchableOpacity>
          </View>

          {/* TODO: Display List of Members */} 
          <View style={styles.settingItem}>
              <Ionicons name="people-outline" size={24} style={styles.settingIcon} />
              <Text style={styles.settingText}>Mitglieder (TODO)</Text>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>

          {/* Display Invite Code if Admin */} 
          {currentOrganization.role === 'admin' && currentOrganization.inviteCode && (
             <TouchableOpacity
                 style={styles.settingItem}
                 onPress={() => copyInviteCode(currentOrganization.inviteCode)}
             >
                 <Ionicons name="qr-code-outline" size={24} style={styles.settingIcon} />
                 <View style={styles.settingTextContainer}>
                     <Text style={styles.settingText}>Einladungscode:</Text>
                     <Text style={styles.inviteCodeText}>{currentOrganization.inviteCode}</Text>
                 </View>
                 <Ionicons name="copy-outline" size={20} color="#4285F4" />
             </TouchableOpacity>
          )}

          {/* Leave Organization Button */} 
           <TouchableOpacity
              style={[styles.settingItem, styles.leaveOrgButton]}
              onPress={() => handleLeaveOrganization(currentOrganization.id, currentOrganization.name)}
           >
              <Ionicons name="exit-outline" size={24} style={[styles.settingIcon, styles.signOutIcon]} />
              <Text style={[styles.settingText, styles.signOutText]}>Organisation verlassen</Text>
           </TouchableOpacity>
        </View>
      );
    }

    // --- B: Currently in Personal Context --- 
    if (!isOrgContext) {
        // If user has memberships, show list to switch
        if (memberships.length > 0) {
            return (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Deine Organisationen</Text>
                    {memberships.map(org => (
                        <TouchableOpacity
                            key={org.id}
                            style={styles.settingItem}
                            onPress={() => handleSwitchContext(org.id)}
                        >
                            {/* You might want org logos here too */} 
                            <Ionicons name="business-outline" size={24} style={styles.settingIcon} />
                            <Text style={styles.settingText}>Als {org.name} agieren</Text>
                            <Ionicons name="swap-horizontal-outline" size={20} color="#4285F4" />
                        </TouchableOpacity>
                    ))}
                     {/* Option to join/create another one */} 
                     <TouchableOpacity
                        style={[styles.settingItem, styles.orgActionCta]}
                        onPress={() => navigation.navigate('OrganizationOnboarding')} // Navigate to the new screen
                    >
                        <Ionicons name="add-circle-outline" size={24} style={[styles.settingIcon, styles.orgActionIcon]} />
                        <Text style={[styles.settingText, styles.orgActionText]}>Weitere Organisation beitreten/erstellen</Text>
                        <Ionicons name="chevron-forward" size={20} color="#4285F4" />
                    </TouchableOpacity>
                </View>
            );
        } else {
            // User has no memberships, show the CTA block
            return (
                <View style={styles.ctaCard}>
                    <Text style={styles.ctaTitle}>Du bist ein Verein, Gemeinde oder Unternehmen?</Text>
                    <Text style={styles.ctaDescription}>Jetzt eigene Artikel veröffentlichen, Gruppen erstellen oder Veranstaltungen eintragen!</Text>
                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => navigation.navigate('OrganizationOnboarding')} // Navigate to the new screen
                    >
                        <Text style={styles.ctaButtonText}>Organisation beitreten / erstellen</Text>
                    </TouchableOpacity>
                </View>
            );
        }
    }

    return null; // Should not happen if logic is correct
  };

  const renderAccountSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Einstellungen & Account</Text>
      {hasFullAccount ? (
        // Logged in user: Show account settings
        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleOpenAccountSettings}
        >
          <Ionicons name="settings-outline" size={24} style={styles.settingIcon} />
          <Text style={styles.settingText}>E-Mail & Passwort ändern</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      ) : (
        // Anonymous user: Show Create Account button
        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleOpenCreateAccountModal}
        >
          <Ionicons name="person-add-outline" size={24} style={styles.settingIcon} />
          <Text style={styles.settingText}>Account erstellen & Daten sichern</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      )}
      {/* Always show logout button */}
      <TouchableOpacity
        style={[styles.settingItem, styles.signOutButton]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={24} style={[styles.settingIcon, styles.signOutIcon]} />
        <Text style={[styles.settingText, styles.signOutText]}>Abmelden</Text>
      </TouchableOpacity>
      {/* Reset Onboarding for testing - maybe hide in production */}
      {/* <TouchableOpacity style={[styles.settingItem, styles.resetButton]} onPress={handleResetOnboarding}>
         <Ionicons name="refresh-outline" size={24} style={[styles.settingIcon, styles.resetIcon]} />
         <Text style={[styles.settingText, styles.resetText]}>Reset Onboarding (Dev)</Text>
      </TouchableOpacity> */}
    </View>
  );

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

  // --- Main Return --- 
  
  // Show loading indicator while auth or org context is initializing/loading
  if (authLoading || (user && orgLoading && memberships.length === 0)) { // Show org loading only if logged in and no memberships yet
      return (
          <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
          </View>
      );
  }

  return (
    <ScrollView style={styles.container}>
      {renderProfileHeader()}
      {renderPreferencesSection()} 
      {renderOrganizationSection()} 
      {renderAccountSection()}

      {/* Display Org Context Error */} 
      {orgError && <Text style={styles.errorTextGlobal}>{orgError}</Text>}

      {/* Modals */} 
      {renderCreateAccountModal()}
      {renderProfileEditModal()}
      {renderAccountSettingsModal()} 
    </ScrollView>
  );
};

// --- Styles --- 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: '#e0e0e0', // Placeholder background
    borderWidth: 1,
    borderColor: '#ddd', // Add a subtle border
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#666',
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
  section: {
    marginTop: 15,
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orgSectionHeader: { // Style for the header within the org section
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15, 
  },
  switchContextButton: {
      backgroundColor: '#e7f0fe',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 15,
  },
  switchContextButtonText: {
      color: '#4285F4',
      fontSize: 12,
      fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    // Removed marginBottom here, handle spacing in parent or header
  },
  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f0fe', // Light blue background
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
    color: '#4285F4', // Blue text
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
    alignSelf: 'flex-start', // Don't stretch full width
    marginTop: 5,
  },
  editButtonText: {
    color: '#4285F4',
    fontSize: 14,
    marginRight: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingIcon: {
    marginRight: 15,
    color: '#666',
    width: 24, // Ensure icons align
    textAlign: 'center',
  },
  settingTextContainer: { // Added container for text alignment
      flex: 1,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  inviteCodeText: { // Specific style for the invite code
      fontSize: 14,
      color: '#555',
      fontStyle: 'italic',
      marginTop: 2,
  },
  signOutButton: {
    borderBottomWidth: 0, // No border for the last item
    marginTop: 10,
  },
  signOutIcon: {
    color: '#dc3545', // Red color for sign out
  },
  signOutText: {
    color: '#dc3545', // Red color for sign out
    fontWeight: '600',
  },
  leaveOrgButton: {
      borderBottomWidth: 0,
      borderTopWidth: 1, // Separate leave button visually
      borderTopColor: '#eee',
      marginTop: 15,
      paddingTop: 15,
  },
  resetButton: {
      borderBottomWidth: 0,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#eee',
      paddingTop: 15,
  },
  resetIcon: {
      color: '#ffc107', // Warning color
  },
  resetText: {
      color: '#ffc107', // Warning color
      fontWeight: '600',
  },
  orgActionCta: {
      borderTopWidth: 1,
      borderTopColor: '#eee',
      marginTop: 10,
      paddingTop: 15,
      borderBottomWidth: 0,
  },
  orgActionIcon: {
      color: '#4285F4',
  },
  orgActionText: {
      color: '#4285F4',
      fontWeight: '500',
  },
  // Styles for the CTA Card (when user has no orgs)
  ctaCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginHorizontal: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#4285F4',
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal Styles (mostly unchanged)
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
  errorTextGlobal: { // Style for global errors (like org context errors)
      color: '#dc3545',
      fontSize: 14,
      textAlign: 'center',
      padding: 10,
      backgroundColor: '#f8d7da',
      marginHorizontal: 15,
      marginTop: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: '#f5c6cb',
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
    flex: 1, // Make buttons take equal width
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
   buttonDisabled: {
    opacity: 0.7,
  },
  singleButton: {
      marginHorizontal: 0, // No horizontal margin when it's the only button
      marginTop: 10,
  },
  marginTop: {
      marginTop: 10,
  },

  // Styles for Preferences in Modal
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

  // Tab Styles for Account Settings Modal
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
  refreshButton: {
    padding: 8,
    marginLeft: 10,
  },
});

export default ProfileScreen; 