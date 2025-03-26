import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const FilterButtons = ({ filters = [] }) => {
  const [selectedFilters, setSelectedFilters] = useState([]);

  const toggleFilter = (filter) => {
    if (selectedFilters.includes(filter)) {
      setSelectedFilters(selectedFilters.filter(f => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
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
            selectedFilters.includes(filter) && styles.selectedFilter
          ]}
          onPress={() => toggleFilter(filter)}
        >
          <Text 
            style={[
              styles.filterText,
              selectedFilters.includes(filter) && styles.selectedFilterText
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