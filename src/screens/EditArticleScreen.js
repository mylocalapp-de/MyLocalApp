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
  Image,
  Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ImagePickerButton } from '../components/common';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

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
  const [isOrgArticle, setIsOrgArticle] = useState(false);
  // Multi-image state
  const [existingImages, setExistingImages] = useState([]); // Images from DB: [{id, image_url, display_order}]
  const [newImageAssets, setNewImageAssets] = useState([]); // Newly selected images to upload
  const [imagesToDelete, setImagesToDelete] = useState([]); // IDs of existing images to delete
  const [isUploading, setIsUploading] = useState(false);
  
  // File attachments state
  const [existingAttachments, setExistingAttachments] = useState([]); // Attachments from DB
  const [newFileAssets, setNewFileAssets] = useState([]); // Newly selected files to upload
  const [attachmentsToDelete, setAttachmentsToDelete] = useState([]); // IDs of attachments to delete
  const editorRef = useRef(null);
  const contentRef = useRef(''); // Source of truth for editor HTML (avoid setState per keystroke)
  const [editorKey, setEditorKey] = useState(0);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  
  // Tags state
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
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
      contentRef.current = data.content || '';
      setType(data.type || '');
      setInitialType(data.type || '');
      setIsOrgArticle(!!data.organization_id);
      setTags(data.tags || []);
      setTagInput('');
      setNewImageAssets([]);
      setImagesToDelete([]);
      setNewFileAssets([]);
      setAttachmentsToDelete([]);
      setEditorKey(prev => prev + 1);

      // Fetch existing images from article_images table
      const { data: imagesData, error: imagesError } = await supabase
        .from('article_images')
        .select('id, image_url, display_order')
        .eq('article_id', articleId)
        .order('display_order', { ascending: true });

      if (imagesError) {
        console.error('Error fetching article images:', imagesError);
        // Fallback to legacy single image if available
        if (data.image_url) {
          setExistingImages([{ id: null, image_url: data.image_url, display_order: 0, isLegacy: true }]);
        } else {
          setExistingImages([]);
        }
      } else if (imagesData && imagesData.length > 0) {
        setExistingImages(imagesData);
      } else if (data.image_url) {
        // No images in new table but has legacy image_url
        setExistingImages([{ id: null, image_url: data.image_url, display_order: 0, isLegacy: true }]);
      } else {
        setExistingImages([]);
      }

      // Fetch existing attachments from article_attachments table
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('article_attachments')
        .select('id, file_url, file_name, file_size, mime_type, display_order')
        .eq('article_id', articleId)
        .order('display_order', { ascending: true });

      if (attachmentsError) {
        console.error('Error fetching article attachments:', attachmentsError);
        setExistingAttachments([]);
      } else {
        setExistingAttachments(attachmentsData || []);
      }
      
    } catch (err) {
      console.error('Unexpected error fetching article:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Validate form before submission (checks editor content)
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
    contentRef.current = html ?? '';
  };

  const handleHtmlChange = (html) => {
    const next = html ?? '';
    setContent(next);
    contentRef.current = next;
  };

  const toggleContentMode = () => {
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
  
  // Function to pick multiple images
  // Image picking is now handled by ImagePickerButton component
  const activeExistingCount = existingImages.filter(img => !imagesToDelete.includes(img.id)).length;
  const maxNewImages = Math.max(0, 10 - activeExistingCount);

  // Function to upload a single image and return URL
  const uploadSingleImage = async (asset) => {
    if (!asset || !asset.base64) return null;

    const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error: uploadError } = await supabase.storage
        .from('article_images')
        .upload(filePath, decode(asset.base64), { 
          contentType: asset.mimeType ?? `image/${fileExt}` 
        });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
        .from('article_images')
        .getPublicUrl(filePath);

    return urlData?.publicUrl;
  };

  // Function to upload multiple images and return array of URLs
  const uploadImages = async (assets) => {
    if (!assets || assets.length === 0) return [];

    setIsUploading(true);
    try {
      const uploadPromises = assets.map(asset => uploadSingleImage(asset));
      const urls = await Promise.all(uploadPromises);
      return urls.filter(url => url !== null);
    } catch (error) {
      console.error('Error uploading images:', error);
      Alert.alert('Upload Fehler', 'Ein oder mehrere Bilder konnten nicht hochgeladen werden.');
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  // Remove an existing image (mark for deletion)
  const removeExistingImage = (imageId) => {
    if (imageId) {
      setImagesToDelete(prev => [...prev, imageId]);
    } else {
      // Legacy image without ID - just remove from existingImages
      setExistingImages(prev => prev.filter(img => img.id !== null));
    }
  };

  // Remove a newly selected image
  const removeNewImage = (index) => {
    setNewImageAssets(prev => prev.filter((_, i) => i !== index));
  };

  // Function to pick files
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        setNewFileAssets(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Fehler', 'Datei konnte nicht ausgewählt werden.');
    }
  };

  // Remove a newly selected file
  const removeNewFile = (index) => {
    setNewFileAssets(prev => prev.filter((_, i) => i !== index));
  };

  // Remove an existing attachment (mark for deletion)
  const removeExistingAttachment = (attachmentId) => {
    if (attachmentId) {
      setAttachmentsToDelete(prev => [...prev, attachmentId]);
    }
  };

  // Function to upload a single file and return URL + metadata
  const uploadSingleFile = async (asset) => {
    if (!asset || !asset.uri) return null;

    try {
      const fileExt = asset.name?.split('.').pop()?.toLowerCase() ?? 'bin';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      // Fetch the file as blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Convert blob to array buffer
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { data, error: uploadError } = await supabase.storage
        .from('article_images')
        .upload(filePath, arrayBuffer, {
          contentType: asset.mimeType ?? 'application/octet-stream'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('article_images')
        .getPublicUrl(filePath);

      return {
        url: urlData?.publicUrl,
        name: asset.name || fileName,
        size: asset.size || 0,
        mimeType: asset.mimeType || 'application/octet-stream'
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  // Function to upload multiple files and return array of metadata
  const uploadFiles = async (assets) => {
    if (!assets || assets.length === 0) return [];

    try {
      const uploadPromises = assets.map(asset => uploadSingleFile(asset));
      const results = await Promise.all(uploadPromises);
      return results.filter(result => result !== null);
    } catch (error) {
      console.error('Error uploading files:', error);
      Alert.alert('Upload Fehler', 'Ein oder mehrere Dateien konnten nicht hochgeladen werden.');
      return [];
    }
  };

  // Helper to get file icon based on mime type
  const getFileIcon = (mimeType) => {
    if (!mimeType) return 'document-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive-outline';
    if (mimeType.includes('audio')) return 'musical-notes-outline';
    if (mimeType.includes('video')) return 'videocam-outline';
    return 'document-outline';
  };

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle article update
  const handleUpdate = async () => {
    if (!user || !(await validateForm())) return;

    setIsSaving(true);
    let htmlContent = contentRef.current || '';

    try {
      // 1. Delete images marked for removal from article_images table
      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('article_images')
          .delete()
          .in('id', imagesToDelete);

        if (deleteError) {
          console.error('Error deleting images:', deleteError);
          // Continue anyway, non-critical
        }
      }

      // 2. Upload new images
      let newImageUrls = [];
      if (newImageAssets.length > 0) {
        newImageUrls = await uploadImages(newImageAssets);
        if (newImageUrls.length === 0 && newImageAssets.length > 0) {
          setIsSaving(false);
          return; // All uploads failed
        }
      }

      // 3. Calculate remaining existing images (not deleted)
      const remainingExisting = existingImages.filter(
        img => !imagesToDelete.includes(img.id) && !img.isLegacy
      );
      const legacyImage = existingImages.find(img => img.isLegacy && !imagesToDelete.includes(img.id));

      // 4. Determine the cover image (first image overall)
      let coverImageUrl = null;
      if (remainingExisting.length > 0) {
        coverImageUrl = remainingExisting[0].image_url;
      } else if (legacyImage) {
        coverImageUrl = legacyImage.image_url;
      } else if (newImageUrls.length > 0) {
        coverImageUrl = newImageUrls[0];
      }

      // 5. Insert new images into article_images table
      if (newImageUrls.length > 0) {
        // Get the max display_order from remaining existing images
        const maxOrder = remainingExisting.length > 0 
          ? Math.max(...remainingExisting.map(img => img.display_order)) + 1
          : (legacyImage ? 1 : 0);

        const imageRecords = newImageUrls.map((url, index) => ({
          article_id: articleId,
          image_url: url,
          display_order: maxOrder + index
        }));

        const { error: insertError } = await supabase
          .from('article_images')
          .insert(imageRecords);

        if (insertError) {
          console.error('Error inserting new images:', insertError);
        }
      }

      // 6. If we had a legacy image that wasn't deleted, migrate it to article_images
      if (legacyImage && remainingExisting.length === 0 && !imagesToDelete.includes(null)) {
        const { error: migrationError } = await supabase
          .from('article_images')
          .insert({
            article_id: articleId,
            image_url: legacyImage.image_url,
            display_order: 0
          });

        if (migrationError) {
          console.error('Error migrating legacy image:', migrationError);
        }
      }

      // 7. Delete attachments marked for removal from article_attachments table
      if (attachmentsToDelete.length > 0) {
        const { error: deleteAttachmentsError } = await supabase
          .from('article_attachments')
          .delete()
          .in('id', attachmentsToDelete);

        if (deleteAttachmentsError) {
          console.error('Error deleting attachments:', deleteAttachmentsError);
        }
      }

      // 8. Upload new files
      let uploadedFiles = [];
      if (newFileAssets.length > 0) {
        uploadedFiles = await uploadFiles(newFileAssets);
      }

      // 9. Insert new files into article_attachments table
      if (uploadedFiles.length > 0) {
        const remainingAttachments = existingAttachments.filter(
          att => !attachmentsToDelete.includes(att.id)
        );
        const maxAttachmentOrder = remainingAttachments.length > 0
          ? Math.max(...remainingAttachments.map(att => att.display_order)) + 1
          : 0;

        const attachmentRecords = uploadedFiles.map((file, index) => ({
          article_id: articleId,
          file_url: file.url,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.mimeType,
          display_order: maxAttachmentOrder + index
        }));

        const { error: insertAttachmentsError } = await supabase
          .from('article_attachments')
          .insert(attachmentRecords);

        if (insertAttachmentsError) {
          console.error('Error inserting new attachments:', insertAttachmentsError);
        }
      }

      // 10. Update the article in the database
      const updateData = {
        title: title,
        content: htmlContent,
        type: type,
        image_url: coverImageUrl,
        preview_image_url: coverImageUrl,
        tags: tags
      };

      const { error } = await supabase
        .from('articles')
        .update(updateData)
        .eq('id', articleId);

      if (error) {
        console.error('Error updating article:', error);
        Alert.alert('Fehler', 'Artikel konnte nicht aktualisiert werden.');
        return;
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
      setIsUploading(false);
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
  
  // Calculate total images for display
  const displayExistingImages = existingImages.filter(img => !imagesToDelete.includes(img.id));
  const totalImages = displayExistingImages.length + newImageAssets.length;

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
                key={editorKey}
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
          
          {/* Image Upload/Edit - Multiple images */}
          <>
              <Text style={styles.inputLabel}>Bilder (Optional, max. 10)</Text>
              {(displayExistingImages.length > 0 || newImageAssets.length > 0) && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagePreviewScroll}
                  contentContainerStyle={styles.imagePreviewScrollContent}
                >
                  {/* Existing images from DB */}
                  {displayExistingImages.map((img, index) => (
                    <View key={`existing-${img.id || index}`} style={styles.imagePreviewItem}>
                      <Image source={{ uri: img.image_url }} style={styles.imagePreviewThumb} />
                      <TouchableOpacity 
                        onPress={() => removeExistingImage(img.id)} 
                        style={styles.removeImageButton}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff3b30" />
                      </TouchableOpacity>
                      {index === 0 && newImageAssets.length === 0 && (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>Cover</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {/* New images to upload */}
                  {newImageAssets.map((asset, index) => (
                    <View key={`new-${index}`} style={styles.imagePreviewItem}>
                      <Image source={{ uri: asset.uri }} style={styles.imagePreviewThumb} />
                      <TouchableOpacity 
                        onPress={() => removeNewImage(index)} 
                        style={styles.removeImageButton}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff3b30" />
                      </TouchableOpacity>
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>Neu</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
              <ImagePickerButton
                images={newImageAssets}
                onImagesChange={setNewImageAssets}
                maxImages={maxNewImages}
                disabled={isUploading}
                label=""
                showCoverBadge={false}
              />
            </>

          {/* File Attachments Upload/Edit */}
          <>
            <Text style={styles.inputLabel}>Dateianhänge (Optional)</Text>
            {/* Existing attachments from DB */}
            {existingAttachments.filter(att => !attachmentsToDelete.includes(att.id)).length > 0 && (
              <View style={styles.fileListContainer}>
                {existingAttachments
                  .filter(att => !attachmentsToDelete.includes(att.id))
                  .map((att) => (
                    <View key={`existing-att-${att.id}`} style={styles.fileItem}>
                      <Ionicons name={getFileIcon(att.mime_type)} size={24} color="#4285F4" />
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileName} numberOfLines={1}>{att.file_name}</Text>
                        {att.file_size > 0 && <Text style={styles.fileSize}>{formatFileSize(att.file_size)}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => removeExistingAttachment(att.id)} style={styles.removeFileButton}>
                        <Ionicons name="close-circle" size={22} color="#ff3b30" />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
            {/* New files to upload */}
            {newFileAssets.length > 0 && (
              <View style={styles.fileListContainer}>
                {newFileAssets.map((file, index) => (
                  <View key={`new-file-${index}`} style={[styles.fileItem, styles.newFileItem]}>
                    <Ionicons name={getFileIcon(file.mimeType)} size={24} color="#34C759" />
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      <View style={styles.fileMetaRow}>
                        {file.size > 0 && <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>}
                        <Text style={styles.newFileLabel}>Neu</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeNewFile(index)} style={styles.removeFileButton}>
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
                {(existingAttachments.filter(att => !attachmentsToDelete.includes(att.id)).length + newFileAssets.length) > 0 
                  ? 'Weitere Dateien hinzufügen' 
                  : 'Dateien anhängen'}
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
  imagePreviewScroll: {
    marginTop: 10,
    marginBottom: 5,
  },
  imagePreviewScrollContent: {
    paddingRight: 10,
  },
  imagePreviewItem: {
    position: 'relative',
    marginRight: 10,
  },
  imagePreviewThumb: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#4285F4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  newBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#34C759',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
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
  newFileItem: {
    backgroundColor: '#f0fff4',
    borderWidth: 1,
    borderColor: '#b7e4c7',
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
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  newFileLabel: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: 'bold',
    marginLeft: 8,
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

export default EditArticleScreen; 