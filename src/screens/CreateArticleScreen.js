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
  Button
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03; // 3% of screen height for better scaling

const CreateArticleScreen = ({ navigation, route }) => {
  const personalFilter = route.params?.filter;
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  
  // Article form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const isPersonal = !activeOrganizationId && !!personalFilter;
  const [isPublishing, setIsPublishing] = useState(false);
  const [imageAsset, setImageAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // State for fetched article types/filters
  const [availableArticleTypes, setAvailableArticleTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Fetch article types/filters on mount
  useEffect(() => {
    fetchArticleTypes();
  }, []);

  // Preselect filter for personal context
  useEffect(() => {
    if (isPersonal) {
      setType(personalFilter);
    }
  }, [isPersonal, personalFilter]);

  const fetchArticleTypes = async () => {
    setLoadingTypes(true);
    try {
      const { data, error } = await supabase
        .from('article_filters')
        .select('name, is_highlighted, is_admin_only, enable_personal') // Fetch all needed fields
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching article types:', error);
        Alert.alert('Fehler', 'Artikel-Kategorien konnten nicht geladen werden.');
        setAvailableArticleTypes([]);
      } else {
        // Filter out admin-only types and map to structure
        const userVisibleTypes = data
          .filter(item => !item.is_admin_only && (!isPersonal || item.enable_personal))
          .map(item => ({ 
            name: item.name, 
            is_highlighted: item.is_highlighted || false 
          }));
        setAvailableArticleTypes(userVisibleTypes);
        // Optionally set a default type if none is selected and list is not empty
        // if (!type && userVisibleTypes.length > 0) {
        //   setType(userVisibleTypes[0].name);
        // }
      }
    } catch (err) {
      console.error('Unexpected error fetching article types:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      setAvailableArticleTypes([]);
    } finally {
      setLoadingTypes(false);
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
  
  // Function to pick an image
  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Sorry, wir benötigen die Berechtigung, um auf deine Fotos zugreifen zu können.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8, // Reduce quality slightly for faster uploads
      base64: true, // Request base64 data
    });

    if (!result.canceled) {
      setImageAsset(result.assets[0]);
    }
  };

  // Function to upload image and return URL
  const uploadImage = async (asset) => {
    if (!asset || !asset.base64) return null; // Check if asset and base64 data exist

    setIsUploading(true);
    try {
        const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`; // Store directly in the root for simplicity, or use orgId/fileName

        const { data, error: uploadError } = await supabase.storage
            .from('article_images')
            .upload(filePath, decode(asset.base64), { // Use decode here
                contentType: asset.mimeType ?? `image/${fileExt}`
            });

        if (uploadError) {
            throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('article_images')
            .getPublicUrl(filePath);

        return urlData?.publicUrl;

    } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Upload Fehler', 'Das Bild konnte nicht hochgeladen werden.');
        return null;
    } finally {
        setIsUploading(false);
    }
  };

  // Handle article publishing
  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um einen Artikel zu veröffentlichen.');
      return;
    }
    
    if (!validateForm()) return;
    
    setIsPublishing(true);
    let finalImageUrl = null;

    try {
      // Upload image if one is selected
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) {
          setIsPublishing(false);
          return;
        }
      }

      // Insert new article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: title,
          content: content.replace(/\n/g, '<br>'),
          type: type,
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: true,
          image_url: finalImageUrl,
          preview_image_url: finalImageUrl
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
      setIsUploading(false);
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
    
    setIsPublishing(true);
    let finalImageUrl = null;

    try {
      // Upload image if one is selected
      if (imageAsset) {
        finalImageUrl = await uploadImage(imageAsset);
        if (!finalImageUrl) {
          setIsPublishing(false);
          return;
        }
      }

      // Insert new draft article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: title || 'Unbenannter Entwurf',
          content: (content || '').replace(/\n/g, '<br>'),
          type: type || 'Vereine',
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: false,
          image_url: finalImageUrl,
          preview_image_url: finalImageUrl
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
      setIsUploading(false);
    }
  };
  
  // Render type selection buttons
  const renderTypeButtons = () => {
    if (isPersonal) {
      return <Text style={styles.inputLabel}>{personalFilter}</Text>;
    }
    if (loadingTypes) {
      return <ActivityIndicator size="small" color="#4285F4" style={styles.loadingIndicator}/>;
    }
    if (availableArticleTypes.length === 0) {
      return <Text style={styles.noTypesText}>Keine Kategorien zum Auswählen verfügbar.</Text>;
    }

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeButtonsContainer}
      >
        {availableArticleTypes.map(articleType => {
          const isSelected = type === articleType.name;
          const isHighlighted = articleType.is_highlighted && !isSelected;

          const buttonStyle = [
            styles.typeButtonBase, // Base style for layout/border
            isSelected ? styles.selectedTypeButton : styles.typeButton, // Background for non-highlighted
            isHighlighted && styles.highlightedTypeButton // Border for highlighted
          ];

          const textStyle = [
            styles.typeButtonText,
            isSelected && styles.selectedTypeButtonText
            // isHighlighted && styles.highlightedTypeButtonText // Optional separate text style
          ];

          return (
            <TouchableOpacity
              key={articleType.name}
              style={buttonStyle}
              onPress={() => setType(articleType.name)}
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
                 // Need a View wrapper for non-gradient text to apply padding correctly
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
          {(isPublishing || isUploading) ? (
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

          {/* Image Upload - REMOVED: only shown for org articles */}
          {/* {activeOrganizationId && ( */} 
            <>
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
                 <Ionicons name="camera" size={20} color="#4285F4" style={{marginRight: 10}} />
                 <Text style={styles.imagePickerButtonText}>
                   {imageAsset ? 'Bild ändern' : 'Bild auswählen'}
                 </Text>
               </TouchableOpacity>
              {isUploading && <ActivityIndicator size="small" color="#4285F4" style={{ marginTop: 10}} />}
            </>
          {/* )} */}
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
    textAlignVertical: 'top',
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

export default CreateArticleScreen; 