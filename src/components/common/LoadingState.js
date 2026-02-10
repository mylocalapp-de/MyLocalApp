/**
 * LoadingState Component
 * 
 * Reusable loading indicator with optional message.
 * 
 * Usage:
 *   <LoadingState />
 *   <LoadingState message="Lade Artikel..." />
 *   <LoadingState fullScreen={false} />
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../../theme';

const LoadingState = ({ 
  message = 'Laden...', 
  fullScreen = true,
  size = 'large',
  color = colors.primary,
}) => {
  const containerStyle = fullScreen ? styles.fullScreen : styles.inline;
  
  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  inline: {
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});

export default LoadingState;
