import React, { useState, useEffect } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker'; // For date/time selection
import * as ImagePicker from 'expo-image-picker'; // Import ImagePicker
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import 'react-native-get-random-values'; // Import for uuid
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { decode } from 'base64-arraybuffer'; // Import decode

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

// Define event categories (similar to CalendarScreen filters, excluding 'Alle')
// const eventCategories = ['Sport', 'Vereine', 'Gemeindeamt', 'Kultur']; // Removed hardcoded

const CreateEventScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization(); // Get active org ID

  // Event form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date()); // Default to today
  const [time, setTime] = useState(new Date()); // Default to current time
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]); // State for dynamic categories
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imageAsset, setImageAsset] = useState(null); // State for selected image asset
  const [isUploading, setIsUploading] = useState(false); // State for upload progress

  // Fetch categories on mount
  useEffect(() => {
    fetchEventCategories();
  }, []);

  const fetchEventCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await supabase
        .from('event_categories')
        .select('name')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching event categories:', error);
        Alert.alert('Fehler', 'Event-Kategorien konnten nicht geladen werden.');
        setAvailableCategories([]);
      } else {
        setAvailableCategories(data?.map(cat => cat.name) || []);
      }
    } catch (err) {
        console.error('Unexpected error fetching categories:', err);
        Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
        setAvailableCategories([]);
    } finally {
        setLoadingCategories(false);
    }
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
      aspect: [16, 9], // Aspect ratio for event images
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setImageAsset(result.assets[0]);
    }
  };

  // Function to upload image and return URL
  const uploadImage = async (asset) => {
    if (!asset || !asset.base64) return null;
    setIsUploading(true);
    try {
        const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`; // Store in the root of event_images bucket
        const { data, error: uploadError } = await supabase.storage
            .from('event_images') // Use 'event_images' bucket
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

  // Validate form before submission
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Titel für das Event ein.');
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

  // Handle event publishing
  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um ein Event zu erstellen.');
      return;
    }

    if (!validateForm()) return;

    setIsPublishing(true); // Combined state for upload + publish
    let finalImageUrl = null;

    try {
      // Upload image if one is selected
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        // Stop if upload failed but an image was selected
        if (!finalImageUrl) {
           setIsPublishing(false);
           return;
        }
      }

      // Format date and time correctly for Supabase
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const formattedTime = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false }); // HH:MM

      // Insert new event with image_url
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: title,
          description: description,
          date: formattedDate,
          time: `Um ${formattedTime}`, // Match existing format 'Um HH:MM'
          location: location,
          category: category,
          image_url: finalImageUrl, // Add image_url
          organizer_id: user.id,
          organization_id: activeOrganizationId,
          is_published: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error publishing event:', error);
        Alert.alert('Fehler', 'Event konnte nicht veröffentlicht werden.');
        setIsPublishing(false); // Reset state on error
        return;
      }

      Alert.alert(
        'Erfolg',
        'Dein Event wurde erfolgreich veröffentlicht!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the Calendar screen
              // Consider refreshing the calendar screen after adding
              navigation.goBack();
            }
          }
        ]
      );
    } catch (err) {
      console.error('Unexpected error publishing event:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsPublishing(false);
      setIsUploading(false); // Ensure upload state is also reset
    }
  };

  // Handle date selection
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios'); // Keep picker open on iOS until done
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neues Event erstellen</Text>
        <View style={styles.headerRight}>
          {(isPublishing || isUploading) ? ( // Show loader if publishing or uploading
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <TouchableOpacity
              style={styles.publishButton}
              onPress={handlePublish}
            >
              <Text style={styles.publishButtonText}>Veröffentlichen</Text>
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
              minimumDate={new Date()} // Prevent selecting past dates
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

          {/* Image Upload Section */}
          <Text style={styles.inputLabel}>Bild (Optional)</Text>
          {imageAsset && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} />
              <TouchableOpacity onPress={() => setImageAsset(null)} style={styles.removeImageButton}>
                <Ionicons name="close-circle" size={24} color="#ff3b30" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage} disabled={isUploading}>
            <Ionicons name="camera" size={20} color="#4285F4" style={{ marginRight: 10 }} />
            <Text style={styles.imagePickerButtonText}>
              {imageAsset ? 'Bild ändern' : 'Bild auswählen'}
            </Text>
          </TouchableOpacity>
          {isUploading && <ActivityIndicator size="small" color="#4285F4" style={{ marginTop: 10 }} />}

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
  publishButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  publishButtonText: {
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
    minHeight: 150, // Adjust height as needed
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
    marginBottom: 20, // Add margin below
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
    height: 200, // Adjust height as needed
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

export default CreateEventScreen; 