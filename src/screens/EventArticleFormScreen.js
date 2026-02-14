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
 * Unified Event Article Form Screen — handles both create and edit modes.
 * Creates/updates both an event AND a linked article simultaneously.
 *
 * Route params:
 *   - eventId (optional): when present, operates in edit mode
 */
const EventArticleFormScreen = ({ navigation, route }) => {
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

  // Tags state
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Edit-only state
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [linkedArticleId, setLinkedArticleId] = useState(null);

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
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) { setError('Could not load event. Please try again later.'); return; }
      if (!eventData) { setError('Event not found.'); return; }

      // Authorization check
      let canEdit = false;
      if (!eventData.organization_id) {
        canEdit = eventData.organizer_id === user?.id && !activeOrganizationId;
      } else {
        if (activeOrganizationId === eventData.organization_id) {
          try {
            const { data: membership, error: memberError } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', eventData.organization_id)
              .eq('user_id', user?.id)
              .maybeSingle();
            if (!memberError && membership) canEdit = true;
          } catch (e) { console.error("Error checking membership:", e); }
        }
      }
      if (!canEdit) {
        setError('You are not authorized to edit this event.');
        Alert.alert('Fehler', 'Du bist nicht berechtigt, diese Veranstaltung zu bearbeiten.');
        navigation.goBack();
        return;
      }

      // Fetch linked article
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('id')
        .eq('linked_event_id', eventId)
        .maybeSingle();
      if (!articleError && articleData) {
        setLinkedArticleId(articleData.id);
      }

      // Populate form
      setTitle(eventData.title || '');
      setDescription(eventData.description || '');
      setLocation(eventData.location || '');
      setCategory(eventData.category || '');
      setInitialCategory(eventData.category || '');
      setImageUrl(eventData.image_url || '');
      setImageAsset(null);
      setRemoveCurrentImage(false);
      setTags(eventData.tags || []);
      setTagInput('');

      // Parse recurrence
      if (eventData.recurrence_rule) {
        setIsRecurring(true);
        try {
          const ruleOptions = RRule.parseString(eventData.recurrence_rule);
          const dtstart = new Date(eventData.date + 'T00:00:00Z');
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
      setDate(new Date(eventData.date));
      const timeMatch = eventData.time?.match(/(\d{2}):(\d{2})/);
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
    if (!title.trim()) { Alert.alert('Fehler', 'Bitte gib einen Titel ein.'); return false; }
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

  // ─── Tag management ─────────────────────────────────────────
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
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) setTime(selectedTime);
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
    if (!user) { Alert.alert('Fehler', 'Du musst angemeldet sein, um eine Veranstaltung zu erstellen.'); return; }
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

      // Step 1: Insert event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          title, description, date: formattedDate, time: `Um ${formattedTime}`,
          location, category, image_url: finalImageUrl,
          organizer_id: user.id, organization_id: activeOrganizationId,
          is_published: true, recurrence_rule: rruleString,
          recurrence_end_date: recurrenceEnd, tags
        })
        .select()
        .single();

      if (eventError) {
        console.error('Error publishing event:', eventError);
        Alert.alert('Fehler', 'Event konnte nicht veröffentlicht werden.');
        setIsSubmitting(false);
        return;
      }

      // Step 2: Insert linked article
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .insert({
          title, content: description, type: 'Veranstaltungen',
          author_id: user.id, organization_id: activeOrganizationId,
          is_published: true, image_url: finalImageUrl,
          preview_image_url: finalImageUrl, linked_event_id: eventData.id, tags
        })
        .select()
        .single();

      if (articleError) {
        console.error('Error creating linked article:', articleError);
        await supabase.from('events').delete().eq('id', eventData.id);
        Alert.alert('Fehler', 'Artikel konnte nicht erstellt werden.');
        setIsSubmitting(false);
        return;
      }

      Alert.alert('Erfolg', 'Deine Veranstaltung wurde erfolgreich veröffentlicht!',
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

      // Update event
      const { error: eventError } = await supabase
        .from('events')
        .update({
          title, description, date: formattedDate, time: `Um ${formattedTime}`,
          location, category, image_url: finalImageUrl,
          recurrence_rule: rruleString, recurrence_end_date: recurrenceEnd, tags
        })
        .eq('id', eventId);

      if (eventError) {
        console.error('Error updating event:', eventError);
        Alert.alert('Fehler', 'Event konnte nicht aktualisiert werden.');
        setIsSubmitting(false);
        return;
      }

      // Update linked article
      if (linkedArticleId) {
        const { error: articleError } = await supabase
          .from('articles')
          .update({
            title, content: description,
            image_url: finalImageUrl, preview_image_url: finalImageUrl, tags
          })
          .eq('id', linkedArticleId);
        if (articleError) console.error('Error updating linked article:', articleError);
      }

      Alert.alert('Erfolg', 'Deine Veranstaltung wurde erfolgreich aktualisiert!',
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
        <Text style={styles.loadingText}>Veranstaltung wird geladen...</Text>
      </SafeAreaView>
    );
  }

  if (isEditMode && error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Zurück</Text>
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
          {isEditMode ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}
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

          <Text style={styles.inputLabel}>Schlagwörter (Optional)</Text>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <TouchableOpacity key={index} style={styles.tagChip} onPress={() => removeTag(index)}>
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
          <TextInput style={styles.textInput} placeholder="Titel der Veranstaltung..." value={title} onChangeText={setTitle} maxLength={100} />

          <Text style={styles.inputLabel}>Beschreibung</Text>
          <TextInput style={styles.descriptionInput} placeholder="Beschreibung der Veranstaltung..." value={description} onChangeText={setDescription} multiline textAlignVertical="top" />

          <Text style={styles.inputLabel}>Ort</Text>
          <TextInput style={styles.textInput} placeholder="Ort der Veranstaltung..." value={location} onChangeText={setLocation} maxLength={100} />

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
            <Text style={styles.inputLabel}>{isEditMode ? 'Veranstaltung wiederholen?' : 'Veranstaltung wiederholen?'}</Text>
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
          ) : null}
          <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage} disabled={isUploading}>
            <Ionicons name="camera" size={20} color="#4285F4" style={{ marginRight: 10 }} />
            <Text style={styles.imagePickerButtonText}>
              {currentImageUri ? (isEditMode ? 'Bild ersetzen' : 'Bild ändern') : 'Bild auswählen'}
            </Text>
          </TouchableOpacity>
          {isUploading && <ActivityIndicator size="small" color="#4285F4" style={{ marginTop: 10 }} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 10, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  errorText: { marginTop: 10, color: '#666', textAlign: 'center', marginBottom: 20 },
  backButtonError: { padding: 10 },
  backButtonText: { color: '#4285F4', fontWeight: 'bold', fontSize: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  publishButton: { backgroundColor: '#4285F4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  publishButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  content: { flex: 1 },
  scrollContent: { flex: 1 },
  formContainer: { padding: 15, paddingBottom: 30 },
  inputLabel: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 15 },
  typeButtonsContainer: { flexDirection: 'row', paddingVertical: 5, paddingRight: 20, marginBottom: 10 },
  typeButtonBase: { borderRadius: 20, marginRight: 8, borderWidth: 1, overflow: 'hidden' },
  typeButton: { backgroundColor: '#f1f1f1', borderColor: '#ddd' },
  selectedTypeButton: { backgroundColor: '#4285F4', borderColor: '#4285F4' },
  highlightedTypeButton: { borderColor: '#bdbdbd', backgroundColor: 'transparent' },
  disabledTypeButton: { backgroundColor: '#e0e0e0', borderColor: '#bdbdbd' },
  gradientWrapperType: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  textWrapperType: { paddingHorizontal: 15, paddingVertical: 8 },
  typeButtonText: { fontSize: 14, color: '#333' },
  selectedTypeButtonText: { color: '#fff', fontWeight: 'bold' },
  disabledTypeButtonText: { color: '#9e9e9e' },
  textInput: { backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 15 },
  descriptionInput: { backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, fontSize: 16, minHeight: 150, marginBottom: 15 },
  datePickerButton: { backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  datePickerText: { fontSize: 16, color: '#333' },
  imagePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef4ff', padding: 12, borderRadius: 8, justifyContent: 'center', marginTop: 10, marginBottom: 20 },
  imagePickerButtonText: { color: '#4285F4', fontWeight: 'bold', fontSize: 16 },
  imagePreviewContainer: { position: 'relative', marginBottom: 10, alignItems: 'center' },
  imagePreview: { width: '100%', height: 200, borderRadius: 8, marginTop: 10 },
  removeImageButton: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 12, padding: 2 },
  noCategoriesText: { fontStyle: 'italic', color: '#6c757d', paddingVertical: 10 },
  loadingIndicator: { marginVertical: 10 },
  recurrenceToggleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee', borderBottomWidth: 1, borderBottomColor: '#eee' },
  recurrenceOptionsContainer: { paddingVertical: 10, marginBottom: 10 },
  recurrenceLabel: { fontSize: 14, color: '#666', marginBottom: 5, marginTop: 10 },
  pickerWrapper: { backgroundColor: '#f8f8f8', borderRadius: 8, marginBottom: 15, height: Platform.OS === 'android' ? 50 : undefined, justifyContent: 'center' },
  picker: { height: Platform.OS === 'ios' ? 150 : 50 },
  pickerItem: { height: 150 },
  intervalInput: { backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 15, width: '30%' },
  weekdaysContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  weekdayButton: { borderWidth: 1, borderColor: '#ccc', borderRadius: 18, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' },
  weekdaySelectedButton: { backgroundColor: '#4285F4', borderColor: '#4285F4' },
  weekdayText: { color: '#333', fontSize: 14 },
  weekdaySelectedText: { color: '#fff', fontWeight: 'bold' },
  clearDateButton: { marginTop: -5, marginBottom: 15, alignSelf: 'flex-start' },
  clearDateButtonText: { color: '#ff3b30', fontSize: 13 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e7f0fe', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#4285F4', fontSize: 13, marginRight: 4 },
  tagRemoveIcon: { marginLeft: 2 },
  tagInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tagInput: { flex: 1, backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, fontSize: 14 },
  tagAddButton: { padding: 12, marginLeft: 8, backgroundColor: '#eef4ff', borderRadius: 8 },
});

export default EventArticleFormScreen;