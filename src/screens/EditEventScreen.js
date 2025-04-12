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
  SafeAreaView,
  Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

const EditEventScreen = ({ navigation, route }) => {
  const { eventId } = route.params;
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();

  // Event form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAsset, setImageAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);

  // Load event data and categories
  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  // Fetch event data and categories
  const fetchEventData = async () => {
    setIsLoading(true);
    setLoadingCategories(true);
    setError(null);

    try {
      // Fetch event categories first
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('event_categories')
        .select('name')
        .order('display_order', { ascending: true });

      if (categoriesError) {
        console.error('Error fetching event categories:', categoriesError);
        Alert.alert('Fehler', 'Event-Kategorien konnten nicht geladen werden.');
        setAvailableCategories([]);
      } else {
        setAvailableCategories(categoriesData?.map(cat => cat.name) || []);
      }
      setLoadingCategories(false);

      // Now fetch the event itself
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
        setError('Could not load event. Please try again later.');
        setIsLoading(false); // Stop overall loading
        return;
      }

      if (!data) {
        setError('Event not found.');
        setIsLoading(false); // Stop overall loading
        return;
      }

      // --- Authorization Check --- 
      let canEdit = false;
      if (!data.organization_id) { // Personal Event
        canEdit = data.organizer_id === user?.id && !activeOrganizationId;
      } else { // Organizational Event
        if (activeOrganizationId !== data.organization_id) {
          canEdit = false;
        } else {
          try {
            const { data: membership, error: memberError } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', data.organization_id)
              .eq('user_id', user?.id)
              .maybeSingle();
            if (!memberError && membership) {
              canEdit = true;
            }
          } catch(e) {
            console.error("Unexpected error checking membership:", e);
            canEdit = false;
          }
        }
      }

      if (!canEdit) {
          setError('You are not authorized to edit this event.');
          Alert.alert('Fehler', 'Du bist nicht berechtigt, dieses Event zu bearbeiten.');
          navigation.goBack();
          return;
      }
      // --- End Authorization Check ---

      // Set form values
      setTitle(data.title || '');
      setDescription(data.description || '');
      setLocation(data.location || '');
      setCategory(data.category || '');
      setImageUrl(data.image_url || '');
      setImageAsset(null);
      setRemoveCurrentImage(false);

      // Parse date and time from DB format
      const eventDate = new Date(data.date);
      setDate(eventDate);
      // Extract time (assuming format "Um HH:MM")
      const timeMatch = data.time?.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        const eventTime = new Date();
        eventTime.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
        setTime(eventTime);
      } else {
        setTime(new Date()); // Default to now if parsing fails
      }

    } catch (err) {
      console.error('Unexpected error fetching event:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate form before submission
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine Beschreibung ein.');
      return false;
    }
    if (!location.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Ort ein.');
      return false;
    }
    if (!category) {
      Alert.alert('Fehler', 'Bitte wähle eine Kategorie aus.');
      return false;
    }
    return true;
  };

  // Handle event update
  const handleUpdate = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um ein Event zu aktualisieren.');
      return;
    }

    if (!validateForm()) return;

    setIsSaving(true);
    let finalImageUrl = imageUrl;

    try {
      // Scenario 1: New image selected for upload
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) {
          setIsSaving(false);
          return; // Upload failed, stop update
        }
        // TODO: Delete old image from storage if it existed
        // Requires knowing the old file path/name if imageUrl was not empty before upload
      }
      // Scenario 2: Existing image flagged for removal
      else if (removeCurrentImage) {
        finalImageUrl = null;
        // TODO: Delete old image from storage if imageUrl was not empty before removal
      }
      // Scenario 3: Keep existing image (finalImageUrl already holds it)
      // No action needed for this case

      // Format date and time
      const formattedDate = date.toISOString().split('T')[0];
      const formattedTime = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });

      // Directly update the event including image_url
      const { error } = await supabase
        .from('events')
        .update({
          title: title,
          description: description,
          date: formattedDate,
          time: `Um ${formattedTime}`,
          location: location,
          category: category,
          image_url: finalImageUrl,
        })
        .eq('id', eventId);

      if (error) {
        console.error('Error updating event:', error);
        Alert.alert('Fehler', 'Event konnte nicht aktualisiert werden. Prüfe die RLS Policies oder Datenbankverbindung.');
        setIsSaving(false);
        return;
      }

      Alert.alert(
        'Erfolg',
        'Dein Event wurde erfolgreich aktualisiert!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to EventDetail, potentially refreshing it
              navigation.navigate('CalendarList'); // Go back to list first
              setTimeout(() => {
                  navigation.navigate('EventDetail', { eventId }); // Then go to detail
              }, 100);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Unexpected error updating event:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  // Handle date selection
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  // Handle time selection
  const onTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || time;
    setShowTimePicker(Platform.OS === 'ios');
    setTime(currentTime);
  };

  // Render category selection buttons
  const renderCategoryButtons = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeButtonsContainer}
      >
        {loadingCategories ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : availableCategories.length > 0 ? (
          availableCategories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.typeButton,
                category === cat && styles.selectedTypeButton
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  category === cat && styles.selectedTypeButtonText
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noCategoriesText}>Keine Kategorien verfügbar.</Text>
        )}
      </ScrollView>
    );
  };

  // Function to pick an image
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Sorry, wir benötigen die Berechtigung, um auf deine Fotos zugreifen zu können.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setImageAsset(result.assets[0]);
      setImageUrl('');
      setRemoveCurrentImage(false);
    }
  };

  // Function to upload image and return URL
  const uploadImage = async (asset) => {
    if (!asset || !asset.base64) return null;
    setIsUploading(true);
    try {
        const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { data, error: uploadError } = await supabase.storage
            .from('event_images')
            .upload(filePath, decode(asset.base64), { contentType: asset.mimeType ?? `image/${fileExt}` });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('event_images').getPublicUrl(filePath);
        return urlData?.publicUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Upload Fehler', 'Das Bild konnte nicht hochgeladen werden.');
        return null;
    } finally {
        setIsUploading(false);
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setImageAsset(null);
    setImageUrl('');
    setRemoveCurrentImage(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Event wird geladen...</Text>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentImageUri = imageAsset ? imageAsset.uri : imageUrl;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event bearbeiten</Text>
        <View style={styles.headerRight}>
          {(isSaving || isUploading) ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleUpdate}
            >
              <Text style={styles.saveButtonText}>Speichern</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.inputLabel}>Kategorie</Text>
          {renderCategoryButtons()}

          <Text style={styles.inputLabel}>Titel</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Titel des Events..."
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.inputLabel}>Beschreibung</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Beschreibung des Events..."
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>Ort</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ort des Events..."
            value={location}
            onChangeText={setLocation}
            maxLength={100}
          />

          <Text style={styles.inputLabel}>Datum</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
             <Text style={styles.datePickerText}>
               {date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
             </Text>
             <Ionicons name="calendar-outline" size={20} color="#4285F4" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="datePicker"
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          <Text style={styles.inputLabel}>Uhrzeit</Text>
           <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.datePickerButton}>
             <Text style={styles.datePickerText}>
               {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
             </Text>
             <Ionicons name="time-outline" size={20} color="#4285F4" />
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              testID="timePicker"
              value={time}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}

          <Text style={styles.inputLabel}>Bild (Optional)</Text>
          {currentImageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: currentImageUri }} style={styles.imagePreview} />
              <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageButton}>
                  <Ionicons name="close-circle" size={24} color="#ff3b30" />
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage} disabled={isUploading}>
            <Ionicons name="camera" size={20} color="#4285F4" style={{marginRight: 10}} />
            <Text style={styles.imagePickerButtonText}>
              {currentImageUri ? 'Bild ersetzen' : 'Bild auswählen'}
            </Text>
          </TouchableOpacity>
          {isUploading && <ActivityIndicator size="small" color="#4285F4" style={{ marginTop: 10}} />}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  formContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingRight: 20,
  },
  typeButton: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  selectedTypeButton: {
    backgroundColor: '#4285F4',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  selectedTypeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
  },
  descriptionInput: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 150,
    marginBottom: 15,
  },
  datePickerButton: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef4ff',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  imagePickerButtonText: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePreviewContainer: {
      position: 'relative',
      marginBottom: 10,
      alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
  },
  removeImageButton: {
      position: 'absolute',
      top: 5,
      right: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      borderRadius: 12,
      padding: 2,
  },
  noCategoriesText: {
    fontStyle: 'italic',
    color: '#6c757d',
    paddingVertical: 10,
  },
});

export default EditEventScreen; 