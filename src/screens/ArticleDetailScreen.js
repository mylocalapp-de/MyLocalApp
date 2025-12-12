import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Dimensions,
  Image,
  useWindowDimensions,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useNetwork } from '../context/NetworkContext';
import { loadOfflineData } from '../utils/storageUtils';
import { Menu, Provider } from 'react-native-paper';
import RenderHTML from 'react-native-render-html';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 3% of screen height for better scaling

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl;
  }
  return originalUrl.replace('/object/public/', '/render/image/public/') + '?width=800&quality=75'; // Use larger width for detail view
};

const ArticleDetailScreen = ({ route, navigation }) => {
  const { articleId } = route.params;
  const { user, displayName } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const { isOfflineMode, isConnected } = useNetwork();
  const { width } = useWindowDimensions();
  
  // State for article data
  const [article, setArticle] = useState(null);
  const [isFullArticleAvailable, setIsFullArticleAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authorName, setAuthorName] = useState('Redaktion');
  const [isAuthor, setIsAuthor] = useState(false);
  const [canEditDelete, setCanEditDelete] = useState(false);
  
  // State for multiple article images
  const [articleImages, setArticleImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageSliderRef = useRef(null);
  
  // State for file attachments
  const [articleAttachments, setArticleAttachments] = useState([]);
  
  // State for comments and reactions
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingReaction, setAddingReaction] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  
  // State for options menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Show and hide menu for Android
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);
  
  // Load article, comments, and reactions on component mount
  useEffect(() => {
    if (isOfflineMode) {
      loadArticleFromStorage();
    } else {
      fetchArticleData();
    }
  }, [articleId, isOfflineMode]);

  // Load article data from storage
  const loadArticleFromStorage = async () => {
    console.log(`[ArticleDetailScreen] Loading article ${articleId} from offline storage...`);
    setLoading(true);
    setError(null);
    setArticle(null);
    setIsFullArticleAvailable(false);
    setComments([]);
    setReactions({});

    try {
      const offlineArticlesList = await loadOfflineData('articles');

      if (offlineArticlesList) {
        const articleFromList = offlineArticlesList.find(item => item.id === articleId);

        if (articleFromList) {
          setArticle({ 
            ...articleFromList,
            content: articleFromList.content,
            date: articleFromList.date,
          });
          setAuthorName(articleFromList.author_name || 'Redaktion');
          setCanEditDelete(false);
          setIsFullArticleAvailable(false);
          console.log(`[ArticleDetailScreen] Found partial article ${articleId} in offline list.`);
        } else {
          setError('Artikel offline nicht gefunden.');
          console.log(`[ArticleDetailScreen] Article ${articleId} not found in offline list.`);
        }
      } else {
        setError('Offline-Daten nicht verfügbar. Bitte gehe online und speichere Daten.');
        console.log('[ArticleDetailScreen] Offline articles list not found.');
      }
    } catch (err) {
      console.error('[ArticleDetailScreen] Error loading article from storage:', err);
      setError('Fehler beim Laden des Offline-Artikels.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch the full article data from Supabase
  const fetchArticleData = async () => {
    if (isOfflineMode) return;

    try {
      setLoading(true);
      setError(null);
      
      // Fetch the article with author info
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select(`
          *,
          profiles:author_id (
            display_name
          ),
          organizations:organization_id (
            name
          )
        `)
        .eq('id', articleId)
        .single();
      
      if (articleError) {
        console.error('Error fetching article:', articleError);
        setError('Could not load article. Please try again later.');
        return;
      }
      
      if (!articleData) {
        setError('Article not found.');
        return;
      }
      
      // Format the date
      const publishDate = new Date(articleData.published_at);
      const formattedDate = `${publishDate.getDate().toString().padStart(2, '0')}.${(publishDate.getMonth() + 1).toString().padStart(2, '0')}.${publishDate.getFullYear()}`;
      
      // Set the article with formatted date
      setArticle({
        ...articleData,
        date: formattedDate
      });
      
      // Set author name (prioritize organization name)
      if (articleData.organizations && articleData.organizations.name) {
        setAuthorName(articleData.organizations.name);
      } else if (articleData.profiles && articleData.profiles.display_name) {
        setAuthorName(articleData.profiles.display_name);
      } else {
        setAuthorName('Redaktion'); // Default fallback
      }
      
      // Determine if the current user can edit/delete this article
      await checkEditDeletePermission(articleData);
      
      // Fetch article images from article_images table
      await fetchArticleImages(articleId, articleData.image_url);
      
      // Fetch article attachments
      await fetchArticleAttachments(articleId);
      
      // Fetch comments
      fetchComments();
      
      // Fetch reactions
      fetchReactions();
      
    } catch (err) {
      console.error('Unexpected error fetching article:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to check if the current user can edit/delete
  const checkEditDeletePermission = async (articleData) => {
    if (isOfflineMode || !user) {
        setCanEditDelete(false);
        return;
    }

    // Case 1: Personal article (no organization)
    if (!articleData.organization_id) {
        // Can only edit personal article if NOT in an org context
        setCanEditDelete(articleData.author_id === user.id && !activeOrganizationId);
        return;
    }

    // Case 2: Organizational article
    if (articleData.organization_id) {
        // Can only edit org article if user is member AND currently in that org's context
        if (activeOrganizationId !== articleData.organization_id) {
             setCanEditDelete(false); // Not in the correct org context
             return;
        }
        // User is in the correct org context, now check membership
        try {
            const { data: membership, error } = await supabase
                .from('organization_members')
                .select('user_id') // Just need to check if a row exists
                .eq('organization_id', articleData.organization_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error("Error checking org membership:", error);
                setCanEditDelete(false);
            } else {
                setCanEditDelete(!!membership); // User is a member if a row is found
            }
        } catch (e) {
            console.error("Unexpected error checking membership:", e);
            setCanEditDelete(false);
        }
    }
  };

  // Fetch article images from article_images table
  const fetchArticleImages = async (artId, legacyImageUrl) => {
    try {
      const { data: imagesData, error: imagesError } = await supabase
        .from('article_images')
        .select('id, image_url, display_order')
        .eq('article_id', artId)
        .order('display_order', { ascending: true });

      if (imagesError) {
        console.error('Error fetching article images:', imagesError);
        // Fallback to legacy image
        if (legacyImageUrl) {
          setArticleImages([legacyImageUrl]);
        }
        return;
      }

      if (imagesData && imagesData.length > 0) {
        setArticleImages(imagesData.map(img => img.image_url));
      } else if (legacyImageUrl) {
        // No images in new table, use legacy image_url
        setArticleImages([legacyImageUrl]);
      } else {
        setArticleImages([]);
      }
    } catch (err) {
      console.error('Error fetching article images:', err);
      if (legacyImageUrl) {
        setArticleImages([legacyImageUrl]);
      }
    }
  };

  // Fetch article attachments from article_attachments table
  const fetchArticleAttachments = async (artId) => {
    try {
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('article_attachments')
        .select('id, file_url, file_name, file_size, mime_type, display_order')
        .eq('article_id', artId)
        .order('display_order', { ascending: true });

      if (attachmentsError) {
        console.error('Error fetching article attachments:', attachmentsError);
        setArticleAttachments([]);
        return;
      }

      setArticleAttachments(attachmentsData || []);
    } catch (err) {
      console.error('Error fetching article attachments:', err);
      setArticleAttachments([]);
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

  // Handle file download
  const handleDownloadFile = (fileUrl) => {
    Linking.openURL(fileUrl);
  };

  // Handle scroll event for image slider pagination
  const handleImageScroll = useCallback((event) => {
    const slideWidth = width - 30; // Account for padding
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideWidth);
    setCurrentImageIndex(index);
  }, [width]);
  
  // Fetch comments for the article
  const fetchComments = async () => {
    if (isOfflineMode) return;

    try {
      setLoadingComments(true);
      
      // Updated query to explicitly join profiles and select display_name
      const { data, error } = await supabase
        .from('article_comments') // Query the base table directly
        .select(`
          *,
          profiles:user_id (
            display_name
          )
        `) // Explicitly select display_name from joined profiles table
        .eq('article_id', articleId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }
      
      setComments(data || []);
    } catch (err) {
      console.error('Unexpected error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };
  
  // Fetch reaction counts for the article
  const fetchReactions = async () => {
    if (isOfflineMode) return;

    try {
      const { data, error } = await supabase
        .rpc('get_article_reactions', { article_uuid: articleId });
      
      if (error) {
        console.error('Error fetching reactions:', error);
        return;
      }
      
      setReactions(data || {});
    } catch (err) {
      console.error('Unexpected error fetching reactions:', err);
    }
  };
  
  // Add a comment
  const addComment = async () => {
    if (isOfflineMode) {
        Alert.alert("Offline", "Kommentare sind offline nicht verfügbar.");
        return;
    }
    
    if (!comment.trim()) return;
    
    if (!user) {
      Alert.alert(
        'Permanenten Account erstellen',
        'Bitte erstelle einen permanenten Account, um einen Kommentar zu hinterlassen.',
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Zum Profil', 
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      return;
    }
    
    try {
      setAddingComment(true);
      
      const { data, error } = await supabase
        .from('article_comments')
        .insert({
          article_id: articleId,
          user_id: user.id,
          text: comment
        });
      
      if (error) {
        console.error('Error adding comment:', error);
        Alert.alert('Fehler', 'Kommentar konnte nicht gespeichert werden.');
        return;
      }
      
      // Refresh comments
      fetchComments();
      
      // Clear comment input
      setComment('');
    } catch (err) {
      console.error('Unexpected error adding comment:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setAddingComment(false);
    }
  };
  
  // Add a reaction
  const addReaction = async (emoji) => {
    if (isOfflineMode) {
        Alert.alert("Offline", "Reaktionen sind offline nicht verfügbar.");
        return;
    }
    
    if (!user) {
      Alert.alert(
        'Permanenten Account erstellen',
        'Bitte erstelle einen permanenten Account, um zu reagieren.',
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Zum Profil', 
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      setShowEmojiPicker(false);
      return;
    }
    
    try {
      setAddingReaction(true);
      
      // First check if user already reacted with this emoji
      const { data: existingReaction, error: checkError } = await supabase
        .from('article_reactions')
        .select('id')
        .eq('article_id', articleId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking reaction:', checkError);
        return;
      }
      
      if (existingReaction) {
        // User already reacted with this emoji, so remove the reaction
        const { error: deleteError } = await supabase
          .from('article_reactions')
          .delete()
          .eq('id', existingReaction.id);
          
        if (deleteError) {
          console.error('Error removing reaction:', deleteError);
          return;
        }
      } else {
        // Add new reaction
        const { error: insertError } = await supabase
          .from('article_reactions')
          .insert({
            article_id: articleId,
            user_id: user.id,
            emoji: emoji
          });
          
        if (insertError) {
          console.error('Error adding reaction:', insertError);
          return;
        }
      }
      
      // Refresh reactions
      fetchReactions();
      
      // Hide emoji picker
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Unexpected error with reaction:', err);
    } finally {
      setAddingReaction(false);
    }
  };
  
  // Handle article deletion
  const handleDeleteArticle = async () => {
    if (isOfflineMode) {
        Alert.alert("Offline", "Löschen ist offline nicht verfügbar.");
        return;
    }
    
    if (!canEditDelete) {
      Alert.alert('Fehler', 'Du bist nicht berechtigt, diesen Artikel zu löschen.');
      return;
    }
    
    Alert.alert(
      'Artikel löschen',
      'Möchtest du diesen Artikel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Löschen', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              // Use RPC to bypass RLS policies
              const { data, error } = await supabase
                .rpc('delete_article', {
                  p_article_id: articleId,
                  p_author_id: user.id
                });
              
              if (error) {
                console.error('Error deleting article with RPC:', error);
                
                // Fallback to direct delete if RPC fails
                const { error: directError } = await supabase
                  .from('articles')
                  .delete()
                  .eq('id', articleId)
                  .eq('author_id', user.id);
                
                if (directError) {
                  console.error('Error with direct delete:', directError);
                  Alert.alert('Fehler', 'Artikel konnte nicht gelöscht werden.');
                  return;
                }
              }
              
              Alert.alert(
                'Erfolg',
                'Dein Artikel wurde erfolgreich gelöscht.',
                [{ text: 'OK', onPress: () => navigation.navigate('HomeList') }]
              );
            } catch (err) {
              console.error('Unexpected error deleting article:', err);
              Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
            } finally {
              setIsDeleting(false);
              closeMenu();
            }
          }
        }
      ]
    );
  };
  
  // Handle article editing
  const handleEditArticle = () => {
    if (isOfflineMode) {
        Alert.alert("Offline", "Bearbeiten ist offline nicht verfügbar.");
        return;
    }
    
    if (!canEditDelete) {
      Alert.alert('Fehler', 'Du bist nicht berechtigt, diesen Artikel zu bearbeiten.');
      return;
    }
    
    navigation.navigate('EditArticle', { articleId });
    closeMenu();
  };
  
  const emojiOptions = ['👍', '❤️', '😮', '👏', '🤔', '😢'];
  
  const renderReactions = () => {
    if (!reactions || Object.keys(reactions).length === 0) {
      return null;
    }
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactions).map(([emoji, count]) => (
          <TouchableOpacity 
            key={emoji} 
            style={styles.reactionBubble}
            onPress={() => addReaction(emoji)}
          >
            <Text>{emoji} {count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderEmojiPicker = () => {
    if (!showEmojiPicker) return null;
    
    return (
      <View style={styles.emojiPickerContainer}>
        {addingReaction ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          emojiOptions.map(emoji => (
            <TouchableOpacity 
              key={emoji} 
              style={styles.emojiOption}
              onPress={() => addReaction(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };
  
  const renderComment = ({ item }) => {
    // Format the timestamp
    const commentDate = new Date(item.created_at);
    const formattedTime = `${commentDate.getHours().toString().padStart(2, '0')}:${commentDate.getMinutes().toString().padStart(2, '0')}`;
    const formattedDate = `${commentDate.getDate().toString().padStart(2, '0')}.${(commentDate.getMonth() + 1).toString().padStart(2, '0')}.${commentDate.getFullYear()}`;

    // Get user display name from the nested profiles object
    const userName = item.profiles?.display_name || 'Unbekannt';

    return (
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfileView', { userId: item.user_id })}
            disabled={isOfflineMode}
          >
            <Text style={styles.commentUser}>{userName}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTime}>{`${formattedDate} ${formattedTime}`}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    );
  };
  
  // Show options menu based on platform
  const showOptions = () => {
    if (Platform.OS === 'ios') {
      // Use ActionSheet on iOS
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Abbrechen', 'Artikel bearbeiten', 'Artikel löschen'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
          userInterfaceStyle: 'light'
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditArticle();
          } else if (buttonIndex === 2) {
            handleDeleteArticle();
          }
        }
      );
    } else {
      // Show Android menu
      openMenu();
    }
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Artikel wird geladen...</Text>
      </SafeAreaView>
    );
  }
  
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
    <Provider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#4285F4" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerType}>{article?.type || 'Artikel'}</Text>
          </View>
          {canEditDelete && !isOfflineMode && (
            <Menu
              visible={menuVisible}
              onDismiss={closeMenu}
              anchor={
                <TouchableOpacity 
                  style={styles.optionsButton}
                  onPress={showOptions}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                </TouchableOpacity>
              }
            >
              <Menu.Item 
                onPress={() => {
                  closeMenu();
                  handleEditArticle();
                }}
                icon="pencil"
                title="Artikel bearbeiten"
              />
              <Menu.Item 
                onPress={() => {
                  closeMenu();
                  handleDeleteArticle();
                }}
                icon="delete"
                title="Artikel löschen"
                titleStyle={{ color: '#ff3b30' }}
              />
            </Menu>
          )}
        </View>
        
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{article?.title || 'Titel wird geladen...'}</Text>
          
          {/* Display article images with slider */}
          {articleImages.length > 0 && (
            <View style={styles.imageSliderContainer}>
              <ScrollView
                ref={imageSliderRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                decelerationRate="fast"
                snapToInterval={width - 30}
                snapToAlignment="center"
                contentContainerStyle={styles.imageSliderContent}
              >
                {articleImages.map((imageUrl, index) => (
                  <Image
                    key={index}
                    source={{ uri: getTransformedImageUrl(imageUrl) }}
                    style={[styles.articleImage, { width: width - 30 }]}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {articleImages.length > 1 && (
                <View style={styles.paginationContainer}>
                  {articleImages.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentImageIndex && styles.paginationDotActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
          
          <View style={styles.articleMeta}>
            <Text style={styles.date}>{article?.date || '...'}</Text>
            <TouchableOpacity 
              disabled={isOfflineMode || (!article?.organization_id && !article?.author_id)} 
              onPress={() => {
                  if (article?.organization_id) {
                     navigation.navigate('OrganizationProfileView', { organizationId: article.organization_id });
                  }
                  else if (!article?.is_organization_post && article?.author_id) {
                     navigation.navigate('UserProfileView', { userId: article.author_id });
                  }
              }}
            >
              <Text 
                style={
                  article?.organization_id 
                    ? styles.organizationAuthor 
                    : (authorName === 'Redaktion' ? styles.redaktionAuthor : styles.author)
                }
              >
                {authorName}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Conditionally render HTML content or offline message */}
          {isFullArticleAvailable ? (
             <RenderHTML
                contentWidth={width - 30}
                source={{ html: article?.content || '' }}
                tagsStyles={htmlStyles}
                renderersProps={{
                  a: {
                    onPress: (_evt, href) => {
                      if (!href) return;
                      if (href.startsWith('meinhavelaue://')) {
                        // Deep-link pattern: meinhavelaue://events/<uuid>
                        const parts = href.split('/');
                        const eventId = parts[parts.length - 1];
                        navigation.navigate('EventDetail', { eventId });
                      } else {
                        Linking.openURL(href);
                      }
                    }
                  }
                }}
             />
          ) : (
              <View style={styles.offlineContentWarning}>
                  <Ionicons name="cloud-offline-outline" size={24} color="#ff9800" />
                  <Text style={styles.offlineContentText}>
                      Vollständiger Artikelinhalt ist im Offline-Modus nicht verfügbar.
                  </Text>
              </View>
          )}

          {/* File Attachments Section */}
          {articleAttachments.length > 0 && (
            <View style={styles.attachmentsSection}>
              <Text style={styles.attachmentsHeader}>
                <Ionicons name="attach" size={16} color="#333" /> Anhänge ({articleAttachments.length})
              </Text>
              {articleAttachments.map((attachment) => (
                <TouchableOpacity
                  key={attachment.id}
                  style={styles.attachmentItem}
                  onPress={() => handleDownloadFile(attachment.file_url)}
                >
                  <Ionicons name={getFileIcon(attachment.mime_type)} size={24} color="#4285F4" />
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentName} numberOfLines={1}>{attachment.file_name}</Text>
                    {attachment.file_size > 0 && (
                      <Text style={styles.attachmentSize}>{formatFileSize(attachment.file_size)}</Text>
                    )}
                  </View>
                  <View style={styles.downloadButton}>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          <View style={styles.divider} />
          
          {/* Conditionally render interactions section */}
          {!isOfflineMode && (
              <>
                  {renderReactions()}
                  <View style={styles.actionBar}>
                      <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                          <Ionicons name="happy-outline" size={20} color="#4285F4" />
                          <Text style={styles.actionText}>Reaktion</Text>
                      </TouchableOpacity>
                      {renderEmojiPicker()}
                  </View>
                  <View style={styles.commentsSection}>
                      <Text style={styles.commentsHeader}>Kommentare ({comments.length})</Text>
                      {loadingComments ? (
                          <ActivityIndicator size="small" color="#4285F4" style={styles.commentsLoading} />
                      ) : (
                          <FlatList
                              data={comments}
                              renderItem={renderComment}
                              keyExtractor={item => item.id.toString()}
                              scrollEnabled={false}
                              ListEmptyComponent={
                                  <Text style={styles.emptyCommentsText}>
                                      Noch keine Kommentare. Sei der Erste, der einen Kommentar hinterlässt!
                                  </Text>
                              }
                          />
                      )}
                  </View>
              </>
          )}
        </ScrollView>
        
        {/* Conditionally render comment input */}
        {!isOfflineMode && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 90}
            style={styles.inputContainer}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Schreibe einen Kommentar..."
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (comment.trim() === '' || addingComment) && styles.sendButtonDisabled
                ]}
                onPress={addComment}
                disabled={comment.trim() === '' || addingComment}
              >
                {addingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color={comment.trim() === '' ? "#ccc" : "#fff"} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
        
        {isDeleting && (
          <View style={styles.deleteOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.deleteText}>Artikel wird gelöscht...</Text>
          </View>
        )}
      </SafeAreaView>
    </Provider>
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
    padding: 15,
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    flex: 1,
  },
  headerType: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: 'bold',
  },
  optionsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  date: {
    fontSize: 12,
    color: '#888',
  },
  author: {
    fontSize: 12,
    color: '#4285F4',
    fontWeight: 'bold',
  },
  redaktionAuthor: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  organizationAuthor: {
    fontSize: 12,
    color: '#208e5d',
    fontWeight: 'bold',
  },
  articleContent: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  reactionBubble: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  actionText: {
    fontSize: 14,
    color: '#4285F4',
    marginLeft: 5,
  },
  emojiPickerContainer: {
    position: 'absolute',
    top: -50,
    left: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  emojiOption: {
    padding: 8,
    marginHorizontal: 5,
  },
  emojiText: {
    fontSize: 20,
  },
  commentsSection: {
    marginTop: 10,
  },
  commentsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
  },
  commentsLoading: {
    marginTop: 20,
  },
  emptyCommentsText: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  commentItem: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  commentUser: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 13,
  },
  commentTime: {
    fontSize: 11,
    color: '#888',
  },
  commentText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  inputContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f1f1f1',
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
  androidMenu: {
    backgroundColor: '#fff',
    elevation: 4,
    borderRadius: 4,
  },
  imageSliderContainer: {
    marginVertical: 10,
  },
  imageSliderContent: {
    alignItems: 'center',
  },
  articleImage: {
    height: 220,
    borderRadius: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#4285F4',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  offlineContentWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  offlineContentText: {
    marginLeft: 10,
    color: '#e65100',
    fontSize: 14,
    flex: 1,
  },
  attachmentsSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  attachmentsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  attachmentName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  attachmentSize: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  downloadButton: {
    backgroundColor: '#4285F4',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Optional: Define custom styles for HTML tags
const htmlStyles = {
  p: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 10,
  },
  a: {
    color: '#4285F4',
    textDecorationLine: 'underline',
  },
  b: { 
      fontWeight: 'bold' 
  },
  strong: { 
      fontWeight: 'bold' 
  },
  i: {
      fontStyle: 'italic'
  },
  em: {
      fontStyle: 'italic'
  }
};

export default ArticleDetailScreen; 