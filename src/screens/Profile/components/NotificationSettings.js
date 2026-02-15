/**
 * NotificationSettings — Push notification preference toggles.
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
    key: 'org_articles',
    label: 'Vereins-Artikel',
    icon: 'people-outline',
    section: 'articles',
  },
];

const NotificationSettings = ({ userId }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const prefs = await fetchNotificationPreferences(userId);
        if (!cancelled) setPreferences(prefs);
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

    // Optimistic update
    setPreferences(newPrefs);
    setSavingKey(key);

    try {
      await updateNotificationPreferences(userId, newPrefs);
    } catch (err) {
      console.error('[NotificationSettings] Failed to save preference:', err);
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !newValue }));
    } finally {
      setSavingKey(null);
    }
  }, [preferences, savingKey, userId]);

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
        Neue Artikel benachrichtigen:
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

      <Text style={styles.modalInfoText}>
        Aktiviere Kategorien, um bei neuen Artikeln benachrichtigt zu werden.
      </Text>
    </View>
  );
};

export default NotificationSettings;
