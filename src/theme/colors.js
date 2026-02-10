/**
 * Color Palette - MyLocalApp
 * 
 * Usage:
 *   import { colors } from '../theme/colors';
 *   style={{ backgroundColor: colors.primary }}
 */

export const colors = {
  // Primary brand colors
  primary: '#4285F4',        // Google Blue - Main CTA
  primaryLight: '#e7f0fe',   // Light blue background
  primaryDark: '#3367d6',    // Darker blue for hover/press
  
  // Secondary colors
  secondary: '#3F51B5',      // Indigo
  accent: '#007BFF',         // Bootstrap blue
  
  // Status colors
  success: '#34A853',        // Google Green
  error: '#ff3b30',          // iOS Red
  errorDark: '#dc3545',      // Bootstrap Red
  warning: '#FBBC04',        // Google Yellow
  
  // Neutral colors
  white: '#ffffff',
  black: '#000000',
  
  // Grays (light to dark)
  gray50: '#f8f8f8',
  gray100: '#f1f1f1',
  gray200: '#f0f0f0',
  gray300: '#e0e0e0',
  gray400: '#bdbdbd',
  gray500: '#9e9e9e',
  gray600: '#6c757d',
  gray700: '#495057',
  gray800: '#343a40',
  gray900: '#212529',
  
  // Semantic aliases
  background: '#f8f8f8',
  surface: '#ffffff',
  textPrimary: '#212529',
  textSecondary: '#6c757d',
  border: '#e0e0e0',
  divider: '#f1f1f1',
  
  // Interactive states
  ripple: 'rgba(66, 133, 244, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // Card backgrounds
  cardBackground: '#ffffff',
  cardHighlight: '#eef4ff',
};

export default colors;
