import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, ActivityIndicator, Alert } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../lib/supabase'; // Adjust path if necessary
import { useOrganization } from '../context/OrganizationContext'; // Import Organization context
import { useAuth } from '../context/AuthContext'; // Import Auth context
import Constants from 'expo-constants';
import { useAppConfig } from '../context/AppConfigContext';

// Helper to interpret boolean-like env values
const isTrue = (val) => val === true || val === 'true' || val === '1';

// We will fetch map disable flag dynamically via AppConfig; keep fallback for early render
const disableMapEnvFallback = isTrue(process.env.EXPO_PUBLIC_DISABLE_MAP) || isTrue(Constants?.expoConfig?.extra?.disableMap);

const MapScreen = ({ navigation }) => {
  const { isOrganizationActive, activeOrganizationId } = useOrganization(); // Get org state
  const { user } = useAuth(); // Get user state

  const [activeFilter, setActiveFilter] = useState('Alle');
  const [mapConfig, setMapConfig] = useState(null);
  const [pois, setPois] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingPois, setLoadingPois] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Map Configuration and POIs on mount
  const fetchData = useCallback(async () => {
    setLoadingConfig(true);
    setLoadingPois(true);
    setError(null);

    try {
      // Fetch Map Config (remains the same)
      const { data: configData, error: configError } = await supabase
        .from('map_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (configError) throw configError;
      if (!configData) throw new Error("Map configuration not found.");
      setMapConfig(configData);

      // Fetch POIs based on organization context -- REMOVED CONDITIONAL LOGIC
      let query = supabase.from('map_pois').select('*');

      /* // REMOVED Client-side filtering - RLS policy now handles visibility
      if (isOrganizationActive && activeOrganizationId && user) {
          // Fetch public POIs OR POIs belonging to the active organization
          query = query.or(`organization_id.is.null,organization_id.eq.${activeOrganizationId}`);
      } else {
          // Fetch only public POIs if no org context or user not logged in
          query = query.is('organization_id', null);
      }
      */

      const { data: poisData, error: poisError } = await query;

      if (poisError) throw poisError;
      setPois(poisData || []);

    } catch (err) {
      console.error("Error fetching map data:", err);
      setError(err.message || "Failed to load map data.");
      // Alert.alert("Fehler", "Karteninformationen konnten nicht geladen werden."); // Avoid alert loops on focus
    } finally {
      setLoadingConfig(false);
      setLoadingPois(false);
    }
  }, [isOrganizationActive, activeOrganizationId, user]); // Depend on org state and user

  // Fetch data initially and when org context changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Add a small delay to ensure component is mounted before fetching
      setTimeout(() => {
        console.log('MapScreen focused - refreshing data');
        fetchData(); // Refetch POIs when screen is focused
      }, 100);
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  // Function to handle filter changes from ScreenHeader/FilterButtons
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  // Function to handle POI deletion
  const handleDeletePoi = async (poiId, poiTitle) => {
      if (!user || !isOrganizationActive) return; // Should not happen if button is shown correctly
      if (isDeleting) return; // Prevent double taps

      Alert.alert(
          'Ort löschen',
          `Möchtest du den Ort "${poiTitle}" wirklich löschen?`,
          [
              { text: 'Abbrechen', style: 'cancel' },
              {
                  text: 'Löschen', style: 'destructive', onPress: async () => {
                      setIsDeleting(true);
                      try {
                          const { error: deleteError } = await supabase
                              .from('map_pois')
                              .delete()
                              .eq('id', poiId)
                              // RLS ensures only authorized members can delete
                              .eq('organization_id', activeOrganizationId);

                          if (deleteError) {
                              throw deleteError;
                          }

                          Alert.alert('Erfolg', 'Ort erfolgreich gelöscht.');
                          // Refresh POIs on the map
                          await fetchData();

                      } catch (err) {
                          console.error("Error deleting POI:", err);
                          Alert.alert('Fehler', 'Ort konnte nicht gelöscht werden.');
                      } finally {
                          setIsDeleting(false);
                      }
                  }
              }
          ]
      );
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
  } : null;

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
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
             <Text style={styles.retryButtonText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format filters for ScreenHeader
  const formattedMapFilters = (mapConfig?.map_filters || ['Alle']).map(filterName => ({
      name: filterName,
      is_highlighted: false
  }));

  return (
    <View style={styles.container}>
      <ScreenHeader
        filters={formattedMapFilters}
        onFilterChange={handleFilterChange}
        initialFilter={activeFilter}
      />

      <View style={styles.mapContainer}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={initialRegion}
        >
          {filteredPois.map(poi => {
            // Check if the current user can delete this POI only in organization context
            const canDelete = user && isOrganizationActive && poi.organization_id === activeOrganizationId;
            return (
              <Marker
                key={poi.id}
                coordinate={{
                  latitude: Number(poi.latitude),
                  longitude: Number(poi.longitude)
                }}
                pinColor="red" // All pins red
                title={poi.title}
                description={poi.description}
              >
                <Callout tooltip onPress={() => {
                  // Prevent default Callout behavior if delete button exists
                  if (canDelete) return;
                  // Otherwise, maybe navigate to a detail view in the future?
                }}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{poi.title}</Text>
                    {poi.description && <Text style={styles.calloutDescription}>{poi.description}</Text>}
                    {canDelete && (
                       <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeletePoi(poi.id, poi.title)}
                          disabled={isDeleting}
                       >
                         <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                         <Text style={styles.deleteButtonText}>Löschen</Text>
                       </TouchableOpacity>
                    )}
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        {/* Map controls removed for simplicity, can be added back if needed */}
        {/* <View style={styles.mapControls}> ... </View> */}

      </View>

      {/* Show Add button only if an organization context is active and user logged in */}
      {isOrganizationActive && user && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreatePoi')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
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
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  // Removed mapControls styles
  addButton: { // Style copied from ChatScreen
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 6,
    width: 200, // Adjust width as needed
    borderColor: '#ccc',
    borderWidth: 0.5,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  calloutDescription: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe5e5', // Light red background
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 5,
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '500',
  },
});

// Stub component shown when map is disabled
const DisabledMapScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
    <Ionicons name="map-outline" size={40} color="#888" />
    <Text style={{ marginTop: 10, color: '#666', fontSize: 16, textAlign: 'center' }}>Karte ist aktuell deaktiviert.</Text>
  </View>
);

// --- Wrapper component selecting between enabled/disabled map based on remote config ---
const MapScreenWrapper = (props) => {
  const { config, loading } = useAppConfig();
  const isMapDisabled = loading
    ? disableMapEnvFallback
    : isTrue(config.EXPO_PUBLIC_DISABLE_MAP);

  if (loading) {
    // Reuse centered style for loading
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  if (isMapDisabled) {
    return <DisabledMapScreen {...props} />;
  }
  return <MapScreen {...props} />;
};

export default MapScreenWrapper; 