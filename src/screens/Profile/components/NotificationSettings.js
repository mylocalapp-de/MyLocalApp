/**
 * NotificationSettings — Push notification preference toggles.
 * Includes per-organization toggles beneath the master "Vereins-Artikel" switch.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../../../services/notificationService';
import styles from '../styles';

const TOGGLE_ITEMS = [
  {
    key: 'comments',
    label: 'Kommentare auf eigene Artikel',
    icon: 'chatbubble-outline',
    section: 'general',
  },
  {
    key: 'direct_messages',
    label: 'Private Nachrichten',
    icon: 'mail-outline',
    section: 'general',
  },
  {
    key: 'filter_aktuell',
    label: 'Aktuell',
    icon: 'newspaper-outline',
    section: 'articles',
  },
  {
    key: 'filter_schwarzes_brett',
    label: 'Schwarzes Brett',
    icon: 'clipboard-outline',
    section: 'articles',
  },
  {
    key: 'filter_mitfahrboerse',
    label: 'Mitfahrbörse',
    icon: 'car-outline',
    section: 'articles',
  },
  {
    key: 'filter_veranstaltungen',
    label: 'Veranstaltungen',
    icon: 'calendar-outline',
    section: 'articles',
  },
  {
    key: 'filter_hilfe',
    label: 'Hilfe',
    icon: 'help-circle-outline',
    section: 'articles',
  },
  {
    key: 'filter_dorfschnack',
    label: 'Dorfschnack',
    icon: 'chatbubbles-outline',
    section: 'articles',
  },
];

const NotificationSettings = ({ userId }) => {
  const [preferences, setPreferences] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const result = await fetchNotificationPreferences(userId);
        if (!cancelled) {
          const { organizations: orgs, ...prefs } = result;
          setPreferences(prefs);
          setOrganizations(orgs || []);
        }
      } catch (err) {
        console.error('[NotificationSettings] Failed to load preferences:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const handleToggle = useCallback(async (key) => {
    if (!preferences || savingKey) return;

    const newValue = !preferences[key];
    const newPrefs = { ...preferences, [key]: newValue };

    // When master org toggle is turned off, also disable all per-org toggles.
    // When turned on, enable all per-org toggles.
    if (key === 'org_articles') {
      for (const org of organizations) {
        newPrefs[`org_articles_${org.id}`] = newValue;
      }
    }

    // Optimistic update
    setPreferences(newPrefs);
    setSavingKey(key);

    try {
      await updateNotificationPreferences(userId, { ...newPrefs, organizations });
    } catch (err) {
      console.error('[NotificationSettings] Failed to save preference:', err);
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSavingKey(null);
    }
  }, [preferences, savingKey, userId, organizations]);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📢 Benachrichtigungen</Text>
        <ActivityIndicator size="small" color="#4285F4" style={{ marginVertical: 15 }} />
      </View>
    );
  }

  if (!preferences) {
    return null;
  }

  const generalItems = TOGGLE_ITEMS.filter(i => i.section === 'general');
  const articleItems = TOGGLE_ITEMS.filter(i => i.section === 'articles');

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📢 Benachrichtigungen</Text>

      {generalItems.map((item) => (
        <View key={item.key} style={styles.settingItem}>
          <Ionicons name={item.icon} size={22} style={styles.settingIcon} />
          <Text style={styles.settingText}>{item.label}</Text>
          <Switch
            value={!!preferences[item.key]}
            onValueChange={() => handleToggle(item.key)}
            disabled={savingKey === item.key}
          />
        </View>
      ))}

      <View style={styles.separator} />

      <Text style={[styles.cardText, { marginBottom: 5, fontWeight: '500', color: '#555' }]}>
        Aktiviere was Dich interessiert, und Du wirst benachrichtigt, wenn es etwas Neues gibt.
      </Text>

      {articleItems.map((item) => (
        <View key={item.key} style={styles.settingItem}>
          <Ionicons name={item.icon} size={22} style={styles.settingIcon} />
          <Text style={styles.settingText}>{item.label}</Text>
          <Switch
            value={!!preferences[item.key]}
            onValueChange={() => handleToggle(item.key)}
            disabled={savingKey === item.key}
          />
        </View>
      ))}

      {/* Master org articles toggle */}
      <View style={styles.settingItem}>
        <Ionicons name="people-outline" size={22} style={styles.settingIcon} />
        <Text style={styles.settingText}>Vereins-Artikel (alle)</Text>
        <Switch
          value={!!preferences.org_articles}
          onValueChange={() => handleToggle('org_articles')}
          disabled={savingKey === 'org_articles'}
        />
      </View>

      {/* Per-organization toggles */}
      {organizations.length > 0 && (
        <View style={{ paddingLeft: 20 }}>
          {organizations.map((org) => {
            const orgKey = `org_articles_${org.id}`;
            return (
              <View key={orgKey} style={[styles.settingItem, { paddingVertical: 10 }]}>
                <Ionicons name="shield-outline" size={18} style={[styles.settingIcon, { marginRight: 10 }]} />
                <Text style={[styles.settingText, { fontSize: 14, color: '#555' }]}>{org.name}</Text>
                <Switch
                  value={!!preferences[orgKey]}
                  onValueChange={() => handleToggle(orgKey)}
                  disabled={savingKey === orgKey}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default NotificationSettings;
