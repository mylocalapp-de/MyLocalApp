import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert, ActivityIndicator, FlatList, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

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
    isLoading: isOrgContextLoading, // Renamed to avoid clash
  } = useOrganization();

  // Use auth context with Supabase
  const { 
    user, // Supabase auth user object (null if not logged in)
    profile, // Profile data from public.profiles (null if not loaded or doesn't exist)
    preferences, // Preferences (from profile or local storage)
    displayName, // Display name (from profile or local storage)
    userOrganizations, // List of orgs user is member of [{id, name, role}, ...]
    fetchOrganizationMembers, // Function to get member list
    leaveOrganization, // Function to leave an org
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
  
  // Fetch organization members when context becomes active
  useEffect(() => {
    const loadMembers = async () => {
      if (isOrganizationActive && activeOrganizationId) {
        setIsFetchingMembers(true);
        setOrgMgmtError('');
        const result = await fetchOrganizationMembers(activeOrganizationId);
        if (result.success) {
          setOrganizationMembers(result.data || []);
        } else {
          setOrgMgmtError(result.error?.message || 'Mitglieder konnten nicht geladen werden.');
          setOrganizationMembers([]);
        }
        setIsFetchingMembers(false);
      }
    };
    loadMembers();
  }, [isOrganizationActive, activeOrganizationId, fetchOrganizationMembers]);

  // Log relevant context state changes (DEBUG)
  useEffect(() => {
    console.log('ProfileScreen - User state:', user ? `ID: ${user.id}, Email: ${user.email}` : 'No auth user');
    console.log('ProfileScreen - Profile state:', profile);
    console.log('ProfileScreen - Display Name:', displayName);
    console.log('ProfileScreen - Preferences:', preferences);
    console.log('ProfileScreen - Has Full Account:', hasFullAccount);
    console.log('ProfileScreen - User Organizations:', userOrganizations);
    console.log('ProfileScreen - Is Org Active:', isOrganizationActive);
    console.log('ProfileScreen - Active Org Details:', activeOrganization);
  }, [user, profile, displayName, preferences, hasFullAccount, userOrganizations, isOrganizationActive, activeOrganization]);

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
            const { success, error } = await signOut();
            if (!success) {
              Alert.alert("Fehler", `Abmeldung fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`);
            }
            // Navigation handled by AppNavigator via AuthContext change
          },
        },
      ]
    );
  };
  
  // Handle switch to organization context
  const handleSwitchToOrg = async (orgId) => {
    setIsOrgContextLoading(true); // Show loading indicator while switching
    const result = await switchOrganizationContext(orgId);
    setIsOrgContextLoading(false);
    if (!result.success) {
      Alert.alert("Fehler", result.error || "Konnte nicht zur Organisation wechseln.");
    }
    // UI will update based on context change
  };

  // Handle switch back to personal context
  const handleSwitchToPersonal = async () => {
     setIsOrgContextLoading(true);
     await switchOrganizationContext(null);
     setIsOrgContextLoading(false);
     // UI will update based on context change
  };

  // Handle leaving an organization
  const handleLeaveOrg = (orgId, orgName) => {
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
                      setIsOrgContextLoading(true);
                      const result = await leaveOrganization(orgId);
                      setIsOrgContextLoading(false);
                      if (result.success) {
                          Alert.alert("Erfolg", `Du hast "${orgName}" verlassen.`);
                          // Context should update automatically via AuthProvider listener
                      } else {
                          Alert.alert("Fehler", result.error || "Verlassen fehlgeschlagen.");
                      }
                  },
              },
          ]
      );
  };
  
  // --- Render Functions --- 

  const renderHeader = () => {
    const headerTitle = isOrganizationActive ? `Organisation: ${activeOrganization?.name || '... '}` : 'Dein Profil';
    const avatarInitial = isOrganizationActive ? (activeOrganization?.name?.charAt(0) || 'O') : (displayName?.charAt(0) || '?');
    
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
          {isOrganizationActive && (
             <Text style={styles.roleText}>Deine Rolle: {activeOrganization?.currentUserRole === 'admin' ? 'Administrator' : 'Mitglied'}</Text>
          )}
        </View>
        {/* Personal Profile Edit Button - only shown when NOT in org context */} 
        {hasFullAccount && !isOrganizationActive && (
            <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={handleOpenProfileEdit}
            >
                <Ionicons name="pencil" size={18} color="#4285F4" />
            </TouchableOpacity>
        )}
        {/* TODO: Org Edit Button - Add later */} 
        {/* {isOrganizationActive && activeOrganization?.currentUserRole === 'admin' && (...)} */} 
      </View>
    );
  };

  const renderNoAccountSection = () => (
    <View style={styles.card}>
       <Text style={styles.cardTitle}>Account erstellen</Text>
       <Text style={styles.cardText}>Sichere deine Daten und nutze alle Funktionen, indem du einen kostenlosen Account erstellst.</Text>
       <TouchableOpacity 
        style={styles.primaryButton} 
        onPress={handleOpenCreateAccountModal}
      >
         <Ionicons name="person-add-outline" size={20} color="#fff" style={styles.buttonIcon} />
         <Text style={styles.primaryButtonText}>Account erstellen / Anmelden</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderOrgManagementSection = () => {
    if (!isOrganizationActive || !activeOrganization) return null;
    
    const copyInviteCode = () => {
      if (activeOrganization.invite_code) {
        Clipboard.setString(activeOrganization.invite_code);
        Alert.alert("Kopiert!", "Einladungscode wurde in die Zwischenablage kopiert.");
      }
    };

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Organisationsdetails</Text>
        {activeOrganization.invite_code && (
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
            <FlatList
                data={organizationMembers}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                    <View style={styles.memberItem}>
                        <Text style={styles.memberName}>{item.profiles?.display_name || 'Unbekannter Benutzer'}</Text>
                        <Text style={styles.memberRole}>{item.role === 'admin' ? 'Admin' : 'Mitglied'}</Text>
                        {/* TODO: Add remove/role change buttons for admins */} 
                    </View>
                )}
                style={styles.memberList}
            />
        ) : (
             <Text style={styles.noMembersText}>Keine Mitglieder gefunden.</Text>
        )}
        
        {/* --- Action Buttons for Active Org --- */} 
        <TouchableOpacity 
            style={[styles.button, styles.switchButton]} 
            onPress={handleSwitchToPersonal}
            disabled={isOrgContextLoading}
        >
            {isOrgContextLoading ? <ActivityIndicator size="small" color="#4285F4" /> : <Text style={styles.switchButtonText}>Zu persönlichem Account wechseln</Text>}
        </TouchableOpacity>
        
        {/* TODO: Add Edit Organization Button */} 
        
        <TouchableOpacity 
            style={[styles.button, styles.leaveButton]} 
            onPress={() => handleLeaveOrg(activeOrganizationId, activeOrganization.name)}
            disabled={isOrgContextLoading}
        >
            {isOrgContextLoading ? <ActivityIndicator size="small" color="#dc3545" /> : <Text style={styles.leaveButtonText}>Organisation verlassen</Text>}
        </TouchableOpacity>

      </View>
    );
  };
  
  const renderPersonalProfileSection = () => {
      if (isOrganizationActive) return null; // Don't show personal stuff when org active
      
      return (
          <>
              {/* Personal Preferences */} 
              <View style={styles.card}>
                  <Text style={styles.cardTitle}>Deine Interessen</Text>
                  {preferences && preferences.length > 0 ? (
                    <View style={styles.preferencesContainer}>
                      {preferences.map((prefId) => {
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
              
              {/* Account Settings (Email/Password) */} 
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
              
              {/* Organization Selection/Creation */} 
              <View style={styles.card}>
                  <Text style={styles.cardTitle}>Organisationen</Text>
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
                                      {isOrgContextLoading ? <ActivityIndicator size="small" color="#4285F4" /> : <Text style={styles.buttonSmallText}>Wechseln</Text>}
                                  </TouchableOpacity>
                              </View>
                          ))}
                          <View style={styles.separator} />
                      </View>
                  ) : null}
                  
                  <Text style={styles.orgPromptText}>Du bist ein Verein, Gemeinde oder Unternehmen?</Text>
                  <TouchableOpacity 
                    style={styles.primaryButton} 
                    onPress={() => navigation.navigate('OrganizationSetup')}
                  >
                     <Ionicons name="business-outline" size={20} color="#fff" style={styles.buttonIcon} />
                     <Text style={styles.primaryButtonText}>Organisation erstellen / beitreten</Text>
                  </TouchableOpacity>
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {renderHeader()} 
      
      {!hasFullAccount ? (
         renderNoAccountSection()
      ) : (
         <> 
            {/* Render Org Management Section if an org is active */} 
            {isOrganizationActive && renderOrgManagementSection()}
            
            {/* Render Personal Profile Section if NO org is active */} 
            {!isOrganizationActive && renderPersonalProfileSection()}
            
            {/* Sign Out Button - Always show if logged in */} 
             <View style={styles.signOutContainer}>
               <TouchableOpacity 
                  style={[styles.button, styles.signOutButton]} 
                  onPress={handleSignOut}
                >
                  <Ionicons name="log-out-outline" size={22} style={[styles.settingIcon, styles.signOutIcon]} />
                  <Text style={[styles.settingText, styles.signOutText]}>Abmelden</Text>
               </TouchableOpacity>
            </View>
         </>
      )}
      
      {/* Modals */} 
      {renderCreateAccountModal()} 
      {renderProfileEditModal()} 
      {renderAccountSettingsModal()} 
    </ScrollView>
  );
};

// --- Render Modal Functions (Keep as they are, just ensure they are called correctly) --- 

// Add renderCreateAccountModal, renderProfileEditModal, renderAccountSettingsModal 
// (Copied from the original provided code - assumed unchanged for brevity)
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
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Adjust for safe area
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
  signOutContainer: {
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
  memberList: {
      maxHeight: 150, // Limit height if many members
      marginBottom: 15,
  },
  memberItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#f5f5f5',
  },
  memberName: {
      fontSize: 14,
      color: '#555',
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
   buttonDisabled: {
    opacity: 0.7,
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
});

export default ProfileScreen; 