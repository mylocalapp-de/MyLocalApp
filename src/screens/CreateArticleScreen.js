import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ImagePickerButton } from '../components/common';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { uploadImages, uploadFiles, getFileIcon, formatFileSize } from '../services/uploadService';
import { LinearGradient } from 'expo-linear-gradient';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

const { height, width } = Dimensions.get('window');
const androidPaddingTop = height * 0.03; // 3% of screen height for better scaling

const CreateArticleScreen = ({ navigation, route }) => {
  const personalFilter = route.params?.filter;
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  
  // Article form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const isPersonal = !activeOrganizationId && !!personalFilter;
  const [isPublishing, setIsPublishing] = useState(false);
  const [imageAssets, setImageAssets] = useState([]); // Changed to array for multiple images
  const [fileAssets, setFileAssets] = useState([]); // Array for file attachments
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef(null);
  const contentRef = useRef(''); // Source of truth for editor HTML (avoids rerendering on every keystroke)
  const [content, setContent] = useState('');
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  
  // Tags state
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
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
  
  // Validate form before submission (checks editor content text length)
  const validateForm = async () => {
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
      return false;
    }

    if (!type) {
      Alert.alert('Fehler', 'Bitte wähle eine Kategorie aus.');
      return false;
    }

    const plainText = (contentRef.current || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (!plainText) {
      Alert.alert('Fehler', 'Bitte gib einen Inhalt ein.');
      return false;
    }

    return true;
  };

  const handleRichEditorChange = (html) => {
    // RichEditor manages its own UI; avoid setState per keystroke to prevent heavy rerenders / reloads.
    contentRef.current = html ?? '';
  };

  const handleHtmlChange = (html) => {
    const next = html ?? '';
    setContent(next);
    contentRef.current = next;
  };

  const toggleContentMode = () => {
    // When switching to HTML mode, snapshot latest rich content into controlled TextInput state.
    if (!isHtmlMode) {
      setContent(contentRef.current || '');
    }
    setIsHtmlMode(prev => !prev);
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
  
  // Image picking handled by ImagePickerButton; uploads by uploadService

  // Function to pick files
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets) {
        setFileAssets(prev => [...prev, ...result.assets]);
      }
    } catch {
      Alert.alert('Fehler', 'Datei konnte nicht ausgewählt werden.');
    }
  };

  const removeFile = (index) => {
    setFileAssets(prev => prev.filter((_, i) => i !== index));
  };

  // Handle article publishing
  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Du musst angemeldet sein, um einen Artikel zu veröffentlichen.');
      return;
    }

    if (!(await validateForm())) return;
    
    setIsPublishing(true);
    let imageUrls = [];
    let uploadedFiles = [];
    let htmlContent = contentRef.current || '';

    try {
      // Upload all selected images via service
      setIsUploading(true);
      try {
        if (imageAssets.length > 0) {
          imageUrls = await uploadImages(imageAssets);
          if (imageUrls.length === 0 && imageAssets.length > 0) {
            setIsPublishing(false);
            setIsUploading(false);
            Alert.alert('Upload Fehler', 'Bilder konnten nicht hochgeladen werden.');
            return;
          }
        }
        if (fileAssets.length > 0) {
          uploadedFiles = await uploadFiles(fileAssets);
        }
      } finally {
        setIsUploading(false);
      }

      const coverImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: title,
          content: htmlContent,
          type: type,
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: true,
          image_url: coverImageUrl,
          preview_image_url: coverImageUrl,
          tags: tags
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error publishing article:', error);
        Alert.alert('Fehler', 'Artikel konnte nicht veröffentlicht werden.');
        return;
      }

      // Insert all images into article_images table
      if (imageUrls.length > 0 && data?.id) {
        const imageRecords = imageUrls.map((url, index) => ({
          article_id: data.id,
          image_url: url,
          display_order: index
        }));

        const { error: imagesError } = await supabase
          .from('article_images')
          .insert(imageRecords);

        if (imagesError) {
          console.error('Error saving article images:', imagesError);
          // Don't fail the whole operation, article is already created
        }
      }

      // Insert all files into article_attachments table
      if (uploadedFiles.length > 0 && data?.id) {
        const attachmentRecords = uploadedFiles.map((file, index) => ({
          article_id: data.id,
          file_url: file.url,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.mimeType,
          display_order: index
        }));

        const { error: attachmentsError } = await supabase
          .from('article_attachments')
          .insert(attachmentRecords);

        if (attachmentsError) {
          console.error('Error saving article attachments:', attachmentsError);
          // Don't fail the whole operation, article is already created
        }
      }
      
      Alert.alert(
        'Erfolg',
        'Dein Artikel wurde erfolgreich veröffentlicht!',
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

    let plainText = (contentRef.current || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (!title.trim() && !plainText.trim()) {
      Alert.alert('Fehler', 'Bitte gib mindestens einen Titel oder Inhalt ein.');
      return;
    }
    
    setIsPublishing(true);
    let imageUrls = [];
    let uploadedFiles = [];
    let htmlContent = contentRef.current || '';

    try {
      // Upload all selected images
      if (imageAssets.length > 0) {
        imageUrls = await uploadImages(imageAssets);
        if (imageUrls.length === 0 && imageAssets.length > 0) {
          setIsPublishing(false);
          return;
        }
      }

      // Upload all selected files
      if (fileAssets.length > 0) {
        uploadedFiles = await uploadFiles(fileAssets);
      }

      const coverImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

      // Insert new draft article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: title || 'Unbenannter Entwurf',
          content: htmlContent,
          type: type || 'Vereine',
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: false,
          image_url: coverImageUrl,
          preview_image_url: coverImageUrl,
          tags: tags
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving draft:', error);
        Alert.alert('Fehler', 'Entwurf konnte nicht gespeichert werden.');
        return;
      }

      // Insert all images into article_images table
      if (imageUrls.length > 0 && data?.id) {
        const imageRecords = imageUrls.map((url, index) => ({
          article_id: data.id,
          image_url: url,
          display_order: index
        }));

        const { error: imagesError } = await supabase
          .from('article_images')
          .insert(imageRecords);

        if (imagesError) {
          console.error('Error saving article images:', imagesError);
        }
      }

      // Insert all files into article_attachments table
      if (uploadedFiles.length > 0 && data?.id) {
        const attachmentRecords = uploadedFiles.map((file, index) => ({
          article_id: data.id,
          file_url: file.url,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.mimeType,
          display_order: index
        }));

        const { error: attachmentsError } = await supabase
          .from('article_attachments')
          .insert(attachmentRecords);

        if (attachmentsError) {
          console.error('Error saving article attachments:', attachmentsError);
        }
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
            style={styles.titleInput}
            placeholder="Gib deinem Artikel einen Titel..."
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>Inhalt</Text>
            <TouchableOpacity onPress={toggleContentMode}>
              <Text style={styles.toggleModeText}>{isHtmlMode ? 'WYSIWYG' : 'HTML'}</Text>
            </TouchableOpacity>
          </View>
          {isHtmlMode ? (
            <TextInput
              style={[styles.editorContainer, styles.htmlInput]}
              multiline
              value={content}
              onChangeText={handleHtmlChange}
              placeholder="<p>Schreibe hier HTML...</p>"
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.editorContainer}>
              <RichEditor
                ref={editorRef}
                initialContentHTML={content}
                onChange={handleRichEditorChange}
                androidHardwareAccelerationDisabled={true}
                editorStyle={{ backgroundColor: '#fff' }}
                style={styles.rich}
              />
            </View>
          )}
          {!isHtmlMode && (
            <RichToolbar
              editor={editorRef}
              actions={[actions.setBold, actions.setItalic, actions.setUnderline, actions.heading1, actions.insertBulletsList, actions.insertOrderedList, actions.alignLeft, actions.alignCenter, actions.alignRight, actions.insertLink]}
            />
          )}

          {/* Image Upload - Multiple images supported */}
          <ImagePickerButton
            images={imageAssets}
            onImagesChange={setImageAssets}
            maxImages={10}
            disabled={isUploading}
          />

          {/* File Attachments Upload */}
            <>
              <Text style={styles.inputLabel}>Dateianhänge (Optional)</Text>
              {fileAssets.length > 0 && (
                <View style={styles.fileListContainer}>
                  {fileAssets.map((file, index) => (
                    <View key={index} style={styles.fileItem}>
                      <Ionicons name={getFileIcon(file.mimeType)} size={24} color="#4285F4" />
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                        {file.size > 0 && <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => removeFile(index)} style={styles.removeFileButton}>
                        <Ionicons name="close-circle" size={22} color="#ff3b30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity 
                style={styles.filePickerButton} 
                onPress={pickFile} 
                disabled={isUploading}
              >
                <Ionicons name="attach" size={20} color="#4285F4" style={{marginRight: 10}} />
                <Text style={styles.filePickerButtonText}>
                  {fileAssets.length > 0 ? 'Weitere Dateien hinzufügen' : 'Dateien anhängen'}
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
  editorContainer: {
    minHeight: 200,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  rich: {
    minHeight: 200,
  },
  htmlInput: {
    padding: 10,
    minHeight: 200,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleModeText: {
    color: '#4285F4',
    fontWeight: 'bold',
  },
  // Image picker styles moved to ImagePickerButton component
  loadingIndicator: {
    marginVertical: 10,
  },
  noTypesText: {
    fontStyle: 'italic',
    color: '#6c757d',
    paddingVertical: 10,
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
  fileListContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  removeFileButton: {
    padding: 4,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#d0e3ff',
    borderStyle: 'dashed',
  },
  filePickerButtonText: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CreateArticleScreen; 