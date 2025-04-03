import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const MapScreen = () => {
  const [activeFilter, setActiveFilter] = useState('Alle');

  // Placeholder filters for map screen - added Hotels
  const mapFilters = ['Alle', 'Sehenswürdigkeiten', 'Behörden', 'Restaurants', 'Hotels', 'Events'];
  
  // Sample POIs (Points of Interest) in Havelaue
  const pois = [
    {
      id: 1,
      title: 'Rathaus Amt Rhinow',
      description: 'Verwaltung für Havelaue',
      latitude: 52.7485,
      longitude: 12.3415,
      category: 'Behörden'
    },
    {
      id: 2,
      title: 'Dorfplatz Strodehne',
      description: 'Zentrum von Strodehne',
      latitude: 52.7755,
      longitude: 12.3100,
      category: 'Sehenswürdigkeiten'
    },
    {
      id: 3,
      title: 'Gasthaus Zur Alten Fähre',
      description: 'Regionale Küche in Strodehne',
      latitude: 52.7761,
      longitude: 12.3078,
      category: 'Restaurants'
    },
    {
      id: 4,
      title: 'Kirche Strodehne',
      description: 'Historische Dorfkirche',
      latitude: 52.7765,
      longitude: 12.3105,
      category: 'Sehenswürdigkeiten'
    },
    {
      id: 5,
      title: 'Naturschutzgebiet Untere Havel Nord',
      description: 'Einzigartige Flusslandschaft',
      latitude: 52.75,
      longitude: 12.40,
      category: 'Sehenswürdigkeiten'
    },
    {
      id: 6,
      title: 'Hotel Havellandidyll',
      description: 'Übernachtung und Restaurant',
      latitude: 52.7450,
      longitude: 12.3380,
      category: 'Hotels'
    },
    {
      id: 7,
      title: 'Feuerwehr Wolsier',
      description: 'Freiwillige Feuerwehr',
      latitude: 52.7300,
      longitude: 12.3800,
      category: 'Behörden'
    }
  ];

  // Initial map region centered on Havelaue
  const initialRegion = {
    latitude: 52.76,
    longitude: 12.35,
    latitudeDelta: 0.2, // Zoom level adjusted to show Havelaue area
    longitudeDelta: 0.15, // Zoom level adjusted to show Havelaue area
  };

  // Function to handle filter changes from ScreenHeader/FilterButtons
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  // Filter POIs based on the active filter
  const filteredPois = activeFilter === 'Alle'
    ? pois
    : pois.filter(poi => poi.category === activeFilter);

  return (
    <View style={styles.container}>
      <ScreenHeader 
        filters={mapFilters} 
        onFilterChange={handleFilterChange} // Pass handler down
        initialFilter={activeFilter}      // Pass current filter state
      />
      
      <View style={styles.mapContainer}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={initialRegion}
        >
          {/* Markers for POIs - now uses filteredPois */}
          {filteredPois.map(poi => (
            <Marker
              key={poi.id}
              coordinate={{
                latitude: poi.latitude,
                longitude: poi.longitude
              }}
              title={poi.title}
              description={poi.description}
            />
          ))}
        </MapView>
        
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="locate" size={24} color="#4285F4" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="add" size={24} color="#4285F4" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="remove" size={24} color="#4285F4" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});

export default MapScreen; 