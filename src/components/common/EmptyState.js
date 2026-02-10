/**
 * EmptyState Component
 * 
 * Reusable empty state with icon and message.
 * 
 * Usage:
 *   <EmptyState message="Keine Artikel gefunden" />
 *   <EmptyState 
 *     icon="calendar-outline" 
 *     message="Keine Events" 
 *     action={{ label: "Event erstellen", onPress: handleCreate }}
 *   />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const EmptyState = ({ 
  icon = 'document-text-outline',
  iconSize = 64,
  message = 'Keine Inhalte vorhanden',
  subtitle,
  action,
}) => {
  return (
    <View style={styles.container}>
      <Ionicons 
        name={icon} 
        size={iconSize} 
        color={colors.gray400} 
      />
      <Text style={styles.message}>{message}</Text>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
      {action && (
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={action.onPress}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.gray500,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  actionText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

export default EmptyState;
