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
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 3% of screen height for better scaling

const CreateBroadcastGroupScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [adminGroupCount, setAdminGroupCount] = useState(0);
  
  // Available tags
  const availableTags = [
    'Vereine', 'Kultur', 'Sport', 'Verkehr', 'Politik', 
    'Gemeinde', 'Veranstaltungen', 'Infrastruktur'
  ];
  
  // Check how many broadcast groups user is admin for
  useEffect(() => {
    const checkExistingGroups = async () => {
      if (!user) return;
      // Also need an active organization context to create a broadcast group for it
      if (!activeOrganizationId) {
          console.warn("CreateBroadcastGroupScreen: No active organization, cannot check/create broadcast group.");
          // Optionally navigate back or show an error message
          // For now, just stop the check. The form might still render but creation will fail.
          setIsChecking(false);
          return;
      }

      try {
        setIsChecking(true);

        const { data, error } = await supabase
          .from('chat_groups')
          .select('id', { count: 'exact' }) // Use count for efficiency
          .eq('type', 'broadcast')
          .eq('organization_id', activeOrganizationId); // Use organization_id

        // Check for error *after* the query
        if (error) {
          console.error('Error checking organization\'s broadcast groups:', error);
          Alert.alert('Fehler', 'Fehler beim Prüfen vorhandener Gruppen für die Organisation.');
          setAdminGroupCount(0); // Assume 0 on error to potentially allow creation attempt
        } else {
          const count = data ? data.length : 0; // Supabase might return null if no rows match
          setAdminGroupCount(count);

          // Alert user if already at max groups *for this organization*
          if (count >= 2) {
            Alert.alert(
              'Limit erreicht',
              `Diese Organisation hat bereits ${count} Broadcast-Gruppen (Maximum: 2).`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        }
      } catch (err) {
        console.error('Unexpected error checking organization\'s broadcast groups:', err);
        Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
        setAdminGroupCount(0); // Assume 0 on error
      } finally {
        setIsChecking(false);
      }
    };

    checkExistingGroups();
  }, [user, activeOrganizationId, navigation]); // Add activeOrganizationId and navigation to dependencies
  
  // Validate form before submission
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
    
    if (adminGroupCount >= 2) {
      Alert.alert('Fehler', 'Du kannst maximal 2 Broadcast-Gruppen erstellen.');
      return false;
    }
    
    return true;
  };
  
  // Handle group creation
  const handleCreate = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um eine Gruppe zu erstellen.');
      return;
    }
    
    if (!validateForm()) return;
    
    try {
      setIsCreating(true);
      
      // Insert new broadcast group
      const { data, error } = await supabase
        .from('chat_groups')
        .insert({
          name: name,
          description: description,
          type: 'broadcast',
          tags: selectedTags,
          organization_id: activeOrganizationId,
          is_active: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating broadcast group:', error);
        
        // Check if it's a unique constraint violation (name already exists)
        if (error.code === '23505') {
          Alert.alert('Fehler', 'Eine Gruppe mit diesem Namen existiert bereits.');
        } else {
          Alert.alert('Fehler', 'Broadcast-Gruppe konnte nicht erstellt werden.');
        }
        return;
      }
      
      // Add welcome message to the group
      const welcomeMessage = `Willkommen in der Gruppe "${name}"! Diese Gruppe wurde gerade neu erstellt.`;
      
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          chat_group_id: data.id,
          user_id: user.id,
          text: welcomeMessage,
        });
      
      if (messageError) {
        console.error('Error adding welcome message:', messageError);
        // Continue anyway, not critical
      }
      
      Alert.alert(
        'Erfolg',
        'Deine Broadcast-Gruppe wurde erfolgreich erstellt!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('Unexpected error creating broadcast group:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsCreating(false);
    }
  };
  
  // Toggle tag selection
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  // Render tag selection buttons
  const renderTagButtons = () => {
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
  
  // Show loading screen while checking existing groups
  if (isChecking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Prüfe vorhandene Gruppen...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // If user already has 2 groups, don't show form (should be redirected by the useEffect)
  if (adminGroupCount >= 2) {
    return null;
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neue Broadcast-Gruppe</Text>
        <View style={styles.headerRight}>
          {isCreating ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreate}
            >
              <Text style={styles.createButtonText}>Erstellen</Text>
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
          <Text style={styles.formSubtitle}>
            Du kannst maximal 2 Broadcast-Gruppen erstellen. 
            Bisher hast du {adminGroupCount} {adminGroupCount === 1 ? 'Gruppe' : 'Gruppen'}.
          </Text>
          
          <Text style={styles.inputLabel}>Name der Gruppe</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Name der Broadcast-Gruppe..."
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          
          <Text style={styles.inputLabel}>Beschreibung</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Beschreibung der Gruppe..."
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
          
          <Text style={styles.inputLabel}>Tags</Text>
          <Text style={styles.tagHelp}>Wähle mindestens einen Tag aus:</Text>
          {renderTagButtons()}
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
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
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
  createButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  createButtonText: {
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
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  tagHelp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  nameInput: {
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
    minHeight: 100,
    marginBottom: 15,
  },
  tagButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tagButton: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  selectedTagButton: {
    backgroundColor: '#4285F4',
  },
  tagButtonText: {
    fontSize: 14,
    color: '#333',
  },
  selectedTagButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CreateBroadcastGroupScreen; 