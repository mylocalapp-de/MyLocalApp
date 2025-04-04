import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, ActivityIndicator, Alert } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../lib/supabase'; // Adjust path if necessary

const MapScreen = () => {
  const [activeFilter, setActiveFilter] = useState('Alle');
  const [mapConfig, setMapConfig] = useState(null);
  const [pois, setPois] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingPois, setLoadingPois] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Map Configuration and POIs on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingConfig(true);
      setLoadingPois(true);
      setError(null);

      try {
        // Fetch Map Config (expects only one row with id=1)
        const { data: configData, error: configError } = await supabase
          .from('map_config')
          .select('*')
          .eq('id', 1)
          .maybeSingle(); // Use maybeSingle() as we expect 0 or 1 row

        if (configError) throw configError;
        if (!configData) throw new Error("Map configuration not found.");
        setMapConfig(configData);

        // Fetch POIs
        const { data: poisData, error: poisError } = await supabase
          .from('map_pois')
          .select('*'); // Select all POIs

        if (poisError) throw poisError;
        setPois(poisData || []); // Ensure pois is an array even if null response

      } catch (err) {
        console.error("Error fetching map data:", err);
        setError(err.message || "Failed to load map data.");
        Alert.alert("Fehler", "Karteninformationen konnten nicht geladen werden.");
      } finally {
        setLoadingConfig(false);
        setLoadingPois(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array means run once on mount

  // Function to handle filter changes from ScreenHeader/FilterButtons
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  // Filter POIs based on the active filter
  const filteredPois = activeFilter === 'Alle'
    ? pois
    : pois.filter(poi => poi.category === activeFilter);

  // Derive initialRegion from mapConfig once loaded
  const initialRegion = mapConfig ? {
    latitude: Number(mapConfig.initial_latitude),
    longitude: Number(mapConfig.initial_longitude),
    latitudeDelta: Number(mapConfig.initial_latitude_delta),
    longitudeDelta: Number(mapConfig.initial_longitude_delta),
  } : null; // Provide null or a default if config isn't loaded yet

  // Show loading indicator while data is fetching
  if (loadingConfig || loadingPois || !initialRegion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Lade Kartendaten...</Text>
      </View>
    );
  }

  // Show error message if fetching failed
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Fehler: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        filters={mapConfig?.map_filters || ['Alle']} // Use fetched filters, default to ['Alle']
        onFilterChange={handleFilterChange} // Pass handler down
        initialFilter={activeFilter}      // Pass current filter state
      />

      <View style={styles.mapContainer}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={initialRegion} // Use derived initialRegion
        >
          {/* Markers for POIs - now uses filteredPois */}
          {filteredPois.map(poi => (
            <Marker
              key={poi.id}
              coordinate={{
                latitude: Number(poi.latitude), // Ensure coordinates are numbers
                longitude: Number(poi.longitude)
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
  centered: { // Style for loading/error states
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
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
    // Removed borderBottom to apply to last button correctly if needed
  },
  // Add border only between buttons if needed
  controlButtonSeparator: {
     borderBottomWidth: 1,
     borderBottomColor: '#f0f0f0',
  }
});

export default MapScreen; 