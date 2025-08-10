import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import Constants from 'expo-constants'; // To access app.config extra

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05;

const googleMapsApiKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;

const CreatePoiScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);

  // UI State
  const [isLoading, setIsLoading] = useState(false); // Loading categories or geocoding
  const [isSaving, setIsSaving] = useState(false); // Saving to Supabase
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch categories from map_config
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const { data, error } = await supabase
          .from('map_config')
          .select('map_filters')
          .eq('id', 1)
          .single();

        if (error) throw error;

        // Ensure 'Alle' is not included as a selectable category
        const categories = (data?.map_filters || []).filter(f => f !== 'Alle');
        setAvailableCategories(categories);
        if (categories.length > 0) {
          setCategory(categories[0]); // Set default category
        }
      } catch (err) {
        console.error("Error fetching map categories:", err);
        Alert.alert('Fehler', 'Kategorien konnten nicht geladen werden.');
        setAvailableCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Geocode Address using Google Geocoding API
  const geocodeAddress = async () => {
    if (!address.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine Adresse ein.');
      return false;
    }
    if (!googleMapsApiKey) {
        Alert.alert('Fehler', 'Google Maps API Key nicht konfiguriert.');
        return false;
    }

    setIsLoading(true);
    setLatitude(null);
    setLongitude(null);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        setLatitude(location.lat);
        setLongitude(location.lng);
        setIsLoading(false);
        return true; // Geocoding successful
      } else {
        console.warn('Geocoding failed:', data.status, data.error_message);
        Alert.alert('Fehler', `Adresse konnte nicht gefunden werden (${data.status}). Bitte prüfe die Eingabe.`);
        setIsLoading(false);
        return false; // Geocoding failed
      }
    } catch (error) {
      console.error('Error during geocoding request:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Abrufen der Koordinaten.');
      setIsLoading(false);
      return false; // Geocoding failed
    }
  };

  // Validate Form
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
      return false;
    }
    if (!address.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine Adresse ein.');
      return false;
    }
     if (!category) {
      Alert.alert('Fehler', 'Bitte wähle eine Kategorie aus.');
      return false;
    }
    // Description is optional
    return true;
  };

  // Handle Save
  const handleSave = async () => {
    if (!user || !activeOrganizationId) {
      Alert.alert('Fehler', 'Du musst Teil einer Organisation sein, um einen POI hinzuzufügen.');
      return;
    }
    if (!validateForm()) return;

    // Geocode address first
    const geocodingSuccess = await geocodeAddress();
    if (!geocodingSuccess || latitude === null || longitude === null) {
        // Error message already shown by geocodeAddress
        return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('map_pois')
        .insert({
          title: title.trim(),
          description: description.trim() || null, // Allow empty description
          latitude: latitude,
          longitude: longitude,
          category: category,
          organization_id: activeOrganizationId,
          author_id: user.id,
        });

      if (error) {
        console.error("Error saving POI:", error);
        Alert.alert('Fehler', 'POI konnte nicht gespeichert werden. Datenbankfehler.');
        return;
      }

      Alert.alert('Erfolg', 'POI erfolgreich hinzugefügt!');
      navigation.goBack(); // Or navigate to MapScreen potentially refreshing it

    } catch (err) {
      console.error('Unexpected error saving POI:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSaving(false);
      setIsLoading(false); // Ensure loading indicator is off
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isSaving || isLoading}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neuen Ort hinzufügen</Text>
        <View style={styles.headerRight}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <TouchableOpacity
              style={styles.actionButtonHeader}
              onPress={handleSave}
              disabled={isLoading} // Disable save while geocoding
            >
              <Text style={styles.actionButtonHeaderText}>Speichern</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formKeyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          style={styles.formScrollView}
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.inputLabel}>Titel</Text>
          <TextInput
            style={styles.input}
            placeholder="Name des Ortes..."
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            editable={!isSaving && !isLoading}
          />

          <Text style={styles.inputLabel}>Adresse</Text>
          <TextInput
            style={styles.input}
            placeholder="Vollständige Adresse..."
            value={address}
            onChangeText={setAddress}
            editable={!isSaving && !isLoading}
            // Optionally add onBlur={geocodeAddress} for real-time check
          />
          {isLoading && <ActivityIndicator size="small" color="#4285F4" style={styles.geocodeLoader} />}
          {latitude && longitude && !isLoading && (
             <Text style={styles.coordsText}>Koordinaten: {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
          )}


          <Text style={styles.inputLabel}>Beschreibung (Optional)</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Zusätzliche Informationen..."
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            editable={!isSaving && !isLoading}
          />

          <Text style={styles.inputLabel}>Kategorie</Text>
          {loadingCategories ? (
              <ActivityIndicator style={{ marginTop: 10 }}/>
          ) : availableCategories.length > 0 ? (
              <View style={styles.pickerWrapper}>
                  <Picker
                      selectedValue={category}
                      onValueChange={(itemValue) => setCategory(itemValue)}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                      enabled={!isSaving && !isLoading}
                  >
                      {availableCategories.map((cat) => (
                          <Picker.Item key={cat} label={cat} value={cat} />
                      ))}
                  </Picker>
              </View>
          ) : (
              <Text style={styles.infoText}>Keine Kategorien verfügbar.</Text>
          )}

          {/* Spacer */}
          <View style={{ height: 80 }} />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: 5,
    minWidth: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  headerRight: {
    minWidth: 70, // Adjusted width for 'Speichern' text
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButtonHeader: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonHeaderText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  formKeyboardAvoidingView: {
    flex: 1,
  },
  formScrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 15,
    paddingBottom: 30,
    backgroundColor: '#ffffff',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#f1f3f5',
    borderWidth: 1,
    borderColor: '#ced4da',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
    marginBottom: 5, // Reduced margin
    color: '#495057',
  },
  descriptionInput: {
    backgroundColor: '#f1f3f5',
    borderWidth: 1,
    borderColor: '#ced4da',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
    color: '#495057',
  },
  pickerWrapper: {
    backgroundColor: '#f1f3f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ced4da',
    marginBottom: 20,
    height: Platform.OS === 'android' ? 50 : undefined, // Adjust for Android
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? 150 : 50,
  },
  pickerItem: {
      height: 150, // For iOS picker item height
  },
  infoText: {
    fontStyle: 'italic',
    color: '#6c757d',
    marginTop: 10,
    marginBottom: 20,
  },
  geocodeLoader: {
      marginTop: 5,
      marginBottom: 5,
      alignSelf: 'flex-start',
  },
  coordsText: {
      fontSize: 12,
      color: '#28a745', // Green color for success
      marginTop: 2,
      marginBottom: 15,
      fontStyle: 'italic',
  }
});

export default CreatePoiScreen; 