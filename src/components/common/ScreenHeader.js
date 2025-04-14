import React from 'react';
import { View, StyleSheet, Text, Platform, SafeAreaView, Dimensions, TouchableOpacity } from 'react-native';
import { useFonts, Lobster_400Regular } from '@expo-google-fonts/lobster';
import Constants from 'expo-constants';
import FilterButtons from './FilterButtons';
import { useNetwork } from '../../context/NetworkContext';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03; // 3% of screen height for better scaling

const ScreenHeader = ({ title, filters = [], onFilterChange, initialFilter = 'Aktuell' }) => {
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
          <Text style={[styles.appName, fontsLoaded && { fontFamily: 'Lobster_400Regular' }]}>
            {appName}
          </Text>
          {isOfflineMode && (
            <TouchableOpacity onPress={handleExitOfflineMode} style={styles.offlineButton}>
              <Text style={styles.offlineButtonText}>Offline Modus verlassen</Text>
            </TouchableOpacity>
          )}
        </View>
        <FilterButtons 
          filters={filters} 
          onFilterChange={onFilterChange} 
          initialFilter={initialFilter} 
        />
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
    marginBottom: 5,
  },
  appName: {
    fontSize: 28,
    color: '#333',
    paddingBottom: 0,
  },
  offlineButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    marginLeft: 10,
  },
  offlineButtonText: {
    color: '#333',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ScreenHeader; 