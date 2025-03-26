import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  // Use organization context
  const { isOrganization, toggleOrganizationStatus } = useOrganization();
  
  // Use auth context with supabase
  const { user, preferences, signOut, upgradeToFullAccount, resetOnboarding, supabase } = useAuth();
  
  // State for account form
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  
  // Log initial user state when component loads
  useEffect(() => {
    console.log('ProfileScreen - Initial user state:', user ? `User ID: ${user.id}, Email: ${user.email}` : 'No user');
    console.log('ProfileScreen - User preferences:', preferences);
    
    // Check if Supabase is properly configured
    if (supabase) {
      console.log('Supabase client is available');
    } else {
      console.error('Supabase client is not available!');
    }
  }, [user, preferences, supabase]);

  // Verify the user profile exists in Supabase
  const verifyProfileCreated = async (userId) => {
    try {
      console.log('Verifying profile creation for user ID:', userId);
      
      // Check the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        console.error('Error verifying profile:', profileError);
        return false;
      }
      
      console.log('Profile verification result:', profileData);
      
      // Check user_preferences table
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId);
        
      if (preferencesError) {
        console.error('Error verifying preferences:', preferencesError);
        return false;
      }
      
      console.log('Preferences verification result:', preferencesData);
      
      return {
        profileExists: !!profileData,
        preferencesExist: preferencesData && preferencesData.length > 0,
        profileData,
        preferencesData
      };
    } catch (error) {
      console.error('Unexpected error during verification:', error);
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
    
    console.log('All validations passed, proceeding with account creation...');
    console.log('Checking Supabase connection status...');
    
    try {
      // Test Supabase connection
      const { data: connectionTest, error: connectionError } = await supabase.from('profiles').select('count').limit(1);
      
      if (connectionError) {
        console.error('Supabase connection test failed:', connectionError);
        setFormError('Verbindung zur Datenbank fehlgeschlagen. Bitte später erneut versuchen.');
        return;
      }
      
      console.log('Supabase connection test succeeded:', connectionTest);
    } catch (connectionTestError) {
      console.error('Error testing Supabase connection:', connectionTestError);
      setFormError('Verbindung zur Datenbank fehlgeschlagen. Bitte später erneut versuchen.');
      return;
    }
    
    setIsLoading(true);
    setFormError('');
    
    try {
      console.log('Calling upgradeToFullAccount with email:', email);
      console.log('Existing preferences to migrate:', preferences);
      
      // Check if we have SQL triggers set up for user creation
      console.log('Checking if database has the required triggers...');
      const { data: triggerData, error: triggerError } = await supabase.rpc('check_triggers_exist');
      if (triggerError) {
        console.log('Could not verify triggers (RPC may not exist):', triggerError);
      } else {
        console.log('Trigger check result:', triggerData);
      }
      
      const result = await upgradeToFullAccount(email, password);
      console.log('Account creation result:', result);
      
      if (result.success) {
        console.log('Account created successfully with user:', result.data?.user);
        
        // Verify data was properly stored in Supabase tables
        if (result.data?.user?.id) {
          console.log('Verifying database tables were updated...');
          const userId = result.data.user.id;
          
          // Wait a moment for triggers to execute
          console.log('Waiting for database triggers to execute...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const verificationResult = await verifyProfileCreated(userId);
          console.log('Verification result:', verificationResult);
          
          if (!verificationResult || !verificationResult.profileExists) {
            console.warn('Account created but profile record may not exist in database!');
            console.log('This could indicate an issue with the trigger defined in init.sql');
          }
          
          if (!verificationResult || !verificationResult.preferencesExist) {
            console.warn('Account created but preferences may not have been migrated!');
            console.log('Check the handle_new_user() function in init.sql');
          }
        }
        
        setShowModal(false);
        Alert.alert(
          'Erfolgreich', 
          'Dein Account wurde erstellt. Du kannst dich jetzt mit deinen Zugangsdaten anmelden.'
        );
      } else {
        console.error('Account creation failed:', result.error);
        
        // More detailed error logging based on error type
        if (result.error?.message?.includes('already registered')) {
          console.error('Email already registered');
          setFormError('Diese E-Mail-Adresse ist bereits registriert.');
        } else if (result.error?.message?.includes('weak password')) {
          console.error('Password too weak');
          setFormError('Das Passwort ist zu schwach. Bitte wähle ein stärkeres Passwort.');
        } else {
          setFormError('Fehler beim Erstellen des Accounts. Bitte versuche es erneut.');
          
          // Log additional information from the error if available
          if (result.error?.code) {
            console.error('Error code:', result.error.code);
          }
          
          if (result.error?.details) {
            console.error('Error details:', result.error.details);
          }
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.profileTitle}>Dein Profil:</Text>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {/* Display first character of email if user exists, otherwise default to 'G' */}
                {user ? user.email?.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user ? `Name: ${user.email}` : 'Lokaler Gast'}
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
        
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.settingsButtonText}>
            {user ? 'Account-Einstellungen ändern' : 'Permanenten Account erstellen'}
          </Text>
        </TouchableOpacity>
      </View>
      
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
      
      {isOrganization && (
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
  settingsButton: {
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#4285F4',
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
});

export default ProfileScreen; 