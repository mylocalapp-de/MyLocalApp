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
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const EditArticleScreen = ({ navigation, route }) => {
  const { articleId } = route.params;
  const { user } = useAuth();
  
  // Article form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
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

  // Load article data
  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  // Fetch the article to edit
  const fetchArticle = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();
      
      if (error) {
        console.error('Error fetching article:', error);
        setError('Could not load article. Please try again later.');
        return;
      }
      
      if (!data) {
        setError('Article not found.');
        return;
      }
      
      // Ensure the user is the author
      if (data.author_id !== user.id) {
        setError('You are not authorized to edit this article.');
        return;
      }
      
      // Set form values
      setTitle(data.title || '');
      setContent(data.content || '');
      setType(data.type || '');
      
    } catch (err) {
      console.error('Unexpected error fetching article:', err);
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
  
  // Handle article update
  const handleUpdate = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um einen Artikel zu aktualisieren.');
      return;
    }
    
    if (!validateForm()) return;
    
    try {
      setIsSaving(true);
      
      // Directly update the article. RLS policies will enforce that only the author can update.
      const { error } = await supabase
        .from('articles')
        .update({
          title: title,
          content: content,
          type: type
        })
        .eq('id', articleId); // RLS handles the author_id check
      
      if (error) {
        console.error('Error updating article:', error);
        Alert.alert('Fehler', 'Artikel konnte nicht aktualisiert werden. Bitte prüfe die RLS Policies oder Datenbankverbindung.');
        return;
      }
      
      Alert.alert(
        'Erfolg',
        'Dein Artikel wurde erfolgreich aktualisiert!',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Refresh the home screen when navigating back
              navigation.navigate('HomeList');
              // Then navigate to the article detail
              setTimeout(() => {
                navigation.navigate('ArticleDetail', { articleId });
              }, 100);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Unexpected error updating article:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSaving(false);
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

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Artikel wird geladen...</Text>
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
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artikel bearbeiten</Text>
        <View style={styles.headerRight}>
          {isSaving ? (
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

export default EditArticleScreen; 