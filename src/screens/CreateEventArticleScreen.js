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
  Dimensions,
  Image,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { RRule } from 'rrule';
import { fetchEventCategories as fetchEventCategoriesService } from '../services/eventService';
import { createEventArticle } from '../services/eventArticleService';
import { uploadImage as uploadImageService } from '../services/uploadService';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
// uuid and base64-arraybuffer now handled by uploadService
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

const CreateEventArticleScreen = ({ navigation }) => {
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
  const [isPublishing, setIsPublishing] = useState(false);
  const [availableEventCategories, setAvailableEventCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imageAsset, setImageAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Tags state
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState(RRule.WEEKLY);
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(null);
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchEventCategories();
  }, []);

  const fetchEventCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await fetchEventCategoriesService();

      if (error) {
        console.error('Error fetching event categories:', error);
        Alert.alert('Fehler', 'Event-Kategorien konnten nicht geladen werden.');
        setAvailableEventCategories([]);
      } else {
        const userVisibleCategories = data
          .filter(cat => !cat.is_admin_only)
          .map(cat => ({ 
            name: cat.name, 
            is_highlighted: cat.is_highlighted || false 
          }));
        setAvailableEventCategories(userVisibleCategories);
        if (!category && userVisibleCategories.length > 0) {
           setCategory(userVisibleCategories[0].name); 
        }
      }
    } catch (err) {
        console.error('Unexpected error fetching categories:', err);
        Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
        setAvailableEventCategories([]);
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
      aspect: [16, 9],
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
        return await uploadImageService(asset, 'event_images');
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

  // Function to build RRULE string from state
  const buildRruleString = () => {
    if (!isRecurring) return null;

    const interval = parseInt(recurrenceInterval, 10);
    if (isNaN(interval) || interval < 1) return null;

    const options = {
      freq: recurrenceFreq,
      interval: interval,
      dtstart: date,
    };

    if (recurrenceFreq === RRule.WEEKLY && recurrenceDays.length > 0) {
      options.byweekday = recurrenceDays;
    }

    if (recurrenceEndDate) {
        const untilDate = new Date(recurrenceEndDate);
        untilDate.setUTCHours(23, 59, 59, 999);
        options.until = untilDate;
    }

    if (recurrenceFreq === RRule.WEEKLY && recurrenceDays.length === 0) {
        Alert.alert('Fehler', 'Bitte wählen Sie mindestens einen Wochentag für die wöchentliche Wiederholung aus.');
        return 'INVALID_RULE';
    }

    try {
      const rule = new RRule(options);
      return rule.toString();
    } catch (e) {
      console.error("Error creating RRULE string:", e);
      Alert.alert('Fehler', 'Ungültige Wiederholungsregel.');
      return 'INVALID_RULE';
    }
  };

  // Tag management functions
  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags(prev => [...prev, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  // Handle event article publishing
  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um eine Veranstaltung zu erstellen.');
      return;
    }

    if (!validateForm()) return;

    setIsPublishing(true);
    let finalImageUrl = null;
    let rruleString = null;
    let recurrenceEnd = null;

    try {
      // Upload image if one is selected
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) {
           setIsPublishing(false);
           return;
        }
      }

      // Format date and time correctly for Supabase
      const formattedDate = date.toISOString().split('T')[0];
      const formattedTime = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });

      if (isRecurring) {
          rruleString = buildRruleString();
          if (rruleString === 'INVALID_RULE') {
              setIsPublishing(false);
              setIsUploading(false);
              return;
          }
          if (rruleString && recurrenceEndDate) {
              recurrenceEnd = recurrenceEndDate.toISOString().split('T')[0];
          }
      }

      const { data: resultData, error: createError } = await createEventArticle({
        eventData: {
          title: title,
          description: description,
          date: formattedDate,
          time: `Um ${formattedTime}`,
          location: location,
          category: category,
          image_url: finalImageUrl,
          organizer_id: user.id,
          organization_id: activeOrganizationId,
          is_published: true,
          recurrence_rule: rruleString,
          recurrence_end_date: recurrenceEnd,
          tags: tags,
        },
        articleData: {
          title: title,
          content: description,
          type: 'Veranstaltungen',
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: true,
          image_url: finalImageUrl,
          preview_image_url: finalImageUrl,
          tags: tags,
        },
      });

      if (createError) {
        console.error('Error publishing event article:', createError);
        Alert.alert('Fehler', 'Veranstaltung konnte nicht veröffentlicht werden.');
        setIsPublishing(false);
        return;
      }

      Alert.alert(
        'Erfolg',
        'Deine Veranstaltung wurde erfolgreich veröffentlicht!',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            }
          }
        ]
      );
    } catch (err) {
      console.error('Unexpected error publishing event article:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsPublishing(false);
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

  // Handle recurrence end date selection
  const onRecurrenceEndDateChange = (event, selectedDate) => {
      setShowRecurrenceEndDatePicker(Platform.OS === 'ios');
      if (selectedDate) {
          const startDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());

          if (selectedDateOnly >= startDateOnly) {
              setRecurrenceEndDate(selectedDateOnly);
          } else {
              Alert.alert("Ungültiges Datum", "Das Enddatum der Wiederholung darf nicht vor dem Startdatum des Events liegen.");
          }
      }
  };

  // Toggle weekday selection for weekly recurrence
  const toggleWeekday = (day) => {
    setRecurrenceDays(prevDays =>
      prevDays.includes(day)
        ? prevDays.filter(d => d !== day)
        : [...prevDays, day]
    );
  };

  // Weekday mapping for UI
  const weekdays = [
    { label: 'Mo', value: RRule.MO },
    { label: 'Di', value: RRule.TU },
    { label: 'Mi', value: RRule.WE },
    { label: 'Do', value: RRule.TH },
    { label: 'Fr', value: RRule.FR },
    { label: 'Sa', value: RRule.SA },
    { label: 'So', value: RRule.SU },
  ];

  // Render category selection buttons
  const renderCategoryButtons = () => {
    if (loadingCategories) {
      return <ActivityIndicator size="small" color="#4285F4" style={styles.loadingIndicator}/>;
    }
    if (availableEventCategories.length === 0) {
      return <Text style={styles.noCategoriesText}>Keine Kategorien zum Auswählen verfügbar.</Text>;
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeButtonsContainer}
      >
        {availableEventCategories.map(cat => {
          const isSelected = category === cat.name;
          const isHighlighted = cat.is_highlighted && !isSelected;

          const buttonStyle = [
            styles.typeButtonBase,
            isSelected ? styles.selectedTypeButton : styles.typeButton,
            isHighlighted && styles.highlightedTypeButton
          ];

          const textStyle = [
            styles.typeButtonText,
            isSelected && styles.selectedTypeButtonText
          ];

          return (
            <TouchableOpacity
              key={cat.name}
              style={buttonStyle}
              onPress={() => setCategory(cat.name)}
            >
              {isHighlighted ? (
                <LinearGradient
                  colors={['#f0f0f0', '#e0e0e0']}
                  style={styles.gradientWrapperType}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={textStyle}>{cat.name}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.textWrapperType}>
                  <Text style={textStyle}>{cat.name}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
        <Text style={styles.headerTitle}>Neue Veranstaltung</Text>
        <View style={styles.headerRight}>
          {(isPublishing || isUploading) ? (
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

          <Text style={styles.inputLabel}>Schlagwörter (Optional)</Text>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.tagChip}
                  onPress={() => removeTag(index)}
                >
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close-circle" size={16} color="#666" style={styles.tagRemoveIcon} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.tagInputContainer}>
            <TextInput
              style={styles.tagInput}
              placeholder="Schlagwort eingeben und Enter drücken..."
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.tagAddButton} onPress={addTag}>
              <Ionicons name="add" size={20} color="#4285F4" />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Titel</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Titel der Veranstaltung..."
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.inputLabel}>Beschreibung</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Beschreibung der Veranstaltung..."
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>Ort</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ort der Veranstaltung..."
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

          {/* Recurrence Section */}
          <View style={styles.recurrenceToggleContainer}>
            <Text style={styles.inputLabel}>Veranstaltung wiederholen?</Text>
            <Switch
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isRecurring ? '#4285F4' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={setIsRecurring}
                value={isRecurring}
            />
          </View>

          {isRecurring && (
            <View style={styles.recurrenceOptionsContainer}>
              {/* Frequency Picker */}
              <Text style={styles.recurrenceLabel}>Häufigkeit</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={recurrenceFreq}
                  onValueChange={(itemValue) => setRecurrenceFreq(itemValue)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Täglich" value={RRule.DAILY} />
                  <Picker.Item label="Wöchentlich" value={RRule.WEEKLY} />
                </Picker>
              </View>

              {/* Interval Input */}
              <Text style={styles.recurrenceLabel}>Intervall (Alle X ...)</Text>
              <TextInput
                  style={styles.intervalInput}
                  placeholder="1"
                  value={recurrenceInterval}
                  onChangeText={setRecurrenceInterval}
                  keyboardType="numeric"
                  maxLength={2}
              />

              {/* Day Picker (for Weekly) */}
              {recurrenceFreq === RRule.WEEKLY && (
                <View>
                    <Text style={styles.recurrenceLabel}>An Wochentagen</Text>
                    <View style={styles.weekdaysContainer}>
                        {weekdays.map(day => (
                            <TouchableOpacity
                                key={day.label}
                                style={[
                                    styles.weekdayButton,
                                    recurrenceDays.includes(day.value) && styles.weekdaySelectedButton
                                ]}
                                onPress={() => toggleWeekday(day.value)}
                            >
                                <Text style={[
                                    styles.weekdayText,
                                    recurrenceDays.includes(day.value) && styles.weekdaySelectedText
                                ]}>
                                    {day.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
              )}

              {/* Recurrence End Date */}
              <Text style={styles.recurrenceLabel}>Wiederholung endet am (Optional)</Text>
              <TouchableOpacity onPress={() => setShowRecurrenceEndDatePicker(true)} style={styles.datePickerButton}>
                <Text style={styles.datePickerText}>
                  {recurrenceEndDate
                    ? recurrenceEndDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Datum auswählen'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#4285F4" />
              </TouchableOpacity>
              {showRecurrenceEndDatePicker && (
                <DateTimePicker
                  testID="recurrenceEndPicker"
                  value={recurrenceEndDate || date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onRecurrenceEndDateChange}
                  minimumDate={date}
                />
              )}
              {recurrenceEndDate && (
                   <TouchableOpacity onPress={() => setRecurrenceEndDate(null)} style={styles.clearDateButton}>
                       <Text style={styles.clearDateButtonText}>Enddatum löschen</Text>
                   </TouchableOpacity>
              )}
            </View>
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
  typeButtonBase: {
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  typeButton: {
    backgroundColor: '#f1f1f1',
    borderColor: '#ddd',
  },
  selectedTypeButton: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  highlightedTypeButton: {
      borderColor: '#bdbdbd',
      backgroundColor: 'transparent',
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
  recurrenceToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  recurrenceOptionsContainer: {
    paddingVertical: 10,
    marginBottom: 10,
  },
  recurrenceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    marginTop: 10,
  },
  pickerWrapper: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 15,
    height: Platform.OS === 'android' ? 50 : undefined,
    justifyContent: 'center'
  },
  picker: {
     height: Platform.OS === 'ios' ? 150 : 50,
  },
  pickerItem: {
      height: 150,
  },
  intervalInput: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
    width: '30%',
  },
  weekdaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  weekdayButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  weekdaySelectedButton: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  weekdayText: {
    color: '#333',
    fontSize: 14,
  },
  weekdaySelectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  clearDateButton: {
    marginTop: -5,
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  clearDateButtonText: {
    color: '#ff3b30',
    fontSize: 13,
  },
  loadingIndicator: {
    marginTop: 10,
  },
  gradientWrapperType: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  textWrapperType: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f0fe',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipText: {
    color: '#4285F4',
    fontSize: 13,
    marginRight: 4,
  },
  tagRemoveIcon: {
    marginLeft: 2,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  tagAddButton: {
    padding: 12,
    marginLeft: 8,
    backgroundColor: '#eef4ff',
    borderRadius: 8,
  },
});

export default CreateEventArticleScreen;
