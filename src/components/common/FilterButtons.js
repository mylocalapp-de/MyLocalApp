import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const FilterButtons = ({ filters = [], onFilterChange = () => {}, initialFilter = 'Alle' }) => {
  const [selectedFilterName, setSelectedFilterName] = useState(initialFilter);

  useEffect(() => {
    setSelectedFilterName(initialFilter);
  }, [initialFilter]);

  const selectFilter = (filterName) => {
    setSelectedFilterName(filterName);
    onFilterChange(filterName);
  };

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {filters.map((filter, index) => {
        const isSelected = selectedFilterName === filter.name;
        const isHighlighted = filter.is_highlighted && !isSelected;

        const buttonStyle = [
          styles.filterButton,
          isSelected && styles.selectedFilter,
        ];

        const textStyle = [
          styles.filterTextBase,
          isSelected ? styles.selectedFilterText : styles.filterText,
        ];

        return (
          <TouchableOpacity
            key={filter.name || index}
            style={buttonStyle}
            onPress={() => selectFilter(filter.name)}
          >
            {isHighlighted ? (
              <LinearGradient
                colors={['#FFF9C4', '#FFE0B2']}
                style={styles.gradientWrapper}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={textStyle}>
                  {filter.name}
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.textWrapper}>
                <Text style={textStyle}>
                  {filter.name}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // Remove default bottom margin to avoid extra gap under the header
    marginBottom: 0,
  },
  contentContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterButton: {
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  selectedFilter: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  gradientWrapper: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  textWrapper: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  filterTextBase: {
    fontSize: 12,
  },
  filterText: {
    color: '#333',
  },
  selectedFilterText: {
    color: '#fff',
  },
});

export default FilterButtons; 