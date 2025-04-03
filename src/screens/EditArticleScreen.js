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
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';

const EditArticleScreen = ({ navigation, route }) => {
  const { articleId } = route.params;
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  
  // Article form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isOrgArticle, setIsOrgArticle] = useState(false); // State to track if it's an org article
  const [imageUrl, setImageUrl] = useState(''); // Current image URL from DB
  const [imageAsset, setImageAsset] = useState(null); // State for newly selected image asset
  const [isUploading, setIsUploading] = useState(false); // State for upload progress
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false); // State to track image removal
  
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
      
      // --- Authorization Check --- 
      let canEdit = false;
      if (!data.organization_id) { // Personal Article
          // Can only edit personal article if NOT in an org context
          canEdit = data.author_id === user?.id && !activeOrganizationId;
      } else { // Organizational Article
          // Can only edit org article if user is member AND currently in that org's context
          if (activeOrganizationId !== data.organization_id) {
               canEdit = false; // Not in the correct org context
          } else {
               // User is in the correct org context, now check membership
               try {
                  const { data: membership, error: memberError } = await supabase
                      .from('organization_members')
                      .select('user_id') // Just need to check if a row exists
                      .eq('organization_id', data.organization_id)
                      .eq('user_id', user?.id)
                      .maybeSingle();

                  if (!memberError && membership) {
                      canEdit = true; // User is a member
                  }
              } catch (e) {
                  console.error("Unexpected error checking membership:", e);
                  canEdit = false;
              }
          }
      }

      if (!canEdit) {
          setError('You are not authorized to edit this article.');
          // Optional: Alert the user as well
          Alert.alert('Fehler', 'Du bist nicht berechtigt, diesen Artikel zu bearbeiten.');
          navigation.goBack(); // Go back if not authorized
          return;
      }
      // --- End Authorization Check ---
      
      // Set form values
      setTitle(data.title || '');
      setContent(data.content || '');
      setType(data.type || '');
      setIsOrgArticle(!!data.organization_id); // Check if it has an org ID
      setImageUrl(data.image_url || ''); // Load the existing image URL
      setImageAsset(null); // Reset selected asset
      setRemoveCurrentImage(false); // Reset removal flag
      
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
  
  // Function to pick an image (same as in CreateArticleScreen)
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Sorry, wir benötigen die Berechtigung, um auf deine Fotos zugreifen zu können.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setImageAsset(result.assets[0]);
      setImageUrl(''); // Clear old URL if new image is picked
      setRemoveCurrentImage(false); // Unset removal flag if new image picked
    }
  };

  // Function to upload image and return URL (same as in CreateArticleScreen)
  const uploadImage = async (asset) => {
    if (!asset || !asset.base64) return null;
    setIsUploading(true);
    try {
        const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { data, error: uploadError } = await supabase.storage
            .from('article_images')
            .upload(filePath, decode(asset.base64), { contentType: asset.mimeType ?? `image/${fileExt}` });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('article_images').getPublicUrl(filePath);
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
    setImageAsset(null); // Clear any newly selected asset
    setImageUrl(''); // Clear the displayed URL
    setRemoveCurrentImage(true); // Flag for removal on save
  };

  // Handle article update
  const handleUpdate = async () => {
    if (!user || !validateForm()) return;

    setIsSaving(true); // Covers upload + DB update
    let finalImageUrl = imageUrl; // Start with the existing URL
    let finalPreviewUrl = imageUrl; // Assume same for preview initially

    try {
      // Scenario 1: New image selected for upload
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) {
          setIsSaving(false);
          return; // Upload failed, stop update
        }
        finalPreviewUrl = finalImageUrl; // Use new image for preview too
      }
      // Scenario 2: Existing image flagged for removal
      else if (removeCurrentImage) {
        finalImageUrl = null;
        finalPreviewUrl = null;
        // TODO: Optionally delete the old image from Supabase storage here
        // Requires knowing the old file path, not just the URL.
        // const oldFileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        // if (oldFileName) await supabase.storage.from('article_images').remove([oldFileName]);
      }
      // Scenario 3: Keep existing image (finalImageUrl already holds it)
      // No action needed for this case

      // Update the article in the database
      const updateData = {
          title: title,
          content: content,
          type: type,
      };

      // Only include image URLs in update if it's an org article
      if (isOrgArticle) {
          updateData.image_url = finalImageUrl;
          updateData.preview_image_url = finalPreviewUrl;
      } else {
          // Ensure images are nullified if it somehow became a non-org article (edge case)
          updateData.image_url = null;
          updateData.preview_image_url = null;
      }

      const { error } = await supabase
        .from('articles')
        .update(updateData)
        .eq('id', articleId); // RLS handles the author_id check

      if (error) {
        console.error('Error updating article:', error);
        Alert.alert('Fehler', 'Artikel konnte nicht aktualisiert werden.');
        return; // Stop execution here
      }

      Alert.alert(
        'Erfolg',
        'Dein Artikel wurde erfolgreich aktualisiert!',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('HomeList');
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
      setIsUploading(false); // Ensure reset
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
          style={styles.backButtonStyle}
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
        <Text style={styles.headerTitle}>Artikel bearbeiten</Text>
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
          
          {/* Image Upload/Edit - only shown for org articles */}
          {isOrgArticle && (
            <>
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
            </>
          )}
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
  backButtonStyle: {
    backgroundColor: '#eee',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
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
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef4ff',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
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
});

export default EditArticleScreen; 