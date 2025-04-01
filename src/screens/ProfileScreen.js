import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  // Use organization context
  const { isOrganization, toggleOrganizationStatus } = useOrganization();
  
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
    loading: authLoading // Auth context loading state
  } = useAuth();
  
  // State for account creation modal
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmCreatePassword, setConfirmCreatePassword] = useState('');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createFormError, setCreateFormError] = useState('');
  
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
  const [isAccountSettingsLoading, setIsAccountSettingsLoading] = useState(false);
  const [accountSettingsError, setAccountSettingsError] = useState('');
  
  // Derived state: Check if user has a full Supabase account
  const hasFullAccount = !!user;

  // Categories for preferences selection
  const categories = [
    { id: 'kultur', name: 'Kultur', icon: 'film-outline' },
    { id: 'sport', name: 'Sport', icon: 'football-outline' },
    { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
    { id: 'politik', name: 'Politik', icon: 'megaphone-outline' },
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
    console.log('ProfileScreen - User state:', user ? `ID: ${user.id}, Email: ${user.email}` : 'No auth user');
    console.log('ProfileScreen - Profile state:', profile);
    console.log('ProfileScreen - Display Name:', displayName);
    console.log('ProfileScreen - Preferences:', preferences);
    console.log('ProfileScreen - Has Full Account:', hasFullAccount);
  }, [user, profile, displayName, preferences, hasFullAccount]);

  // Open profile edit modal with current values from context
  const handleOpenProfileEdit = () => {
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
        Alert.alert(
          'Erfolgreich',
          'Dein Account wurde erstellt. Du bist jetzt eingeloggt.'
        );
        setShowCreateAccountModal(false);
        // AuthContext onAuthStateChange will update user/profile state
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
      // Simple array comparison might be insufficient for complex objects, but ok for strings
      const preferencesChanged = JSON.stringify(editPreferences.sort()) !== JSON.stringify((preferences || []).sort());
      if (preferencesChanged) {
          const prefResult = await updatePreferences(editPreferences);
          if (!prefResult.success) {
              console.error('Failed to update preferences:', prefResult.error);
              // Append error message if name update also failed or set if it succeeded
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
        if (result.needsConfirmation) {
           Alert.alert(
              'Bestätigung erforderlich', 
              'Wir haben eine Bestätigungs-E-Mail an deine neue Adresse gesendet. Bitte klicke auf den Link darin, um die Änderung abzuschließen.'
           );
        } else {
            Alert.alert('Erfolgreich', 'Deine E-Mail-Adresse wurde aktualisiert.');
        }
        setShowAccountSettingsModal(false);
      } else {
        console.error('Failed to update email:', result.error);
        setAccountSettingsError(result.error?.message || 'E-Mail konnte nicht geändert werden.');
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
    console.log('Updating password...');
    
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
      const result = await updatePassword(newPassword);
      
      if (result.success) {
        Alert.alert(
          'Erfolgreich', 
          'Dein Passwort wurde aktualisiert.'
        );
        setShowAccountSettingsModal(false);
      } else {
        console.error('Failed to update password:', result.error);
        // Provide more specific feedback if possible (e.g., new password is same as old)
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
            // Navigation should be handled by the main App navigator listening to auth state
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
            await resetOnboarding();
            // Navigation should be handled by the main App navigator
          },
        },
      ]
    );
  };

  // --- Render Functions --- 

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <Image
        source={require('../../assets/avatar_placeholder.png')} // Replace with actual avatar later if available
        style={styles.avatar}
      />
      <View style={styles.profileInfo}>
        <Text style={styles.displayName}>{displayName || 'Gast'}</Text>
        {hasFullAccount ? (
          <Text style={styles.email}>{user.email}</Text>
        ) : (
          <Text style={styles.accountStatus}>Lokaler Account (nicht synchronisiert)</Text>
        )}
      </View>
      <TouchableOpacity 
          style={styles.editProfileButton}
          onPress={handleOpenProfileEdit}
      >
          <Ionicons name="pencil" size={18} color="#4285F4" />
      </TouchableOpacity>
    </View>
  );

  const renderPreferencesSection = () => (
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

  const renderAccountSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      {hasFullAccount ? (
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={handleOpenAccountSettings}
        >
          <Ionicons name="settings-outline" size={24} style={styles.settingIcon} />
          <Text style={styles.settingText}>E-Mail & Passwort ändern</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={handleOpenCreateAccountModal}
        >
          <Ionicons name="person-add-outline" size={24} style={styles.settingIcon} />
          <Text style={styles.settingText}>Account erstellen & Daten sichern</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      )}
      
      {/* Organization Toggle - Assuming this logic is separate */} 
      <View style={styles.settingItem}>
        <Ionicons name="business-outline" size={24} style={styles.settingIcon} />
        <Text style={styles.settingText}>Ich bin eine Organisation</Text>
        <Switch 
          value={isOrganization}
          onValueChange={toggleOrganizationStatus}
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isOrganization ? "#4285F4" : "#f4f3f4"}
        />
      </View>

      <TouchableOpacity 
        style={[styles.settingItem, styles.signOutButton]} 
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={24} style={[styles.settingIcon, styles.signOutIcon]} />
        <Text style={[styles.settingText, styles.signOutText]}>Abmelden</Text>
      </TouchableOpacity>
      
       {/* Reset Onboarding Button (for dev/testing) */} 
       {__DEV__ && (
          <TouchableOpacity 
             style={[styles.settingItem, styles.resetButton]} 
             onPress={handleResetOnboarding}
          >
             <Ionicons name="refresh-outline" size={24} style={[styles.settingIcon, styles.resetIcon]} />
             <Text style={[styles.settingText, styles.resetText]}>Onboarding zurücksetzen (Dev)</Text>
          </TouchableOpacity>
       )}
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
  
  // Show loading indicator while auth context is initializing
  if (authLoading) {
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
      {renderAccountSection()}
      
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
      padding: 8, // Add padding to make it easier to tap
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 15,
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
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
  
  // Modal Styles
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
    flex: 1,
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
});

export default ProfileScreen; 