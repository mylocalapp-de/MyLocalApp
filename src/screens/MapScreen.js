import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const MapScreen = () => {
  // Placeholder filters for map screen
  const mapFilters = ['Alle', 'Sehenswürdigkeiten', 'Behörden', 'Restaurants', 'Events'];
  
  // Sample POIs (Points of Interest)
  const pois = [
    {
      id: 1,
      title: 'Rathaus',
      description: 'Öffnungszeiten: Mo-Fr 8-16 Uhr',
      latitude: 50.110924,
      longitude: 8.682127,
      category: 'Behörden'
    },
    {
      id: 2,
      title: 'Dorfplatz',
      description: 'Zentrum des Dorflebens',
      latitude: 50.115924,
      longitude: 8.685127,
      category: 'Sehenswürdigkeiten'
    },
    {
      id: 3,
      title: 'Gasthof zur Linde',
      description: 'Traditionelle deutsche Küche',
      latitude: 50.112924,
      longitude: 8.688127,
      category: 'Restaurants'
    }
  ];

  // Initial map region
  const initialRegion = {
    latitude: 50.112924,
    longitude: 8.682127,
    latitudeDelta: 0.015,
    longitudeDelta: 0.0121,
  };

  return (
    <View style={styles.container}>
      <ScreenHeader filters={mapFilters} />
      
      <View style={styles.mapContainer}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={initialRegion}
        >
          {pois.map(poi => (
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