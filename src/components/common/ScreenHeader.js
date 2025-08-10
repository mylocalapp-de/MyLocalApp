import React from 'react';
import { View, StyleSheet, Text, Platform, Dimensions, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Lobster_400Regular } from '@expo-google-fonts/lobster';
import Constants from 'expo-constants';
import FilterButtons from './FilterButtons';
import { useNetwork } from '../../context/NetworkContext';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03; // 3% of screen height for better scaling

const ScreenHeader = ({ 
  title, 
  filters = [], 
  onFilterChange, 
  initialFilter = 'Aktuell', 
  showBackButton = false, 
  navigation,
  showFilterButton = false,
  onFilterButtonPress,
  showBlockButton = false,
  onBlockToggle,
  isBlocked = false,
  blockLoading = false,
  // Search related props
  showSearch = false,
  searchQuery = '',
  onSearchChange
}) => {
  const { isOfflineMode, toggleOfflineMode } = useNetwork();

  let [fontsLoaded] = useFonts({
    Lobster_400Regular,
  });

  const appName = Constants.expoConfig?.name || 'MeinStrodehne';

  const handleExitOfflineMode = () => {
    toggleOfflineMode(false);
  };

  const renderRightContent = () => {
    if (showBlockButton && onBlockToggle) {
      const iconName = isBlocked ? 'checkmark-circle' : 'ban-outline';
      const buttonText = isBlocked ? 'Entsperrt' : 'Blockieren';
      const buttonColor = isBlocked ? '#4CAF50' : '#ff3b30';

      return (
        <TouchableOpacity
          style={[styles.blockButton, { borderColor: buttonColor, backgroundColor: 'transparent' }]}
          onPress={onBlockToggle}
          disabled={blockLoading}
        >
          {blockLoading ? (
            <ActivityIndicator size="small" color={buttonColor} style={styles.blockLoader} />
          ) : (
            <Ionicons name={iconName} size={16} color={buttonColor} style={styles.blockIcon} />
          )}
          <Text style={[styles.blockButtonText, { color: buttonColor }]}>  
            {blockLoading ? (isBlocked ? 'Entsperre' : 'Blockieren') : buttonText}
          </Text>
        </TouchableOpacity>
      );
    } else if (showFilterButton && onFilterButtonPress) {
      return (
        <TouchableOpacity onPress={onFilterButtonPress} style={styles.filterIconContainer}>
          <Ionicons name="options-outline" size={24} color="#4285F4" />
        </TouchableOpacity>
      );
    }
    return null; // No button if neither block nor filter is shown
  };

  const rightContent = renderRightContent();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        {showBackButton && navigation ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#4285F4" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
        <Text 
          style={[
            styles.titleText,
            fontsLoaded && { fontFamily: 'Lobster_400Regular' },
            !title && styles.appNameStyle
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title || appName}
        </Text>
        { rightContent ? (
          <TouchableOpacity onPress={onBlockToggle} style={styles.iconButton} disabled={blockLoading}>
            {rightContent}
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
      {filters.length > 0 && (
        <FilterButtons 
          filters={filters} 
          onFilterChange={onFilterChange} 
          initialFilter={initialFilter} 
        />
      )}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Suchen..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 44,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  iconButton: {
    padding: 8,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
  titleText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  appNameStyle: {
    fontSize: 24,
    fontWeight: 'normal',
  },
  filterIconContainer: {
    padding: 5,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 8,
  },
  blockIcon: {
    marginRight: 4,
  },
  blockLoader: {
    marginRight: 4,
  },
  blockButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // --- Search styles ---
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
});

export default ScreenHeader; 