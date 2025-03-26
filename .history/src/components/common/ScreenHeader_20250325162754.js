import React from 'react';
import { View, StyleSheet, Text, Platform, SafeAreaView } from 'react-native';
import SearchBar from './SearchBar';
import FilterButtons from './FilterButtons';

const ScreenHeader = ({ title, filters = [] }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <SearchBar />
        <FilterButtons filters={filters} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
  },
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
});

export default ScreenHeader; 