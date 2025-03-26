import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import SearchBar from '../components/SearchBar';
import FilterButtons from '../components/FilterButtons';

const MapScreen = () => {
  const filters = ['Alle', 'Öffentlich', 'Geschäfte', 'Freizeit', 'Vereine'];
  
  const locations = [
    {
      id: 1,
      title: 'Rathaus',
      description: 'Gemeindeverwaltung',
      coordinate: {
        latitude: 53.5511,
        longitude: 9.9937,
      },
    },
    {
      id: 2,
      title: 'Sportplatz',
      description: 'Fußballverein',
      coordinate: {
        latitude: 53.5521,
        longitude: 9.9947,
      },
    },
    {
      id: 3,
      title: 'Gemeindehaus',
      description: 'Veranstaltungsort',
      coordinate: {
        latitude: 53.5501,
        longitude: 9.9927,
      },
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar placeholder="Ort oder Adresse suchen..." />
        <FilterButtons filters={filters} />
      </View>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 53.5511,
          longitude: 9.9937,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {locations.map((location) => (
          <Marker
            key={location.id}
            coordinate={location.coordinate}
            title={location.title}
            description={location.description}
          />
        ))}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingBottom: 8,
  },
  map: {
    flex: 1,
  },
});

export default MapScreen; 