import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ProfileScreen = () => {
  const userProfile = {
    name: 'Max Muster',
    role: 'Privatperson',
    location: 'Musterstraße 123',
  };

  const menuItems = [
    {
      title: 'Account Einstellungen ändern',
      icon: 'account-cog',
    },
    {
      title: 'Upgrade zum Organisations-Account',
      icon: 'briefcase-outline',
      description: 'Jetzt eigene Artikel veröffentlichen, eigene Gruppen starten und eigene Veranstaltungen eintragen!',
    },
    {
      title: 'Datenschutz & Sicherheit',
      icon: 'shield-account',
    },
    {
      title: 'Hilfe & Support',
      icon: 'help-circle',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileImage}>
          <Icon name="account" size={60} color="#fff" />
        </View>
        <Text style={styles.name}>{userProfile.name}</Text>
        <Text style={styles.role}>{userProfile.role}</Text>
        <Text style={styles.location}>{userProfile.location}</Text>
      </View>

      <View style={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem}>
            <Icon name={item.icon} size={24} color="#007AFF" style={styles.menuIcon} />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              {item.description && (
                <Text style={styles.menuDescription}>{item.description}</Text>
              )}
            </View>
            <Icon name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f8f8',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 12,
    color: '#666',
  },
});

export default ProfileScreen; 