import React from 'react';
import { View, StyleSheet, Text, Platform, SafeAreaView, Dimensions } from 'react-native';
import SearchBar from './SearchBar';
import FilterButtons from './FilterButtons';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 3% of screen height for better scaling

const ScreenHeader = ({ title, filters = [], onFilterChange, initialFilter = 'Aktuell' }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <SearchBar />
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
  },
});

export default ScreenHeader; 