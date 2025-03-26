import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const FilterButtons = ({ filters = [], onFilterChange = () => {} }) => {
  const [selectedFilter, setSelectedFilter] = useState('Alle');

  const selectFilter = (filter) => {
    setSelectedFilter(filter);
    onFilterChange(filter); // Pass the selected filter back to parent component
  };

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {filters.map((filter, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.filterButton,
            selectedFilter === filter && styles.selectedFilter
          ]}
          onPress={() => selectFilter(filter)}
        >
          <Text 
            style={[
              styles.filterText,
              selectedFilter === filter && styles.selectedFilterText
            ]}
          >
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  contentContainer: {
    paddingHorizontal: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedFilter: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  filterText: {
    fontSize: 12,
    color: '#333',
  },
  selectedFilterText: {
    color: '#fff',
  },
});

export default FilterButtons; 