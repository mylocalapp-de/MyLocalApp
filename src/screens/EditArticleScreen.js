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
import { LinearGradient } from 'expo-linear-gradient';

const EditArticleScreen = ({ navigation, route }) => {
  const { articleId } = route.params;
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  
  // Article form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [initialType, setInitialType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isOrgArticle, setIsOrgArticle] = useState(false); // State to track if it's an org article
  const [imageUrl, setImageUrl] = useState(''); // Current image URL from DB
  const [imageAsset, setImageAsset] = useState(null); // State for newly selected image asset
  const [isUploading, setIsUploading] = useState(false); // State for upload progress
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false); // State to track image removal
  
  // State for fetched article types/filters
  const [availableArticleTypes, setAvailableArticleTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Load article data and types
  useEffect(() => {
    // Fetch types first, then the article data
    fetchArticleTypes().then(() => {
      fetchArticle(); // Fetch article after types are loaded
    });
  }, [articleId]);

  // Fetch article types (user-selectable only)
  const fetchArticleTypes = async () => {
    setLoadingTypes(true);
    try {
      const { data, error } = await supabase
        .from('article_filters')
        .select('name, is_highlighted, is_admin_only, enable_personal')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching article types:', error);
        setAvailableArticleTypes([]);
      } else {
        const inPersonalContext = !activeOrganizationId;
        const userVisibleTypes = data
          .filter(item => !item.is_admin_only && (!inPersonalContext || item.enable_personal))
          .map(item => ({ 
            name: item.name, 
            is_highlighted: item.is_highlighted || false 
          }));
        setAvailableArticleTypes(userVisibleTypes);
      }
    } catch (err) {
      console.error('Unexpected error fetching article types:', err);
      setAvailableArticleTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

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
      setInitialType(data.type || '');
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

      // Include image URLs for both personal and organization articles
      updateData.image_url = finalImageUrl;
      updateData.preview_image_url = finalPreviewUrl;

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
    if (loadingTypes) {
      return <ActivityIndicator size="small" color="#4285F4" style={styles.loadingIndicator}/>;
    }
    // If the initial type is admin-only, we need to show it even if it's not in availableArticleTypes
    const displayTypes = [...availableArticleTypes];
    const initialTypeIsSelectable = availableArticleTypes.some(t => t.name === initialType);
    if (initialType && !initialTypeIsSelectable) {
      // Add the initial type (which must be admin-only) to the start of the list for display
      displayTypes.unshift({ name: initialType, is_highlighted: false }); 
    }

    if (displayTypes.length === 0) {
      return <Text style={styles.noTypesText}>Keine Kategorien zum Auswählen verfügbar.</Text>;
    }

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeButtonsContainer}
      >
        {displayTypes.map(articleType => {
          const isSelected = type === articleType.name;
          // Highlight only if explicitly marked AND not selected
          const isHighlighted = articleType.is_highlighted && !isSelected; 
          // Check if the button should be disabled (initial admin-only type cannot be changed)
          const isDisabled = !availableArticleTypes.some(t => t.name === articleType.name) && articleType.name === initialType;

          const buttonStyle = [
            styles.typeButtonBase,
            isSelected ? styles.selectedTypeButton : styles.typeButton,
            isHighlighted && styles.highlightedTypeButton,
            isDisabled && styles.disabledTypeButton // Style for disabled button
          ];

          const textStyle = [
            styles.typeButtonText,
            isSelected && styles.selectedTypeButtonText,
            isDisabled && styles.disabledTypeButtonText // Style for disabled text
          ];

          return (
            <TouchableOpacity
              key={articleType.name}
              style={buttonStyle}
              onPress={() => setType(articleType.name)}
              disabled={isDisabled} // Disable button if needed
            >
              {isHighlighted ? (
                <LinearGradient
                  colors={['#f0f0f0', '#e0e0e0']}
                  style={styles.gradientWrapperType}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={textStyle}>
                    {articleType.name}
                  </Text>
                </LinearGradient>
              ) : (
                 <View style={styles.textWrapperType}>
                   <Text style={textStyle}>
                     {articleType.name}
                   </Text>
                 </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Show loading state
  if (isLoading || loadingTypes) {
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
          
          {/* Image Upload/Edit */}
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
    marginBottom: 10,
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
  disabledTypeButton: {
    backgroundColor: '#e0e0e0',
    borderColor: '#bdbdbd',
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
  typeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  selectedTypeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledTypeButtonText: {
      color: '#9e9e9e',
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
  loadingIndicator: {
      marginVertical: 10,
  },
  noTypesText: {
      fontStyle: 'italic',
      color: '#6c757d',
      paddingVertical: 10,
  },
});

export default EditArticleScreen; 