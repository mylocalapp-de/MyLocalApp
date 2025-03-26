import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  // Use organization context
  const { isOrganization, toggleOrganizationStatus } = useOrganization();
  
  // Use auth context
  const { user, preferences, signOut, setPreferences, updateProfile } = useAuth();
  
  // State for modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  
  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Preferences state
  const [selectedPreferences, setSelectedPreferences] = useState(preferences);
  
  // Categories
  const categories = [
    { id: 'kultur', name: 'Kultur' },
    { id: 'sport', name: 'Sport' },
    { id: 'verkehr', name: 'Verkehr' },
    { id: 'politik', name: 'Politik' },
  ];
  
  // Handle setting password
  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Passwort zu kurz', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Passwörter stimmen nicht überein', 'Bitte überprüfe deine Eingabe.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await updateProfile({ password });
      
      if (error) {
        Alert.alert('Fehler', error.message || 'Passwort konnte nicht gesetzt werden.');
      } else {
        Alert.alert('Erfolg', 'Dein Passwort wurde erfolgreich gesetzt!');
        setShowPasswordModal(false);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle updating preferences
  const handleUpdatePreferences = async () => {
    if (selectedPreferences.length === 0) {
      Alert.alert('Keine Auswahl', 'Bitte wähle mindestens eine Kategorie aus.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await setPreferences(selectedPreferences);
      
      if (error) {
        Alert.alert('Fehler', error.message || 'Präferenzen konnten nicht aktualisiert werden.');
      } else {
        Alert.alert('Erfolg', 'Deine Präferenzen wurden erfolgreich aktualisiert!');
        setShowPreferencesModal(false);
      }
    } catch (error) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle preference selection
  const togglePreference = (prefId) => {
    setSelectedPreferences(prev => {
      if (prev.includes(prefId)) {
        return prev.filter(id => id !== prefId);
      } else {
        return [...prev, prefId];
      }
    });
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Fehler beim Abmelden', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.profileTitle}>Dein Profil:</Text>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.email ? user.email.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>Email: {user?.email || 'Gast'}</Text>
            <Text style={styles.userDetails}>
              Präferenzen bei{'\n'}
              Nachrichten:{'\n'}
              {preferences.length > 0 
                ? preferences.map(pref => {
                    const category = categories.find(c => c.id === pref);
                    return category ? category.name : pref;
                  }).join(', ')
                : 'Keine ausgewählt'}
            </Text>
          </View>
        </View>
        
        <View style={styles.accountButtonsContainer}>
          <TouchableOpacity 
            style={styles.accountButton}
            onPress={() => setShowPasswordModal(true)}
          >
            <Text style={styles.accountButtonText}>
              {user?.app_metadata?.provider === 'email' ? 'Passwort ändern' : 'Passwort setzen'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.accountButton}
            onPress={() => setShowPreferencesModal(true)}
          >
            <Text style={styles.accountButtonText}>Präferenzen ändern</Text>
          </TouchableOpacity>
        </View>
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
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Abmelden</Text>
        </TouchableOpacity>
      </View>
      
      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {user?.app_metadata?.provider === 'email' ? 'Passwort ändern' : 'Passwort setzen'}
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Neues Passwort"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Passwort bestätigen"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalSaveButton, isLoading && styles.disabledButton]}
                onPress={handleSetPassword}
                disabled={isLoading}
              >
                <Text style={styles.modalSaveButtonText}>
                  {isLoading ? 'Wird gespeichert...' : 'Speichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Preferences Modal */}
      <Modal
        visible={showPreferencesModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Präferenzen bearbeiten</Text>
            
            <View style={styles.preferencesContainer}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.preferenceItem,
                    selectedPreferences.includes(category.id) && styles.selectedPreference,
                  ]}
                  onPress={() => togglePreference(category.id)}
                >
                  <Text
                    style={[
                      styles.preferenceText,
                      selectedPreferences.includes(category.id) && styles.selectedPreferenceText,
                    ]}
                  >
                    {category.name}
                  </Text>
                  
                  {selectedPreferences.includes(category.id) && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPreferencesModal(false);
                  setSelectedPreferences(preferences);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalSaveButton, isLoading && styles.disabledButton]}
                onPress={handleUpdatePreferences}
                disabled={isLoading}
              >
                <Text style={styles.modalSaveButtonText}>
                  {isLoading ? 'Wird gespeichert...' : 'Speichern'}
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
  accountButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accountButton: {
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 0.48,
  },
  accountButtonText: {
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  settingTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalCancelButton: {
    flex: 0.48,
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  modalSaveButton: {
    flex: 0.48,
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#A0B9E0',
  },
  preferencesContainer: {
    marginBottom: 20,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedPreference: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  preferenceText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPreferenceText: {
    color: '#fff',
  },
});

export default ProfileScreen; 