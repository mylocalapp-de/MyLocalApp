import React, { useState } from 'react';
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
const androidPaddingTop = height * 0.03; // 3% of screen height for better scaling

const CreateArticleScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  
  // Article form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Type selection options
  const articleTypes = [
    { id: 'kultur', name: 'Kultur' },
    { id: 'sport', name: 'Sport' },
    { id: 'verkehr', name: 'Verkehr' },
    { id: 'politik', name: 'Politik' },
    { id: 'vereine', name: 'Vereine' },
    { id: 'gemeinde', name: 'Gemeinde' },
    { id: 'polizei', name: 'Polizei' },
    { id: 'veranstaltungen', name: 'Veranstaltungen' }
  ];
  
  // Validate form before submission
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
      return false;
    }
    
    if (!content.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Inhalt ein.');
      return false;
    }
    
    if (!type) {
      Alert.alert('Fehler', 'Bitte wähle eine Kategorie aus.');
      return false;
    }
    
    return true;
  };
  
  // Handle article publishing
  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um einen Artikel zu veröffentlichen.');
      return;
    }
    
    if (!validateForm()) return;
    
    try {
      setIsPublishing(true);
      
      // Insert new article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: title,
          content: content,
          type: type,
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error publishing article:', error);
        Alert.alert('Fehler', 'Artikel konnte nicht veröffentlicht werden.');
        return;
      }
      
      Alert.alert(
        'Erfolg',
        'Dein Artikel wurde erfolgreich veröffentlicht!',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Use goBack to return to previous screen
              navigation.goBack();
            }
          }
        ]
      );
    } catch (err) {
      console.error('Unexpected error publishing article:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Create draft without publishing
  const handleSaveDraft = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um einen Entwurf zu speichern.');
      return;
    }
    
    if (!title.trim() && !content.trim()) {
      Alert.alert('Fehler', 'Bitte gib mindestens einen Titel oder Inhalt ein.');
      return;
    }
    
    try {
      setIsPublishing(true);
      
      // Insert new draft article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: title || 'Unbenannter Entwurf',
          content: content || '',
          type: type || 'Vereine',  // Default type
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: false  // Mark as draft
        });
      
      if (error) {
        console.error('Error saving draft:', error);
        Alert.alert('Fehler', 'Entwurf konnte nicht gespeichert werden.');
        return;
      }
      
      Alert.alert(
        'Erfolg',
        'Dein Entwurf wurde gespeichert!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('Unexpected error saving draft:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Render type selection buttons
  const renderTypeButtons = () => {
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeButtonsContainer}
      >
        {articleTypes.map(articleType => (
          <TouchableOpacity
            key={articleType.id}
            style={[
              styles.typeButton,
              type === articleType.name && styles.selectedTypeButton
            ]}
            onPress={() => setType(articleType.name)}
          >
            <Text 
              style={[
                styles.typeButtonText,
                type === articleType.name && styles.selectedTypeButtonText
              ]}
            >
              {articleType.name}
            </Text>
          </TouchableOpacity>
        ))}
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
        <Text style={styles.headerTitle}>Neuer Artikel</Text>
        <View style={styles.headerRight}>
          {isPublishing ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveDraft}
              >
                <Text style={styles.saveButtonText}>Entwurf</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.publishButton}
                onPress={handlePublish}
              >
                <Text style={styles.publishButtonText}>Veröffentlichen</Text>
              </TouchableOpacity>
            </>
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
          {renderTypeButtons()}
          
          <Text style={styles.inputLabel}>Titel</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Gib deinem Artikel einen Titel..."
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          
          <Text style={styles.inputLabel}>Inhalt</Text>
          <TextInput
            style={styles.contentInput}
            placeholder="Schreibe hier deinen Artikel..."
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
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
  saveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
  },
  saveButtonText: {
    color: '#666',
    fontSize: 14,
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
  titleInput: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
  },
  contentInput: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 200,
    marginBottom: 15,
  },
});

export default CreateArticleScreen; 