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
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';

const { height, width } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

/**
 * Unified Article Form Screen — handles both create and edit modes.
 *
 * Route params:
 *   - articleId (optional): when present, the screen operates in edit mode
 *   - filter (optional): personal filter preset for create mode
 */
const ArticleFormScreen = ({ navigation, route }) => {
  const articleId = route.params?.articleId;
  const personalFilter = route.params?.filter;
  const isEditMode = !!articleId;

  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [initialType, setInitialType] = useState('');
  const isPersonal = !activeOrganizationId && !!personalFilter;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef(null);
  const contentRef = useRef('');
  const [content, setContent] = useState('');
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Article types
  const [availableArticleTypes, setAvailableArticleTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Edit-only state
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [isOrgArticle, setIsOrgArticle] = useState(false);

  // Images — create mode uses flat array, edit mode tracks existing vs new
  const [imageAssets, setImageAssets] = useState([]); // create: all images; edit: new images only
  const [existingImages, setExistingImages] = useState([]); // edit only
  const [imagesToDelete, setImagesToDelete] = useState([]); // edit only

  // File attachments
  const [fileAssets, setFileAssets] = useState([]); // create: all files; edit: new files only
  const [existingAttachments, setExistingAttachments] = useState([]); // edit only
  const [attachmentsToDelete, setAttachmentsToDelete] = useState([]); // edit only

  // ─── Lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (isEditMode) {
      fetchArticleTypes().then(() => fetchArticle());
    } else {
      fetchArticleTypes();
    }
  }, [articleId]);

  useEffect(() => {
    if (isPersonal && !isEditMode) {
      setType(personalFilter);
    }
  }, [isPersonal, personalFilter]);

  // ─── Data fetching ──────────────────────────────────────────
  const fetchArticleTypes = async () => {
    setLoadingTypes(true);
    try {
      const { data, error } = await supabase
        .from('article_filters')
        .select('name, is_highlighted, is_admin_only, enable_personal')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching article types:', error);
        if (!isEditMode) Alert.alert('Fehler', 'Artikel-Kategorien konnten nicht geladen werden.');
        setAvailableArticleTypes([]);
      } else {
        const inPersonalContext = !activeOrganizationId;
        const userVisibleTypes = data
          .filter(item => !item.is_admin_only && (!inPersonalContext || !isPersonal || item.enable_personal))
          .map(item => ({ name: item.name, is_highlighted: item.is_highlighted || false }));
        setAvailableArticleTypes(userVisibleTypes);
      }
    } catch (err) {
      console.error('Unexpected error fetching article types:', err);
      if (!isEditMode) Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      setAvailableArticleTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

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

      // Authorization check
      let canEdit = false;
      if (!data.organization_id) {
        canEdit = data.author_id === user?.id && !activeOrganizationId;
      } else {
        if (activeOrganizationId !== data.organization_id) {
          canEdit = false;
        } else {
          try {
            const { data: membership, error: memberError } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', data.organization_id)
              .eq('user_id', user?.id)
              .maybeSingle();
            if (!memberError && membership) canEdit = true;
          } catch (e) {
            console.error("Unexpected error checking membership:", e);
          }
        }
      }

      if (!canEdit) {
        setError('You are not authorized to edit this article.');
        Alert.alert('Fehler', 'Du bist nicht berechtigt, diesen Artikel zu bearbeiten.');
        navigation.goBack();
        return;
      }

      // Populate form
      setTitle(data.title || '');
      setContent(data.content || '');
      contentRef.current = data.content || '';
      setType(data.type || '');
      setInitialType(data.type || '');
      setIsOrgArticle(!!data.organization_id);
      setTags(data.tags || []);
      setTagInput('');
      setImageAssets([]);
      setImagesToDelete([]);
      setFileAssets([]);
      setAttachmentsToDelete([]);
      setEditorKey(prev => prev + 1);

      // Fetch existing images
      const { data: imagesData, error: imagesError } = await supabase
        .from('article_images')
        .select('id, image_url, display_order')
        .eq('article_id', articleId)
        .order('display_order', { ascending: true });

      if (imagesError) {
        console.error('Error fetching article images:', imagesError);
        if (data.image_url) {
          setExistingImages([{ id: null, image_url: data.image_url, display_order: 0, isLegacy: true }]);
        } else {
          setExistingImages([]);
        }
      } else if (imagesData && imagesData.length > 0) {
        setExistingImages(imagesData);
      } else if (data.image_url) {
        setExistingImages([{ id: null, image_url: data.image_url, display_order: 0, isLegacy: true }]);
      } else {
        setExistingImages([]);
      }

      // Fetch existing attachments
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

  // ─── Validation ─────────────────────────────────────────────
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

  // ─── Editor helpers ─────────────────────────────────────────
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

  // ─── File picking ───────────────────────────────────────────
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

  // ─── Edit-mode image/attachment helpers ─────────────────────
  const removeExistingImage = (imageId) => {
    if (imageId) {
      setImagesToDelete(prev => [...prev, imageId]);
    } else {
      setExistingImages(prev => prev.filter(img => img.id !== null));
    }
  };

  const removeExistingAttachment = (attachmentId) => {
    if (attachmentId) {
      setAttachmentsToDelete(prev => [...prev, attachmentId]);
    }
  };

  // Edit-mode upload helpers (inline, not using uploadService)
  const uploadSingleImageEdit = async (asset) => {
    if (!asset || !asset.base64) return null;
    const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${uuidv4()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('article_images')
      .upload(fileName, decode(asset.base64), { contentType: asset.mimeType ?? `image/${fileExt}` });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('article_images').getPublicUrl(fileName);
    return urlData?.publicUrl;
  };

  const uploadImagesEdit = async (assets) => {
    if (!assets || assets.length === 0) return [];
    setIsUploading(true);
    try {
      const urls = await Promise.all(assets.map(a => uploadSingleImageEdit(a)));
      return urls.filter(url => url !== null);
    } catch (error) {
      console.error('Error uploading images:', error);
      Alert.alert('Upload Fehler', 'Ein oder mehrere Bilder konnten nicht hochgeladen werden.');
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSingleFileEdit = async (asset) => {
    if (!asset || !asset.uri) return null;
    try {
      const fileExt = asset.name?.split('.').pop()?.toLowerCase() ?? 'bin';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `attachments/${fileName}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('article_images')
        .upload(filePath, arrayBuffer, { contentType: asset.mimeType ?? 'application/octet-stream' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('article_images').getPublicUrl(filePath);
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

  const uploadFilesEdit = async (assets) => {
    if (!assets || assets.length === 0) return [];
    try {
      const results = await Promise.all(assets.map(a => uploadSingleFileEdit(a)));
      return results.filter(r => r !== null);
    } catch (error) {
      console.error('Error uploading files:', error);
      Alert.alert('Upload Fehler', 'Ein oder mehrere Dateien konnten nicht hochgeladen werden.');
      return [];
    }
  };

  // ─── Submit handlers ────────────────────────────────────────
  const handleCreateSubmit = async (isDraft) => {
    if (!user) {
      Alert.alert('Fehler', isDraft
        ? 'Du musst angemeldet sein, um einen Entwurf zu speichern.'
        : 'Du musst angemeldet sein, um einen Artikel zu veröffentlichen.');
      return;
    }

    if (!isDraft && !(await validateForm())) return;

    if (isDraft) {
      const plainText = (contentRef.current || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
      if (!title.trim() && !plainText.trim()) {
        Alert.alert('Fehler', 'Bitte gib mindestens einen Titel oder Inhalt ein.');
        return;
      }
    }

    setIsSubmitting(true);
    let imageUrls = [];
    let uploadedFiles = [];
    const htmlContent = contentRef.current || '';

    try {
      setIsUploading(true);
      try {
        if (imageAssets.length > 0) {
          imageUrls = await uploadImages(imageAssets);
          if (imageUrls.length === 0 && imageAssets.length > 0) {
            setIsSubmitting(false);
            setIsUploading(false);
            if (!isDraft) Alert.alert('Upload Fehler', 'Bilder konnten nicht hochgeladen werden.');
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
          title: title || (isDraft ? 'Unbenannter Entwurf' : title),
          content: htmlContent,
          type: type || (isDraft ? 'Vereine' : type),
          author_id: user.id,
          organization_id: activeOrganizationId,
          is_published: !isDraft,
          image_url: coverImageUrl,
          preview_image_url: coverImageUrl,
          tags: tags
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving article:', error);
        Alert.alert('Fehler', isDraft
          ? 'Entwurf konnte nicht gespeichert werden.'
          : 'Artikel konnte nicht veröffentlicht werden.');
        return;
      }

      // Insert images
      if (imageUrls.length > 0 && data?.id) {
        const imageRecords = imageUrls.map((url, index) => ({
          article_id: data.id,
          image_url: url,
          display_order: index
        }));
        const { error: imagesError } = await supabase.from('article_images').insert(imageRecords);
        if (imagesError) console.error('Error saving article images:', imagesError);
      }

      // Insert attachments
      if (uploadedFiles.length > 0 && data?.id) {
        const attachmentRecords = uploadedFiles.map((file, index) => ({
          article_id: data.id,
          file_url: file.url,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.mimeType,
          display_order: index
        }));
        const { error: attachmentsError } = await supabase.from('article_attachments').insert(attachmentRecords);
        if (attachmentsError) console.error('Error saving article attachments:', attachmentsError);
      }

      Alert.alert(
        'Erfolg',
        isDraft ? 'Dein Entwurf wurde gespeichert!' : 'Dein Artikel wurde erfolgreich veröffentlicht!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('Unexpected error saving article:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!user || !(await validateForm())) return;

    setIsSubmitting(true);
    const htmlContent = contentRef.current || '';

    try {
      // 1. Delete images marked for removal
      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('article_images')
          .delete()
          .in('id', imagesToDelete);
        if (deleteError) console.error('Error deleting images:', deleteError);
      }

      // 2. Upload new images
      let newImageUrls = [];
      if (imageAssets.length > 0) {
        newImageUrls = await uploadImagesEdit(imageAssets);
        if (newImageUrls.length === 0 && imageAssets.length > 0) {
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Calculate remaining existing images
      const remainingExisting = existingImages.filter(
        img => !imagesToDelete.includes(img.id) && !img.isLegacy
      );
      const legacyImage = existingImages.find(img => img.isLegacy && !imagesToDelete.includes(img.id));

      // 4. Determine cover image
      let coverImageUrl = null;
      if (remainingExisting.length > 0) {
        coverImageUrl = remainingExisting[0].image_url;
      } else if (legacyImage) {
        coverImageUrl = legacyImage.image_url;
      } else if (newImageUrls.length > 0) {
        coverImageUrl = newImageUrls[0];
      }

      // 5. Insert new images
      if (newImageUrls.length > 0) {
        const maxOrder = remainingExisting.length > 0
          ? Math.max(...remainingExisting.map(img => img.display_order)) + 1
          : (legacyImage ? 1 : 0);
        const imageRecords = newImageUrls.map((url, index) => ({
          article_id: articleId,
          image_url: url,
          display_order: maxOrder + index
        }));
        const { error: insertError } = await supabase.from('article_images').insert(imageRecords);
        if (insertError) console.error('Error inserting new images:', insertError);
      }

      // 6. Migrate legacy image if needed
      if (legacyImage && remainingExisting.length === 0 && !imagesToDelete.includes(null)) {
        const { error: migrationError } = await supabase
          .from('article_images')
          .insert({ article_id: articleId, image_url: legacyImage.image_url, display_order: 0 });
        if (migrationError) console.error('Error migrating legacy image:', migrationError);
      }

      // 7. Delete attachments marked for removal
      if (attachmentsToDelete.length > 0) {
        const { error: deleteAttError } = await supabase
          .from('article_attachments')
          .delete()
          .in('id', attachmentsToDelete);
        if (deleteAttError) console.error('Error deleting attachments:', deleteAttError);
      }

      // 8. Upload new files
      let uploadedFiles = [];
      if (fileAssets.length > 0) {
        uploadedFiles = await uploadFilesEdit(fileAssets);
      }

      // 9. Insert new files
      if (uploadedFiles.length > 0) {
        const remainingAttachments = existingAttachments.filter(att => !attachmentsToDelete.includes(att.id));
        const maxAttOrder = remainingAttachments.length > 0
          ? Math.max(...remainingAttachments.map(att => att.display_order)) + 1
          : 0;
        const attachmentRecords = uploadedFiles.map((file, index) => ({
          article_id: articleId,
          file_url: file.url,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.mimeType,
          display_order: maxAttOrder + index
        }));
        const { error: insertAttError } = await supabase.from('article_attachments').insert(attachmentRecords);
        if (insertAttError) console.error('Error inserting new attachments:', insertAttError);
      }

      // 10. Update article
      const { error: updateError } = await supabase
        .from('articles')
        .update({
          title,
          content: htmlContent,
          type,
          image_url: coverImageUrl,
          preview_image_url: coverImageUrl,
          tags
        })
        .eq('id', articleId);

      if (updateError) {
        console.error('Error updating article:', updateError);
        Alert.alert('Fehler', 'Artikel konnte nicht aktualisiert werden.');
        return;
      }

      Alert.alert(
        'Erfolg',
        'Dein Artikel wurde erfolgreich aktualisiert!',
        [{
          text: 'OK',
          onPress: () => {
            navigation.navigate('HomeList');
            setTimeout(() => navigation.navigate('ArticleDetail', { articleId }), 100);
          }
        }]
      );
    } catch (err) {
      console.error('Unexpected error updating article:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // ─── Type buttons ───────────────────────────────────────────
  const renderTypeButtons = () => {
    if (isPersonal && !isEditMode) {
      return <Text style={styles.inputLabel}>{personalFilter}</Text>;
    }
    if (loadingTypes) {
      return <ActivityIndicator size="small" color="#4285F4" style={styles.loadingIndicator} />;
    }

    const displayTypes = [...availableArticleTypes];
    if (isEditMode && initialType) {
      const initialTypeIsSelectable = availableArticleTypes.some(t => t.name === initialType);
      if (!initialTypeIsSelectable) {
        displayTypes.unshift({ name: initialType, is_highlighted: false });
      }
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
          const isHighlighted = articleType.is_highlighted && !isSelected;
          const isDisabled = isEditMode && !availableArticleTypes.some(t => t.name === articleType.name) && articleType.name === initialType;

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
            <TouchableOpacity
              key={articleType.name}
              style={buttonStyle}
              onPress={() => setType(articleType.name)}
              disabled={isDisabled}
            >
              {isHighlighted ? (
                <LinearGradient
                  colors={['#f0f0f0', '#e0e0e0']}
                  style={styles.gradientWrapperType}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={textStyle}>{articleType.name}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.textWrapperType}>
                  <Text style={textStyle}>{articleType.name}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Loading / Error states (edit mode only) ────────────────
  if (isEditMode && (isLoading || loadingTypes)) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Artikel wird geladen...</Text>
      </SafeAreaView>
    );
  }

  if (isEditMode && error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButtonStyle} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonTextStyle}>Zurück</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── Computed values for edit mode images ───────────────────
  const displayExistingImages = existingImages.filter(img => !imagesToDelete.includes(img.id));
  const activeExistingCount = displayExistingImages.length;
  const maxNewImages = Math.max(0, 10 - activeExistingCount);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Artikel bearbeiten' : 'Neuer Artikel'}
        </Text>
        <View style={styles.headerRight}>
          {(isSubmitting || isUploading) ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : isEditMode ? (
            <TouchableOpacity style={styles.publishButton} onPress={handleUpdate}>
              <Text style={styles.publishButtonText}>Speichern</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.saveButton} onPress={() => handleCreateSubmit(true)}>
                <Text style={styles.saveButtonText}>Entwurf</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.publishButton} onPress={() => handleCreateSubmit(false)}>
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

          {/* Image Upload */}
          {isEditMode ? (
            <>
              <Text style={styles.inputLabel}>Bilder (Optional, max. 10)</Text>
              {(displayExistingImages.length > 0 || imageAssets.length > 0) && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagePreviewScroll}
                  contentContainerStyle={styles.imagePreviewScrollContent}
                >
                  {displayExistingImages.map((img, index) => (
                    <View key={`existing-${img.id || index}`} style={styles.imagePreviewItem}>
                      <Image source={{ uri: img.image_url }} style={styles.imagePreviewThumb} />
                      <TouchableOpacity onPress={() => removeExistingImage(img.id)} style={styles.removeImageButton}>
                        <Ionicons name="close-circle" size={24} color="#ff3b30" />
                      </TouchableOpacity>
                      {index === 0 && imageAssets.length === 0 && (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>Cover</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {imageAssets.map((asset, index) => (
                    <View key={`new-${index}`} style={styles.imagePreviewItem}>
                      <Image source={{ uri: asset.uri }} style={styles.imagePreviewThumb} />
                      <TouchableOpacity onPress={() => setImageAssets(prev => prev.filter((_, i) => i !== index))} style={styles.removeImageButton}>
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
                images={imageAssets}
                onImagesChange={setImageAssets}
                maxImages={maxNewImages}
                disabled={isUploading}
                label=""
                showCoverBadge={false}
              />
            </>
          ) : (
            <ImagePickerButton
              images={imageAssets}
              onImagesChange={setImageAssets}
              maxImages={10}
              disabled={isUploading}
            />
          )}

          {/* File Attachments */}
          <Text style={styles.inputLabel}>Dateianhänge (Optional)</Text>
          {/* Existing attachments (edit mode) */}
          {isEditMode && existingAttachments.filter(att => !attachmentsToDelete.includes(att.id)).length > 0 && (
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
          {/* New/all file assets */}
          {fileAssets.length > 0 && (
            <View style={styles.fileListContainer}>
              {fileAssets.map((file, index) => (
                <View key={index} style={[styles.fileItem, isEditMode && styles.newFileItem]}>
                  <Ionicons name={getFileIcon(file.mimeType)} size={24} color={isEditMode ? '#34C759' : '#4285F4'} />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <View style={styles.fileMetaRow}>
                      {file.size > 0 && <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>}
                      {isEditMode && <Text style={styles.newFileLabel}>Neu</Text>}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeFile(index)} style={styles.removeFileButton}>
                    <Ionicons name="close-circle" size={22} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.filePickerButton} onPress={pickFile} disabled={isUploading}>
            <Ionicons name="attach" size={20} color="#4285F4" style={{ marginRight: 10 }} />
            <Text style={styles.filePickerButtonText}>
              {(isEditMode
                ? (existingAttachments.filter(att => !attachmentsToDelete.includes(att.id)).length + fileAssets.length)
                : fileAssets.length) > 0
                ? 'Weitere Dateien hinzufügen'
                : 'Dateien anhängen'}
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
  backButtonStyle: { backgroundColor: '#eee', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
  backButtonTextStyle: { color: '#4285F4', fontWeight: 'bold', fontSize: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  saveButton: { paddingHorizontal: 10, paddingVertical: 6, marginRight: 10 },
  saveButtonText: { color: '#666', fontSize: 14 },
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
  titleInput: { backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 15 },
  editorContainer: { minHeight: 200, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  rich: { minHeight: 200 },
  htmlInput: { padding: 10, minHeight: 200 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleModeText: { color: '#4285F4', fontWeight: 'bold' },
  loadingIndicator: { marginVertical: 10 },
  noTypesText: { fontStyle: 'italic', color: '#6c757d', paddingVertical: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e7f0fe', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#4285F4', fontSize: 13, marginRight: 4 },
  tagRemoveIcon: { marginLeft: 2 },
  tagInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tagInput: { flex: 1, backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, fontSize: 14 },
  tagAddButton: { padding: 12, marginLeft: 8, backgroundColor: '#eef4ff', borderRadius: 8 },
  // Edit-mode image styles
  imagePreviewScroll: { marginTop: 10, marginBottom: 5 },
  imagePreviewScrollContent: { paddingRight: 10 },
  imagePreviewItem: { position: 'relative', marginRight: 10 },
  imagePreviewThumb: { width: 120, height: 90, borderRadius: 8 },
  removeImageButton: { position: 'absolute', top: -8, right: -8, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 12 },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#4285F4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coverBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  newBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#34C759', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  // File styles
  fileListContainer: { marginTop: 8, marginBottom: 8 },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, marginBottom: 8 },
  newFileItem: { backgroundColor: '#f0fff4', borderWidth: 1, borderColor: '#b7e4c7' },
  fileInfo: { flex: 1, marginLeft: 10 },
  fileName: { fontSize: 14, color: '#333', fontWeight: '500' },
  fileSize: { fontSize: 12, color: '#888', marginTop: 2 },
  fileMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  newFileLabel: { fontSize: 11, color: '#34C759', fontWeight: 'bold', marginLeft: 8 },
  removeFileButton: { padding: 4 },
  filePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f7ff', padding: 12, borderRadius: 8, justifyContent: 'center', marginTop: 5, borderWidth: 1, borderColor: '#d0e3ff', borderStyle: 'dashed' },
  filePickerButtonText: { color: '#4285F4', fontWeight: 'bold', fontSize: 16 },
});

export default ArticleFormScreen;