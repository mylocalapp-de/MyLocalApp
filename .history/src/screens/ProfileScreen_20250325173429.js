import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';

const ProfileScreen = () => {
  // Use organization context
  const { isOrganization, toggleOrganizationStatus } = useOrganization();
  
  // User Profile Mock Data
  const user = {
    name: 'Max Muster',
    preferences: {
      location: 'Musterstadt',
      interests: ['Kultur', 'Sport', 'Vereine']
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.profileTitle}>Dein Profil:</Text>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
            </View>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>Name: {user.name}</Text>
            <Text style={styles.userDetails}>
              Präferenzen bei{'\n'}
              Nachrichten:{'\n'}
              {user.preferences.interests.join(', ')}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.settingsButton}>
          <Text style={styles.settingsButtonText}>Account-Einstellungen ändern</Text>
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
        
        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Abmelden</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
    fontSize: 14,
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
    color: '#FF5252',
    fontWeight: 'bold',
  }
});

export default ProfileScreen; 