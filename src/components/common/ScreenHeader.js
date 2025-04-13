import React from 'react';
import { View, StyleSheet, Text, Platform, SafeAreaView, Dimensions } from 'react-native';
import { useFonts, Lobster_400Regular } from '@expo-google-fonts/lobster';
import Constants from 'expo-constants';
import FilterButtons from './FilterButtons';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03; // 3% of screen height for better scaling

const ScreenHeader = ({ title, filters = [], onFilterChange, initialFilter = 'Aktuell' }) => {
  let [fontsLoaded] = useFonts({
    Lobster_400Regular,
  });

  const appName = Constants.expoConfig?.name || 'MeinHavelaue';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={[styles.appName, fontsLoaded && { fontFamily: 'Lobster_400Regular' }]}>
          {appName}
        </Text>
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
  appName: {
    fontSize: 28,
    color: '#333',
    paddingBottom: 5,
  },
});

export default ScreenHeader; 