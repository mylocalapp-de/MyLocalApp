import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  // Use organization context
  const { isOrganization, toggleOrganizationStatus } = useOrganization();
  
  // Use auth context with supabase
  const { 
    user, 
    preferences, 
    displayName, 
    signOut, 
    upgradeToFullAccount, 
    resetOnboarding, 
    supabase,
    updateDisplayName,
    updatePreferences,
    updateEmail,
    updatePassword
  } = useAuth();
  
  // State for account form
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  
  // State for profile edit form
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPreferences, setEditPreferences] = useState([]);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  
  // State for account settings form (email and password change)
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'password'
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isAccountSettingsLoading, setIsAccountSettingsLoading] = useState(false);
  const [accountSettingsError, setAccountSettingsError] = useState('');
  
  // Categories for preferences selection
  const categories = [
    { id: 'kultur', name: 'Kultur', icon: 'film-outline' },
    { id: 'sport', name: 'Sport', icon: 'football-outline' },
    { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
    { id: 'politik', name: 'Politik', icon: 'megaphone-outline' },
  ];
  
  // Toggle preference selection
  const togglePreference = (id) => {
    if (editPreferences.includes(id)) {
      setEditPreferences(editPreferences.filter(item => item !== id));
    } else {
      setEditPreferences([...editPreferences, id]);
    }
  };
  
  // Log initial user state when component loads
  useEffect(() => {
    console.log('ProfileScreen - Initial user state:', user ? `User ID: ${user.id}, Email: ${user.email}` : 'No user');
    console.log('ProfileScreen - User preferences:', preferences);
    console.log('ProfileScreen - User display name:', displayName);
    
    // Check if Supabase is properly configured
    if (supabase) {
      console.log('Supabase client is available');
    } else {
      console.error('Supabase client is not available!');
    }
  }, [user, preferences, displayName, supabase]);

  // Open profile edit modal with current values
  const handleOpenProfileEdit = () => {
    setEditDisplayName(displayName || '');
    setEditPreferences(preferences || []);
    setEditFormError('');
    setShowProfileEditModal(true);
  };
  
  // Open account settings modal with current values
  const handleOpenAccountSettings = () => {
    if (!user) {
      Alert.alert(
        'Hinweis', 
        'Du benötigst einen permanenten Account, um E-Mail und Passwort zu ändern.'
      );
      return;
    }
    
    setNewEmail(user.email || '');
    setEmailPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setActiveTab('email');
    setAccountSettingsError('');
    setShowAccountSettingsModal(true);
  };
  
  // Save profile changes
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
    
    try {
      // Update display name
      const nameResult = await updateDisplayName(editDisplayName);
      if (!nameResult.success) {
        console.error('Failed to update display name:', nameResult.error);
        setEditFormError(nameResult.error.message);
        setIsEditLoading(false);
        return;
      }
      
      // Update preferences
      const prefResult = await updatePreferences(editPreferences);
      if (!prefResult.success) {
        console.error('Failed to update preferences:', prefResult.error);
        setEditFormError(prefResult.error.message);
        setIsEditLoading(false);
        return;
      }
      
      // Check for warnings
      if (nameResult.warning || prefResult.warning) {
        Alert.alert(
          'Hinweis',
          'Deine Änderungen wurden lokal gespeichert, aber es gab Probleme bei der Aktualisierung auf dem Server.'
        );
      } else {
        Alert.alert(
          'Erfolgreich',
          'Deine Profiländerungen wurden gespeichert.'
        );
      }
      
      setShowProfileEditModal(false);
    } catch (error) {
      console.error('Unexpected error during profile update:', error);
      setEditFormError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsEditLoading(false);
    }
  };
  
  // Handle email update
  const handleUpdateEmail = async () => {
    console.log('Updating email...');
    
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAccountSettingsError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    
    if (!emailPassword.trim()) {
      setAccountSettingsError('Bitte gib dein Passwort ein, um die Änderung zu bestätigen.');
      return;
    }
    
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    
    try {
      const result = await updateEmail(newEmail, emailPassword);
      
      if (result.success) {
        Alert.alert(
          'Erfolgreich', 
          'Deine E-Mail-Adresse wurde aktualisiert.'
        );
        setShowAccountSettingsModal(false);
      } else {
        console.error('Failed to update email:', result.error);
        setAccountSettingsError(result.error.message);
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
    
    if (!currentPassword.trim()) {
      setAccountSettingsError('Bitte gib dein aktuelles Passwort ein.');
      return;
    }
    
    if (!newPassword.trim()) {
      setAccountSettingsError('Bitte gib ein neues Passwort ein.');
      return;
    }
    
    if (newPassword.length < 6) {
      setAccountSettingsError('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setAccountSettingsError('Die Passwörter stimmen nicht überein.');
      return;
    }
    
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    
    try {
      const result = await updatePassword(currentPassword, newPassword);
      
      if (result.success) {
        Alert.alert(
          'Erfolgreich', 
          'Dein Passwort wurde aktualisiert.'
        );
        setShowAccountSettingsModal(false);
      } else {
        console.error('Failed to update password:', result.error);
        setAccountSettingsError(result.error.message);
      }
    } catch (error) {
      console.error('Unexpected error during password update:', error);
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };

  // Verify the user profile exists in Supabase
  const verifyProfileCreated = async (userId) => {
    try {
      console.log('Verifying profile creation for user ID:', userId);
      
      // Add retry mechanism - check up to 3 times with increasing delays
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`Profile verification attempt ${attempt}/3`);
        
        // Check the profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId);
          
        if (profileError) {
          console.error(`Attempt ${attempt} - Error verifying profile:`, profileError);
          if (attempt < 3) {
            // Wait longer between each retry
            const delay = attempt * 1000; // 1s, 2s, 3s
            console.log(`Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return false;
        }
        
        // If profile data was found, break out of retry loop
        if (profileData && profileData.length > 0) {
          console.log('Profile verification succeeded:', profileData);
          
          // Now check user_preferences
          const { data: preferencesData, error: preferencesError } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId);
            
          if (preferencesError) {
            console.error('Error verifying preferences:', preferencesError);
          } else {
            console.log('Preferences verification result:', preferencesData);
          }
          
          return {
            profileExists: true,
            preferencesExist: preferencesData && preferencesData.length > 0,
            profileData: profileData[0], // Get the first profile
            preferencesData
          };
        } else if (attempt < 3) {
          // No profile found yet, but we still have retries left
          console.log('No profile found yet, retrying...');
          const delay = attempt * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // No profile found after all retries
          console.log('No profile found after all retry attempts');
          return {
            profileExists: false,
            preferencesExist: false
          };
        }
      }
      
      // This is a fallback in case the loop exits abnormally
      return false;
    } catch (error) {
      console.error('Unexpected error during profile verification:', error);
      return false;
    }
  };

  // Handle creating a permanent account
  const handleCreateAccount = async () => {
    console.log('Starting account creation process...');
    console.log('Input validation - Email:', email);
    console.log('Input validation - Password length:', password?.length);
    console.log('Current local preferences:', preferences);
    
    // Validate input
    if (!email.trim()) {
      console.log('Validation failed: Empty email');
      setFormError('Bitte gib eine E-Mail-Adresse ein.');
      return;
    }
    
    if (!password) {
      console.log('Validation failed: Empty password');
      setFormError('Bitte gib ein Passwort ein.');
      return;
    }
    
    if (password !== confirmPassword) {
      console.log('Validation failed: Passwords do not match');
      setFormError('Die Passwörter stimmen nicht überein.');
      return;
    }
    
    // Check password length
    if (password.length < 6) {
      console.log('Validation failed: Password too short');
      setFormError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    
    console.log('All validations passed, proceeding with account creation...');
    
    setIsLoading(true);
    setFormError('');
    
    try {
      console.log('Calling upgradeToFullAccount with email:', email);
      console.log('Existing preferences to migrate:', preferences);
      
      // Call simplified account creation function
      const result = await upgradeToFullAccount(email, password);
      console.log('Account creation result:', result);
      
      if (result.success) {
        console.log('Account created successfully with user:', result.data);
        
        setShowModal(false);
        Alert.alert(
          'Erfolgreich', 
          'Dein Account wurde erstellt. Du kannst dich jetzt mit deinen Zugangsdaten auf allen Geräten anmelden.'
        );
      } else {
        console.error('Account creation failed:', result.error);
        
        // Handle different error codes
        switch (result.error?.code) {
          case 'email_exists':
            setFormError('Diese E-Mail-Adresse ist bereits registriert.');
            break;
          case 'invalid_email':
            setFormError('Bitte gib eine gültige E-Mail-Adresse ein.');
            break;
          case 'invalid_password':
            setFormError('Das Passwort ist zu schwach. Bitte wähle ein stärkeres Passwort.');
            break;
          case 'database_error':
            setFormError('Datenbankfehler. Bitte versuche es später erneut.');
            break;
          case 'create_user_error':
            if (result.error.message.includes('duplicate key')) {
              setFormError('Diese E-Mail-Adresse ist bereits registriert.');
            } else {
              setFormError('Fehler beim Erstellen des Benutzers. Bitte versuche es später erneut.');
            }
            break;
          case 'unexpected_error':
            setFormError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.');
            break;
          default:
            setFormError(result.error?.message || 'Fehler beim Erstellen des Accounts.');
            break;
        }
      }
    } catch (error) {
      console.error('Unexpected error during account creation:', error);
      setFormError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      console.log('Account creation process completed');
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      'Abmelden',
      'Möchtest du dich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Abmelden', 
          style: 'destructive',
          onPress: async () => {
            const { success } = await signOut();
            if (success) {
              // Reset onboarding for testing purposes
              // In a production app, you would not include this
              resetOnboarding();
            }
          }
        }
      ]
    );
  };

  // Prepare user preferences for display
  const userPreferences = preferences ? preferences.map(p => {
    // Convert preference IDs to readable names
    switch (p) {
      case 'kultur': return 'Kultur';
      case 'sport': return 'Sport';
      case 'verkehr': return 'Verkehr';
      case 'politik': return 'Politik';
      default: return p;
    }
  }).join(', ') : '';

  // Render the email update form
  const renderEmailUpdateForm = () => (
    <View>
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Neue E-Mail-Adresse</Text>
        <TextInput
          style={styles.textInput}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="neue@email.de"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Passwort zur Bestätigung</Text>
        <TextInput
          style={styles.textInput}
          value={emailPassword}
          onChangeText={setEmailPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      </View>
      
      <Text style={styles.securityNote}>
        Bitte gib dein aktuelles Passwort ein, um die Änderung deiner E-Mail-Adresse zu bestätigen.
      </Text>
    </View>
  );
  
  // Render the password update form
  const renderPasswordUpdateForm = () => (
    <View>
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Aktuelles Passwort</Text>
        <TextInput
          style={styles.textInput}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Neues Passwort</Text>
        <TextInput
          style={styles.textInput}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Neues Passwort bestätigen</Text>
        <TextInput
          style={styles.textInput}
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      </View>
      
      <Text style={styles.securityNote}>
        Dein neues Passwort sollte mindestens 6 Zeichen lang sein und sich von deinem aktuellen Passwort unterscheiden.
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.profileTitle}>Dein Profil:</Text>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {/* Display first character of display name if available, or email if user exists, otherwise default to 'G' */}
                {displayName ? displayName.charAt(0).toUpperCase() : (user ? user.email?.charAt(0).toUpperCase() : 'G')}
              </Text>
            </View>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user ? `Name: ${user.displayName || user.email}` : (displayName ? displayName : 'Lokaler Gast')}
            </Text>
            <Text style={styles.userDetails}>
              Präferenzen bei{'\n'}
              Nachrichten:{'\n'}
              {userPreferences || 'Keine ausgewählt'}
            </Text>
            {!user && (
              <Text style={styles.localAccountNotice}>
                Du nutzt aktuell einen lokalen Account.
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.profileButtons}>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={handleOpenProfileEdit}
          >
            <Text style={styles.editProfileButtonText}>
              Profil bearbeiten
            </Text>
          </TouchableOpacity>
          
          {user ? (
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={handleOpenAccountSettings}
            >
              <Text style={styles.editProfileButtonText}>
                E-Mail & Passwort ändern
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.createAccountButton}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.createAccountButtonText}>
                Permanenten Account erstellen
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {user ? (
        <View style={styles.organizationSection}>
          <Text style={styles.sectionTitle}>
            Du bist ein Verein, Gemeinde oder Unternehmen?
          </Text>
          
          <Text style={styles.sectionDescription}>
            Jetzt eigene Artikel veröffentlichen, deine eigene Gruppe erstellen oder eigene Veranstaltungen eintragen!
          </Text>
          
          <TouchableOpacity 
            style={styles.organizationButton}
            onPress={toggleOrganizationStatus}
          >
            <Text style={styles.organizationButtonText}>
              {isOrganization ? 'Zurück zum normalen Account' : 'Organisations-Account'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.organizationSection}>
          <Text style={styles.sectionTitle}>
            Du bist ein Verein, Gemeinde oder Unternehmen?
          </Text>
          
          <Text style={styles.sectionDescription}>
            Um Organisations-Funktionen wie das Veröffentlichen von Artikeln, Erstellen von Gruppen oder Eintragen von Veranstaltungen zu nutzen, benötigst du einen permanenten Account.
          </Text>
          
          <TouchableOpacity 
            style={styles.upgradeAccountButton}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.upgradeAccountButtonText}>
              Permanenten Account erstellen
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {user && isOrganization && (
        <View style={styles.orgOptionsContainer}>
          <TouchableOpacity style={styles.orgOptionButton}>
            <Ionicons name="newspaper-outline" size={24} color="#4285F4" style={styles.orgOptionIcon} />
            <Text style={styles.orgOptionText}>Artikel veröffentlichen</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.orgOptionButton}>
            <Ionicons name="people-outline" size={24} color="#4285F4" style={styles.orgOptionIcon} />
            <Text style={styles.orgOptionText}>Gruppe erstellen</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.orgOptionButton}>
            <Ionicons name="calendar-outline" size={24} color="#4285F4" style={styles.orgOptionIcon} />
            <Text style={styles.orgOptionText}>Veranstaltung eintragen</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.settingsSection}>
        <Text style={styles.settingsHeader}>Einstellungen</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingTextContainer}>
            <Ionicons name="notifications-outline" size={22} color="#333" style={styles.settingIcon} />
            <Text style={styles.settingText}>Benachrichtigungen</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingTextContainer}>
            <Ionicons name="lock-closed-outline" size={22} color="#333" style={styles.settingIcon} />
            <Text style={styles.settingText}>Datenschutz</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingTextContainer}>
            <Ionicons name="help-circle-outline" size={22} color="#333" style={styles.settingIcon} />
            <Text style={styles.settingText}>Hilfe</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#ccc" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.logoutButtonText}>Abmelden</Text>
        </TouchableOpacity>
      </View>

      {/* Account creation modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {user ? 'Account Einstellungen' : 'Account erstellen'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              {user 
                ? 'Hier kannst du deine Account-Einstellungen ändern.' 
                : 'Erstelle einen permanenten Account für dein Gerät, um deine Einstellungen zu sichern.'}
            </Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>E-Mail</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="deine@email.de"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Passwort</Text>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Passwort bestätigen</Text>
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </View>
            
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, isLoading && styles.buttonDisabled]}
                onPress={handleCreateAccount}
                disabled={isLoading}
              >
                <Text style={styles.saveButtonText}>
                  {isLoading ? 'Lädt...' : 'Speichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Profile edit modal */}
      <Modal
        visible={showProfileEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profil bearbeiten</Text>
              <TouchableOpacity onPress={() => setShowProfileEditModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Benutzername</Text>
                <TextInput
                  style={styles.textInput}
                  value={editDisplayName}
                  onChangeText={setEditDisplayName}
                  placeholder="Dein Name"
                />
              </View>
              
              <Text style={styles.inputLabel}>Deine Interessen</Text>
              <Text style={styles.preferencesDescription}>
                Wähle Themen aus, die dich interessieren.
              </Text>
              
              <View style={styles.categoriesContainer}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryItem,
                      editPreferences.includes(category.id) && styles.categoryItemSelected
                    ]}
                    onPress={() => togglePreference(category.id)}
                  >
                    <Ionicons 
                      name={category.icon} 
                      size={24} 
                      color={editPreferences.includes(category.id) ? '#fff' : '#4285F4'} 
                    />
                    <Text 
                      style={[
                        styles.categoryText,
                        editPreferences.includes(category.id) && styles.categoryTextSelected
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {editFormError ? <Text style={styles.errorText}>{editFormError}</Text> : null}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowProfileEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, isEditLoading && styles.buttonDisabled]}
                onPress={handleSaveProfile}
                disabled={isEditLoading}
              >
                <Text style={styles.saveButtonText}>
                  {isEditLoading ? 'Lädt...' : 'Speichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Account settings modal for email/password change */}
      <Modal
        visible={showAccountSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAccountSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account-Einstellungen</Text>
              <TouchableOpacity onPress={() => setShowAccountSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[
                  styles.tab, 
                  activeTab === 'email' && styles.activeTab
                ]}
                onPress={() => setActiveTab('email')}
              >
                <Text 
                  style={[
                    styles.tabText, 
                    activeTab === 'email' && styles.activeTabText
                  ]}
                >
                  E-Mail ändern
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.tab, 
                  activeTab === 'password' && styles.activeTab
                ]}
                onPress={() => setActiveTab('password')}
              >
                <Text 
                  style={[
                    styles.tabText, 
                    activeTab === 'password' && styles.activeTabText
                  ]}
                >
                  Passwort ändern
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {activeTab === 'email' ? renderEmailUpdateForm() : renderPasswordUpdateForm()}
              
              {accountSettingsError ? <Text style={styles.errorText}>{accountSettingsError}</Text> : null}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAccountSettingsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, isAccountSettingsLoading && styles.buttonDisabled]}
                onPress={activeTab === 'email' ? handleUpdateEmail : handleUpdatePassword}
                disabled={isAccountSettingsLoading}
              >
                <Text style={styles.saveButtonText}>
                  {isAccountSettingsLoading ? 'Lädt...' : 'Speichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userDetails: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  localAccountNotice: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
    fontStyle: 'italic',
  },
  profileButtons: {
    flexDirection: 'column',
  },
  editProfileButton: {
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  editProfileButtonText: {
    color: '#4285F4',
    fontWeight: 'bold',
  },
  createAccountButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createAccountButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  organizationSection: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  organizationButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  organizationButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  upgradeAccountButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeAccountButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  orgOptionsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orgOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  orgOptionIcon: {
    marginRight: 15,
  },
  orgOptionText: {
    fontSize: 14,
    color: '#333',
  },
  settingsSection: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 30,
  },
  settingsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  settingTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 10,
  },
  settingText: {
    fontSize: 14,
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#ff3b30',
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  preferencesDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '48%',
  },
  categoryItemSelected: {
    backgroundColor: '#4285F4',
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  categoryTextSelected: {
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 10,
  },
  // Tabs for account settings modal
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4285F4',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#4285F4',
    fontWeight: 'bold',
  },
  securityNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
});

export default ProfileScreen; 