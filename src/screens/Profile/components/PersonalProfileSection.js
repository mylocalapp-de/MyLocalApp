/**
 * PersonalProfileSection — Organizations, preferences, visibility, about me,
 * account settings, offline mode, legal links.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles';

const CATEGORIES = [
  { id: 'kultur', name: 'Kultur', icon: 'film-outline' },
  { id: 'sport', name: 'Sport', icon: 'football-outline' },
  { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
  { id: 'politik', name: 'Politik', icon: 'megaphone-outline' },
  { id: 'vereine', name: 'Vereine', icon: 'people-outline' },
  { id: 'gemeinde', name: 'Gemeinde', icon: 'business-outline' },
];

export { CATEGORIES };

const PersonalProfileSection = ({
  hasFullAccount,
  isTemporaryAccount,
  disablePreferences,
  preferences,
  profile,
  userOrganizations,
  isOrgContextLoading,
  isConnected,
  lastOfflineSaveTimestamp,
  isSavingData,
  isUpdatingVisibility,
  navigation,
  onSwitchToOrg,
  onOpenProfileEdit,
  onOpenAboutMeModal,
  onOpenAccountSettings,
  onOpenMakePermanentSettings,
  onOpenCreateAccountModal,
  onSaveDataForOffline,
  onUpdateVisibility,
}) => {
  const hasNoOrganizations = !userOrganizations || userOrganizations.length === 0;

  const lastSaveDate = lastOfflineSaveTimestamp
    ? new Date(lastOfflineSaveTimestamp).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'nie';

  return (
    <>
      {/* No Account Section */}
      {!hasFullAccount && (
        <View style={[styles.card, styles.highlightedOrgCard]}>
          <Text style={[styles.cardTitle, styles.highlightedOrgTitle]}>Account erstellen</Text>
          <Text style={[styles.cardText, styles.highlightedOrgPromptText]}>
            Sichere deine Daten, sei <Text style={styles.boldText}>interaktiv dabei</Text> und nutze <Text style={styles.boldText}>alle Funktionen</Text>!
          </Text>
          <TouchableOpacity onPress={onOpenCreateAccountModal} style={{ marginTop: 10 }}>
            <LinearGradient colors={['#7b4397', '#dc2430']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gradientButton}>
              <Ionicons name="person-add-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Permanenten Account erstellen</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Make Permanent Card */}
      {hasFullAccount && isTemporaryAccount && (
        <View style={[styles.card, styles.highlightedOrgCard]}>
          <Text style={[styles.cardTitle, styles.highlightedOrgTitle]}>Account dauerhaft sichern</Text>
          <Text style={[styles.cardText, styles.highlightedOrgPromptText]}>
            Dein Account ist aktuell temporär. Sichere deine Daten, und nutze <Text style={styles.boldText}>alle Funktionen</Text>!
          </Text>
          <TouchableOpacity onPress={onOpenMakePermanentSettings} style={{ marginTop: 15 }}>
            <LinearGradient colors={['#7b4397', '#dc2430']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gradientButton}>
              <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Passwort festlegen & Sichern</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Organizations - creation/joining handled via Admin Panel */}
      {hasFullAccount && userOrganizations && userOrganizations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Organisationen</Text>
          <Text style={styles.cardText}>Du bist Mitglied in:</Text>
          {userOrganizations.map(org => (
            <View key={org.id} style={styles.orgSelectItem}>
              <Text style={styles.orgSelectName}>{org.name}</Text>
              <TouchableOpacity
                style={[styles.buttonSmall, styles.switchButtonSmall]}
                onPress={() => onSwitchToOrg(org.id)}
                disabled={isOrgContextLoading}
              >
                {isOrgContextLoading ? <ActivityIndicator size="small" color="#4285F4" /> : <Text style={styles.buttonSmallText}>Zu dieser Organisation wechseln</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Preferences */}
      {!disablePreferences && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deine Interessen</Text>
          {(preferences || []).length > 0 ? (
            <View style={styles.preferencesContainer}>
              {(preferences || []).map(prefId => {
                const cat = CATEGORIES.find(c => c.id === prefId);
                return (
                  <View key={prefId} style={styles.preferenceChip}>
                    <Ionicons name={cat?.icon || 'help-circle-outline'} size={16} color="#4285F4" style={styles.preferenceIcon} />
                    <Text style={styles.preferenceText}>{cat?.name || prefId}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noPreferencesText}>Keine Präferenzen ausgewählt.</Text>
          )}
          <TouchableOpacity style={styles.editButtonInline} onPress={onOpenProfileEdit}>
            <Text style={styles.editButtonText}>Name & Interessen bearbeiten</Text>
            <Ionicons name="chevron-forward" size={16} color="#4285F4" />
          </TouchableOpacity>
        </View>
      )}

      {/* Visibility */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sichtbarkeit</Text>
        <View style={styles.settingItem}>
          <Ionicons name="eye-outline" size={22} style={styles.settingIcon} />
          <Text style={styles.settingText}>In Personenliste anzeigen</Text>
          <Switch
            value={profile?.show_in_list === true}
            onValueChange={onUpdateVisibility}
            disabled={isUpdatingVisibility}
          />
        </View>
        <Text style={styles.modalInfoText}>Wenn aktiviert, können andere dich in der Personenliste finden und direkt anschreiben.</Text>
      </View>

      {/* About Me */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Über mich</Text>
        <Text style={styles.aboutMeText}>{profile?.about_me || 'Keine Beschreibung hinterlegt.'}</Text>
        <TouchableOpacity style={styles.editButtonInline} onPress={onOpenAboutMeModal}>
          <Text style={styles.editButtonText}>Über mich bearbeiten</Text>
          <Ionicons name="chevron-forward" size={16} color="#4285F4" />
        </TouchableOpacity>
      </View>

      {/* Account Settings */}
      {hasFullAccount && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Einstellungen</Text>
          <TouchableOpacity style={styles.settingItem} onPress={onOpenAccountSettings}>
            <Ionicons name="settings-outline" size={22} style={styles.settingIcon} />
            <Text style={styles.settingText}>E-Mail & Passwort ändern</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      )}

      {/* Offline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offline Modus</Text>
        <TouchableOpacity
          style={[styles.button, styles.saveOfflineButton, (!isConnected || isSavingData) && styles.buttonDisabled]}
          onPress={onSaveDataForOffline}
          disabled={!isConnected || isSavingData}
        >
          {isSavingData ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={20} color="#fff" style={styles.buttonIcon} />}
          <Text style={styles.saveOfflineButtonText}>{isSavingData ? 'Speichern...' : 'Daten für Offline-Modus speichern'}</Text>
        </TouchableOpacity>
        <Text style={styles.lastSaveText}>Zuletzt gespeichert: {lastSaveDate}</Text>
        {!isConnected && <Text style={styles.offlineWarningText}>Keine Internetverbindung zum Speichern vorhanden.</Text>}
      </View>

      {/* Legal */}
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

export default PersonalProfileSection;
