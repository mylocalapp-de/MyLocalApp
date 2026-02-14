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
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

/**
 * Unified Event Form Screen — handles both create and edit modes.
 *
 * Route params:
 *   - eventId (optional): when present, operates in edit mode
 */
const EventFormScreen = ({ navigation, route }) => {
  const eventId = route.params?.eventId;
  const isEditMode = !!eventId;

  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [initialCategory, setInitialCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableEventCategories, setAvailableEventCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imageAsset, setImageAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit-only state
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState(RRule.WEEKLY);
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(null);
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);

  // ─── Lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (isEditMode) {
      fetchEventCategories().then(() => fetchEventData());
    } else {
      fetchEventCategories();
    }
  }, [eventId]);

  // ─── Data fetching ──────────────────────────────────────────
  const fetchEventCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await supabase
        .from('event_categories')
        .select('name, is_highlighted, is_admin_only')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching event categories:', error);
        if (!isEditMode) Alert.alert('Fehler', 'Event-Kategorien konnten nicht geladen werden.');
        setAvailableEventCategories([]);
      } else {
        const userVisibleCategories = data
          .filter(cat => !cat.is_admin_only)
          .map(cat => ({ name: cat.name, is_highlighted: cat.is_highlighted || false }));
        setAvailableEventCategories(userVisibleCategories);
        if (!isEditMode && !category && userVisibleCategories.length > 0) {
          setCategory(userVisibleCategories[0].name);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching categories:', err);
      if (!isEditMode) Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      setAvailableEventCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchEventData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) { setError('Could not load event. Please try again later.'); return; }
      if (!data) { setError('Event not found.'); return; }

      // Authorization check
      let canEdit = false;
      if (!data.organization_id) {
        canEdit = data.organizer_id === user?.id && !activeOrganizationId;
      } else {
        if (activeOrganizationId === data.organization_id) {
          try {
            const { data: membership, error: memberError } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', data.organization_id)
              .eq('user_id', user?.id)
              .maybeSingle();
            if (!memberError && membership) canEdit = true;
          } catch (e) { console.error("Error checking membership:", e); }
        }
      }
      if (!canEdit) {
        setError('You are not authorized to edit this event.');
        Alert.alert('Fehler', 'Du bist nicht berechtigt, dieses Event zu bearbeiten.');
        navigation.goBack();
        return;
      }

      // Populate form
      setTitle(data.title || '');
      setDescription(data.description || '');
      setLocation(data.location || '');
      setCategory(data.category || '');
      setInitialCategory(data.category || '');
      setImageUrl(data.image_url || '');
      setImageAsset(null);
      setRemoveCurrentImage(false);

      // Parse recurrence
      if (data.recurrence_rule) {
        setIsRecurring(true);
        try {
          const ruleOptions = RRule.parseString(data.recurrence_rule);
          const dtstart = new Date(data.date + 'T00:00:00Z');
          const rule = new RRule({ ...ruleOptions, dtstart });
          setRecurrenceFreq(rule.options.freq);
          setRecurrenceInterval(rule.options.interval.toString());
          setRecurrenceDays(rule.options.byweekday || []);
          if (rule.options.until) {
            const untilDate = new Date(rule.options.until);
            setRecurrenceEndDate(new Date(Date.UTC(untilDate.getUTCFullYear(), untilDate.getUTCMonth(), untilDate.getUTCDate())));
          } else {
            setRecurrenceEndDate(null);
          }
        } catch (e) {
          console.error("Error parsing RRULE:", e);
          Alert.alert("Fehler", "Die bestehende Wiederholungsregel konnte nicht gelesen werden.");
          setIsRecurring(false);
          setRecurrenceFreq(RRule.WEEKLY);
          setRecurrenceInterval('1');
          setRecurrenceDays([]);
          setRecurrenceEndDate(null);
        }
      } else {
        setIsRecurring(false);
        setRecurrenceFreq(RRule.WEEKLY);
        setRecurrenceInterval('1');
        setRecurrenceDays([]);
        setRecurrenceEndDate(null);
      }

      // Parse date/time
      setDate(new Date(data.date));
      const timeMatch = data.time?.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        const t = new Date();
        t.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
        setTime(t);
      } else {
        setTime(new Date());
      }
    } catch (err) {
      console.error('Unexpected error fetching event:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Validation ─────────────────────────────────────────────
  const validateForm = () => {
    if (!title.trim()) { Alert.alert('Fehler', 'Bitte gib einen Titel für das Event ein.'); return false; }
    if (!description.trim()) { Alert.alert('Fehler', 'Bitte gib eine Beschreibung ein.'); return false; }
    if (!location.trim()) { Alert.alert('Fehler', 'Bitte gib einen Ort ein.'); return false; }
    if (!category) { Alert.alert('Fehler', 'Bitte wähle eine Kategorie aus.'); return false; }
    return true;
  };

  // ─── Image helpers ──────────────────────────────────────────
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
      if (isEditMode) {
        setImageUrl('');
        setRemoveCurrentImage(false);
      }
    }
  };

  const uploadImage = async (asset) => {
    if (!asset || !asset.base64) return null;
    setIsUploading(true);
    try {
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('event_images')
        .upload(fileName, decode(asset.base64), { contentType: asset.mimeType ?? `image/${fileExt}` });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('event_images').getPublicUrl(fileName);
      return urlData?.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Fehler', 'Das Bild konnte nicht hochgeladen werden.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageAsset(null);
    setImageUrl('');
    setRemoveCurrentImage(true);
  };

  // ─── Recurrence helpers ─────────────────────────────────────
  const buildRruleString = () => {
    if (!isRecurring) return null;
    const interval = parseInt(recurrenceInterval, 10);
    if (isNaN(interval) || interval < 1) return null;

    const options = { freq: recurrenceFreq, interval, dtstart: date };
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
      return new RRule(options).toString();
    } catch (e) {
      console.error("Error creating RRULE:", e);
      Alert.alert('Fehler', 'Ungültige Wiederholungsregel.');
      return 'INVALID_RULE';
    }
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const onTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || time;
    setShowTimePicker(Platform.OS === 'ios');
    setTime(currentTime);
  };

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

  const toggleWeekday = (day) => {
    setRecurrenceDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const weekdays = [
    { label: 'Mo', value: RRule.MO },
    { label: 'Di', value: RRule.TU },
    { label: 'Mi', value: RRule.WE },
    { label: 'Do', value: RRule.TH },
    { label: 'Fr', value: RRule.FR },
    { label: 'Sa', value: RRule.SA },
    { label: 'So', value: RRule.SU },
  ];

  // ─── Submit handlers ────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) { Alert.alert('Fehler', 'Du musst angemeldet sein, um ein Event zu erstellen.'); return; }
    if (!validateForm()) return;

    setIsSubmitting(true);
    let finalImageUrl = null;
    let rruleString = null;
    let recurrenceEnd = null;

    try {
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) { setIsSubmitting(false); return; }
      }

      const formattedDate = date.toISOString().split('T')[0];
      const formattedTime = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });

      if (isRecurring) {
        rruleString = buildRruleString();
        if (rruleString === 'INVALID_RULE') { setIsSubmitting(false); setIsUploading(false); return; }
        if (rruleString && recurrenceEndDate) recurrenceEnd = recurrenceEndDate.toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('events')
        .insert({
          title, description, date: formattedDate, time: `Um ${formattedTime}`,
          location, category, image_url: finalImageUrl,
          organizer_id: user.id, organization_id: activeOrganizationId,
          is_published: true, recurrence_rule: rruleString, recurrence_end_date: recurrenceEnd
        })
        .select()
        .single();

      if (error) {
        console.error('Error publishing event:', error);
        Alert.alert('Fehler', 'Event konnte nicht veröffentlicht werden.');
        return;
      }

      Alert.alert('Erfolg', 'Dein Event wurde erfolgreich veröffentlicht!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!user) { Alert.alert('Fehler', 'Du musst angemeldet sein.'); return; }
    if (!validateForm()) return;

    setIsSubmitting(true);
    let finalImageUrl = imageUrl;
    let rruleString = null;
    let recurrenceEnd = null;

    if (isRecurring) {
      rruleString = buildRruleString();
      if (rruleString === 'INVALID_RULE') { setIsSubmitting(false); setIsUploading(false); return; }
      if (rruleString && recurrenceEndDate) recurrenceEnd = recurrenceEndDate.toISOString().split('T')[0];
    }

    try {
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) { setIsSubmitting(false); return; }
      } else if (removeCurrentImage) {
        finalImageUrl = null;
      }

      const formattedDate = date.toISOString().split('T')[0];
      const formattedTime = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });

      const { error } = await supabase
        .from('events')
        .update({
          title, description, date: formattedDate, time: `Um ${formattedTime}`,
          location, category, image_url: finalImageUrl,
          recurrence_rule: rruleString, recurrence_end_date: recurrenceEnd
        })
        .eq('id', eventId);

      if (error) {
        console.error('Error updating event:', error);
        Alert.alert('Fehler', 'Event konnte nicht aktualisiert werden. Prüfe die RLS Policies oder Datenbankverbindung.');
        return;
      }

      Alert.alert('Erfolg', 'Dein Event wurde erfolgreich aktualisiert!',
        [{ text: 'OK', onPress: () => {
          navigation.navigate('CalendarList');
          setTimeout(() => navigation.navigate('EventDetail', { eventId }), 100);
        }}]);
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // ─── Category buttons ───────────────────────────────────────
  const renderCategoryButtons = () => {
    if (loadingCategories) {
      return <ActivityIndicator size="small" color="#4285F4" style={styles.loadingIndicator} />;
    }

    const displayCategories = [...availableEventCategories];
    if (isEditMode && initialCategory) {
      const isSelectable = availableEventCategories.some(c => c.name === initialCategory);
      if (!isSelectable) displayCategories.unshift({ name: initialCategory, is_highlighted: false });
    }

    if (displayCategories.length === 0) {
      return <Text style={styles.noCategoriesText}>Keine Kategorien zum Auswählen verfügbar.</Text>;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeButtonsContainer}>
        {displayCategories.map(cat => {
          const isSelected = category === cat.name;
          const isHighlighted = cat.is_highlighted && !isSelected;
          const isDisabled = isEditMode && !availableEventCategories.some(c => c.name === cat.name) && cat.name === initialCategory;

          const buttonStyle = [
            styles.typeButtonBase,
            isSelected ? styles.selectedTypeButton : styles.typeButton,
            isHighlighted && styles.highlightedTypeButton,
            isDisabled && styles.disabledTypeButton
          ];
          const textStyle = [
            styles.typeButtonText,
            isSelected && styles.selectedTypeButtonText,
            isDisabled && styles.disabledTypeButtonText
          ];

          return (
            <TouchableOpacity key={cat.name} style={buttonStyle} onPress={() => setCategory(cat.name)} disabled={isDisabled}>
              {isHighlighted ? (
                <LinearGradient colors={['#f0f0f0', '#e0e0e0']} style={styles.gradientWrapperType} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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

  // ─── Loading / Error states ─────────────────────────────────
  if (isEditMode && (isLoading || loadingCategories)) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Event wird geladen...</Text>
      </SafeAreaView>
    );
  }

  if (isEditMode && error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButtonStyle} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonTextStyle}>Zurück</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentImageUri = isEditMode ? (imageAsset ? imageAsset.uri : imageUrl) : (imageAsset ? imageAsset.uri : null);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Event bearbeiten' : 'Neues Event erstellen'}
        </Text>
        <View style={styles.headerRight}>
          {(isSubmitting || isUploading) ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <TouchableOpacity style={styles.publishButton} onPress={isEditMode ? handleUpdate : handlePublish}>
              <Text style={styles.publishButtonText}>{isEditMode ? 'Speichern' : 'Veröffentlichen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Kategorie</Text>
          {renderCategoryButtons()}

          <Text style={styles.inputLabel}>Titel</Text>
          <TextInput style={styles.textInput} placeholder="Titel des Events..." value={title} onChangeText={setTitle} maxLength={100} />

          <Text style={styles.inputLabel}>Beschreibung</Text>
          <TextInput style={styles.descriptionInput} placeholder="Beschreibung des Events..." value={description} onChangeText={setDescription} multiline textAlignVertical="top" />

          <Text style={styles.inputLabel}>Ort</Text>
          <TextInput style={styles.textInput} placeholder="Ort des Events..." value={location} onChangeText={setLocation} maxLength={100} />

          <Text style={styles.inputLabel}>Datum</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
            <Text style={styles.datePickerText}>{date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
            <Ionicons name="calendar-outline" size={20} color="#4285F4" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker testID="datePicker" value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} minimumDate={new Date()} />
          )}

          <Text style={styles.inputLabel}>Uhrzeit</Text>
          <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.datePickerButton}>
            <Text style={styles.datePickerText}>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</Text>
            <Ionicons name="time-outline" size={20} color="#4285F4" />
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker testID="timePicker" value={time} mode="time" is24Hour={true} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTimeChange} />
          )}

          {/* Recurrence Section */}
          <View style={styles.recurrenceToggleContainer}>
            <Text style={styles.inputLabel}>Event wiederholen?</Text>
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
              <Text style={styles.recurrenceLabel}>Häufigkeit</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={recurrenceFreq} onValueChange={setRecurrenceFreq} style={styles.picker} itemStyle={styles.pickerItem}>
                  <Picker.Item label="Täglich" value={RRule.DAILY} />
                  <Picker.Item label="Wöchentlich" value={RRule.WEEKLY} />
                </Picker>
              </View>

              <Text style={styles.recurrenceLabel}>Intervall (Alle X ...)</Text>
              <TextInput style={styles.intervalInput} placeholder="1" value={recurrenceInterval} onChangeText={setRecurrenceInterval} keyboardType="numeric" maxLength={2} />

              {recurrenceFreq === RRule.WEEKLY && (
                <View>
                  <Text style={styles.recurrenceLabel}>An Wochentagen</Text>
                  <View style={styles.weekdaysContainer}>
                    {weekdays.map(day => (
                      <TouchableOpacity
                        key={day.label}
                        style={[styles.weekdayButton, recurrenceDays.includes(day.value) && styles.weekdaySelectedButton]}
                        onPress={() => toggleWeekday(day.value)}
                      >
                        <Text style={[styles.weekdayText, recurrenceDays.includes(day.value) && styles.weekdaySelectedText]}>{day.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.recurrenceLabel}>Wiederholung endet am (Optional)</Text>
              <TouchableOpacity onPress={() => setShowRecurrenceEndDatePicker(true)} style={styles.datePickerButton}>
                <Text style={styles.datePickerText}>
                  {recurrenceEndDate ? recurrenceEndDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Datum auswählen'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#4285F4" />
              </TouchableOpacity>
              {showRecurrenceEndDatePicker && (
                <DateTimePicker testID="recurrenceEndPicker" value={recurrenceEndDate || date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onRecurrenceEndDateChange} minimumDate={date} />
              )}
              {recurrenceEndDate && (
                <TouchableOpacity onPress={() => setRecurrenceEndDate(null)} style={styles.clearDateButton}>
                  <Text style={styles.clearDateButtonText}>Enddatum löschen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Image Section */}
          <Text style={styles.inputLabel}>Bild (Optional)</Text>
          {currentImageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: currentImageUri }} style={styles.imagePreview} />
              <TouchableOpacity onPress={isEditMode ? handleRemoveImage : () => setImageAsset(null)} style={styles.removeImageButton}>
                <Ionicons name="close-circle" size={24} color="#ff3b30" />
              </TouchableOpacity>
            </View>
          ) :