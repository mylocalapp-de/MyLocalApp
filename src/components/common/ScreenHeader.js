import React from 'react';
import { View, StyleSheet, Text, Platform, SafeAreaView, Dimensions, TouchableOpacity } from 'react-native';
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
  navigation 
}) => {
  const { isOfflineMode, toggleOfflineMode } = useNetwork();

  let [fontsLoaded] = useFonts({
    Lobster_400Regular,
  });

  const appName = Constants.expoConfig?.name || 'MeinHavelaue';

  const handleExitOfflineMode = () => {
    toggleOfflineMode(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          {showBackButton && navigation && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={26} color="#4285F4" />
            </TouchableOpacity>
          )}
          <Text 
            style={[
              styles.titleText,
              !title && styles.appNameStyle,
              fontsLoaded && !title && { fontFamily: 'Lobster_400Regular' },
              showBackButton && styles.titleWithBackButton
            ]}
          >
            {title || appName}
          </Text>
          {isOfflineMode && (
            <TouchableOpacity onPress={handleExitOfflineMode} style={styles.offlineButton}>
              <Text style={styles.offlineButtonText}>Offline verlassen</Text>
            </TouchableOpacity>
          )}
        </View>
        {filters.length > 0 && (
          <FilterButtons 
            filters={filters} 
            onFilterChange={onFilterChange} 
            initialFilter={initialFilter} 
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
  },
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    minHeight: 40,
    marginBottom: 5,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 5,
    zIndex: 1,
  },
  titleText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  appNameStyle: {
    fontSize: 28,
    fontWeight: 'normal',
  },
  titleWithBackButton: {
  },
  offlineButton: {
    position: 'absolute',
    right: 0,
    backgroundColor: '#ffc107',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignSelf: 'center',
  },
  offlineButtonText: {
    color: '#333',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default ScreenHeader; 