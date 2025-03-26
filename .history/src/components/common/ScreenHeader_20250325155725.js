import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import SearchBar from './SearchBar';
import FilterButtons from './FilterButtons';

const ScreenHeader = ({ title, filters = [] }) => {
  return (
    <View style={styles.container}>
      <SearchBar />
      <FilterButtons filters={filters} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
});

export default ScreenHeader; 