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
  FlatList // Added for listing groups
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05;

// Renamed component for clarity
const ManageBroadcastGroupsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();

  // Component State
  const [mode, setMode] = useState('list'); // 'list', 'create', 'edit'
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // For create/update/delete actions

  // Data State
  const [existingGroups, setExistingGroups] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // Form State (for create/edit)
  const [editingGroup, setEditingGroup] = useState(null); // Stores the group being edited
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Fetch existing groups and tags
  const fetchData = useCallback(async () => {
    if (!user || !activeOrganizationId) {
      console.warn("ManageBroadcastGroupsScreen: No user or active organization.");
      setIsLoading(false);
      setIsLoadingTags(false); // Ensure tags loading also stops
      // Optionally navigate back or show message if context is missing
      if (!activeOrganizationId) {
          Alert.alert('Fehler', 'Keine aktive Organisation ausgewählt. Gruppen können nicht verwaltet werden.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
      return;
    }

    setIsLoading(true);
    setIsLoadingTags(true); // Reset tags loading state too

    try {
      // Fetch existing groups for the organization
      const { data: groupsData, error: groupsError } = await supabase
        .from('chat_groups')
        .select('id, name, description, tags, type, organization_id') // Select necessary fields
        .eq('type', 'broadcast')
        .eq('organization_id', activeOrganizationId);

      if (groupsError) {
        console.error("Error fetching organization's broadcast groups:", groupsError);
        Alert.alert('Fehler', 'Fehler beim Laden der vorhandenen Gruppen.');
        setExistingGroups([]);
      } else {
        setExistingGroups(groupsData || []);
      }

      // Fetch available tags (only user-selectable ones)
      const { data: tagsData, error: tagsError } = await supabase
        .from('chat_group_tags')
        .select('name')
        .order('display_order', { ascending: true });

      if (tagsError) {
        console.error('Error fetching chat tags:', tagsError);
        Alert.alert('Fehler', 'Fehler beim Laden der verfügbaren Tags.');
        setAvailableTags([]);
      } else if (tagsData) {
        const userSelectableTags = tagsData
          .map(tag => tag.name)
          .filter(name => name !== 'Offene Gruppen' && name !== 'Ankündigungen');
        setAvailableTags(userSelectableTags);
      } else {
        setAvailableTags([]);
      }
    } catch (err) {
      console.error('Unexpected error fetching data:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      setExistingGroups([]);
      setAvailableTags([]);
    } finally {
      setIsLoading(false);
      setIsLoadingTags(false);
    }
  }, [user, activeOrganizationId, navigation]); // Include navigation in dependencies

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Use fetchData in dependency array

  // Reset form when switching modes
  useEffect(() => {
    if (mode === 'list') {
      setEditingGroup(null);
      setName('');
      setDescription('');
      setSelectedTags([]);
    } else if (mode === 'create') {
      setEditingGroup(null);
      setName('');
      setDescription('');
      setSelectedTags([]);
    } else if (mode === 'edit' && editingGroup) {
      // Pre-fill form for editing
      setName(editingGroup.name || '');
      setDescription(editingGroup.description || '');
      setSelectedTags(editingGroup.tags || []);
    }
  }, [mode, editingGroup]);

  // Validate form before submission (Create or Update)
  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Namen für die Gruppe ein.');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine Beschreibung ein.');
      return false;
    }
    if (selectedTags.length === 0) {
      Alert.alert('Fehler', 'Bitte wähle mindestens einen Tag aus.');
      return false;
    }
    // Check group limit only during creation
    if (mode === 'create' && existingGroups.length >= 2) {
      Alert.alert('Limit erreicht', 'Deine Organisation kann maximal 2 Broadcast-Gruppen haben.');
      return false;
    }
    return true;
  };

  // Handle group creation
  const handleCreate = async () => {
    if (!user || !activeOrganizationId) {
      Alert.alert('Fehler', 'Fehlende Benutzer- oder Organisationsdaten.');
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('chat_groups')
        .insert({
          name: name.trim(),
          description: description.trim(),
          type: 'broadcast',
          tags: selectedTags,
          organization_id: activeOrganizationId,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating broadcast group:', error);
        if (error.code === '23505') { // Unique constraint violation (name)
          Alert.alert('Fehler', 'Eine Gruppe mit diesem Namen existiert bereits.');
        } else {
          Alert.alert('Fehler', 'Gruppe konnte nicht erstellt werden.');
        }
        return;
      }

      // Add welcome message (optional, could be removed if not desired on creation)
      const welcomeMessage = `Willkommen in der Gruppe "${name.trim()}"!`;
      await supabase.from('chat_messages').insert({
        chat_group_id: data.id,
        user_id: user.id, // Use logged-in user ID for the message
        text: welcomeMessage,
      });

      Alert.alert('Erfolg', 'Broadcast-Gruppe erfolgreich erstellt!');
      await fetchData(); // Re-fetch data to update list
      setMode('list'); // Go back to list view

    } catch (err) {
      console.error('Unexpected error creating broadcast group:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle group update
  const handleUpdate = async () => {
    if (!editingGroup || !user || !activeOrganizationId) {
      Alert.alert('Fehler', 'Keine Gruppe zum Bearbeiten ausgewählt oder fehlende Daten.');
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('chat_groups')
        .update({
          name: name.trim(),
          description: description.trim(),
          tags: selectedTags,
          // Don't update type, organization_id, is_active here
        })
        .eq('id', editingGroup.id)
        .eq('organization_id', activeOrganizationId); // Ensure we only update org's group

      if (error) {
        console.error('Error updating broadcast group:', error);
        if (error.code === '23505') { // Unique constraint violation (name)
          Alert.alert('Fehler', 'Eine andere Gruppe mit diesem Namen existiert bereits.');
        } else {
          Alert.alert('Fehler', 'Gruppe konnte nicht aktualisiert werden.');
        }
        return;
      }

      Alert.alert('Erfolg', 'Gruppe erfolgreich aktualisiert!');
      await fetchData(); // Re-fetch data
      setMode('list'); // Go back to list view

    } catch (err) {
      console.error('Unexpected error updating broadcast group:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle group deletion
  const handleDelete = (groupToDelete) => {
    if (!groupToDelete || !user || !activeOrganizationId) {
      Alert.alert('Fehler', 'Keine Gruppe zum Löschen ausgewählt oder fehlende Daten.');
      return;
    }

    Alert.alert(
      'Gruppe löschen',
      `Bist du sicher, dass du die Gruppe "${groupToDelete.name}" löschen möchtest? Dies kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen', style: 'destructive', onPress: async () => {
            setIsSubmitting(true);
            try {
              const { error } = await supabase
                .from('chat_groups')
                .delete()
                .eq('id', groupToDelete.id)
                .eq('organization_id', activeOrganizationId); // Ensure we only delete org's group

              if (error) {
                console.error('Error deleting broadcast group:', error);
                Alert.alert('Fehler', 'Gruppe konnte nicht gelöscht werden.');
                return;
              }

              Alert.alert('Erfolg', 'Gruppe erfolgreich gelöscht!');
              await fetchData(); // Re-fetch data
              // Stay in list mode

            } catch (err) {
              console.error('Unexpected error deleting broadcast group:', err);
              Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Toggle tag selection
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Render tag selection buttons (for create/edit form)
  const renderTagButtons = () => {
    if (isLoadingTags) {
      return <ActivityIndicator style={{ marginTop: 10 }} />;
    }
    if (availableTags.length === 0) {
      return <Text style={styles.infoText}>Keine Tags verfügbar.</Text>;
    }
    return (
      <View style={styles.tagButtonsContainer}>
        {availableTags.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[
              styles.tagButton,
              selectedTags.includes(tag) && styles.selectedTagButton
            ]}
            onPress={() => toggleTag(tag)}
            disabled={isSubmitting} // Disable while submitting
          >
            <Text
              style={[
                styles.tagButtonText,
                selectedTags.includes(tag) && styles.selectedTagButtonText
              ]}
            >
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render the list item for an existing group
  const renderGroupItem = ({ item }) => (
    <View style={styles.groupItem}>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupDescription} numberOfLines={2}>{item.description}</Text>
        {item.tags?.length > 0 && (
             <Text style={styles.groupTags}>Tags: {item.tags.join(', ')}</Text>
        )}
      </View>
      <View style={styles.groupActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => { setEditingGroup(item); setMode('edit'); }}
          disabled={isSubmitting}
        >
          <Ionicons name="pencil" size={20} color="#4285F4" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
          disabled={isSubmitting}
        >
          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render the main content based on mode
  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Lade Gruppendaten...</Text>
        </View>
      );
    }

    // --- List Mode ---
    if (mode === 'list') {
      return (
        <View style={styles.listContainer}>
          <FlatList
            data={existingGroups}
            renderItem={renderGroupItem}
            keyExtractor={item => item.id.toString()}
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                Deine Broadcast-Gruppen ({existingGroups.length}/2)
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>
                      Deine Organisation hat noch keine Broadcast-Gruppen.
                  </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          {existingGroups.length < 2 && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setMode('create')}
              disabled={isSubmitting}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.addButtonText}> Neue Gruppe</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // --- Create or Edit Mode ---
    if (mode === 'create' || mode === 'edit') {
      return (
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
            {mode === 'create' && (
              <Text style={styles.formSubtitle}>
                Deine Organisation hat {existingGroups.length} von maximal 2 Gruppen.
              </Text>
            )}

            <Text style={styles.inputLabel}>Name der Gruppe</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Name der Broadcast-Gruppe..."
              value={name}
              onChangeText={setName}
              maxLength={50}
              editable={!isSubmitting}
            />

            <Text style={styles.inputLabel}>Beschreibung</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Beschreibung der Gruppe..."
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              editable={!isSubmitting}
            />

            <Text style={styles.inputLabel}>Tags</Text>
            <Text style={styles.tagHelp}>Wähle mindestens einen Tag aus:</Text>
            {renderTagButtons()}

            {/* Spacer */}
            <View style={{ height: 80 }} />

          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    return null; // Should not happen
  };

  // Render Header based on mode
  const renderHeader = () => {
    let title = "Broadcast-Gruppen Verwalten";
    if (mode === 'create') title = "Neue Broadcast-Gruppe";
    if (mode === 'edit') title = "Gruppe Bearbeiten";

    return (
       <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
                if (mode === 'create' || mode === 'edit') {
                    setMode('list'); // Go back to list from form
                } else {
                    navigation.goBack(); // Go back to previous screen from list
                }
            }}
            disabled={isSubmitting}
          >
            <Ionicons name={mode === 'list' ? "close" : "arrow-back"} size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerRight}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                {mode === 'create' && (
                  <TouchableOpacity
                    style={styles.actionButtonHeader}
                    onPress={handleCreate}
                  >
                    <Text style={styles.actionButtonHeaderText}>Erstellen</Text>
                  </TouchableOpacity>
                )}
                {mode === 'edit' && (
                  <TouchableOpacity
                    style={styles.actionButtonHeader}
                    onPress={handleUpdate}
                  >
                    <Text style={styles.actionButtonHeaderText}>Speichern</Text>
                  </TouchableOpacity>
                )}
                {/* Placeholder for right alignment */}
                {(mode === 'list') && <View style={{ width: 40 }} />}
              </>
            )}
          </View>
       </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Slightly off-white background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d', // Gray text
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
    borderBottomColor: '#dee2e6', // Light gray border
    backgroundColor: '#ffffff', // White header background
  },
  backButton: {
    padding: 5,
    minWidth: 40, // Ensure consistent touch area
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600', // Semibold
    color: '#212529', // Darker text
    textAlign: 'center',
    flex: 1, // Allow title to take space
    marginHorizontal: 10,
  },
  headerRight: {
    minWidth: 40, // Ensure consistent touch area
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButtonHeader: {
    backgroundColor: '#4285F4', // Primary blue
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonHeaderText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // List Styles
  listContainer: {
      flex: 1,
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057', // Mid-gray text
    padding: 15,
    backgroundColor: '#f1f3f5', // Very light gray background for header
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#ffffff', // White item background
  },
  groupInfo: {
    flex: 1,
    marginRight: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#343a40', // Dark gray text
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  groupTags: {
      fontSize: 12,
      color: '#868e96', // Lighter gray for tags
      fontStyle: 'italic',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8, // Slightly larger touch area
    marginLeft: 10,
  },
  deleteButton: {
      // No specific style needed unless differentiating more
  },
  separator: {
    height: 1,
    backgroundColor: '#e9ecef', // Light separator line
    marginLeft: 15, // Indent separator
  },
  emptyListContainer: {
      padding: 40,
      alignItems: 'center',
  },
  emptyListText: {
      fontSize: 15,
      color: '#6c757d',
      textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745', // Green for add button
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    margin: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  addButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 5,
  },
  // Form Styles
  formKeyboardAvoidingView: {
      flex: 1,
  },
  formScrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 15,
    paddingBottom: 30, // Ensure space below last element
    backgroundColor: '#ffffff', // White form background
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 15, // Slightly smaller label
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    marginTop: 15,
  },
  tagHelp: {
    fontSize: 13, // Smaller help text
    color: '#6c757d',
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: '#f1f3f5', // Light input background
    borderWidth: 1,
    borderColor: '#ced4da', // Standard border color
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
    marginBottom: 15,
    color: '#495057', // Input text color
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
  tagButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tagButton: {
    backgroundColor: '#e9ecef', // Light gray unselected tag
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8, // Added margin bottom
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  selectedTagButton: {
    backgroundColor: '#4285F4', // Primary blue selected tag
    borderColor: '#3b78e3', // Slightly darker blue border
  },
  tagButtonText: {
    fontSize: 14,
    color: '#495057', // Dark gray text for unselected
  },
  selectedTagButtonText: {
    color: '#fff', // White text for selected
    fontWeight: '600',
  },
  infoText: {
    fontStyle: 'italic',
    color: '#6c757d',
    marginTop: 10,
  }
});

// Export the renamed component
export default ManageBroadcastGroupsScreen; 