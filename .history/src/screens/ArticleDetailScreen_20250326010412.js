import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ArticleDetailScreen = ({ route, navigation }) => {
  const { articleId } = route.params;
  const { user, displayName } = useAuth();
  
  // State for article data
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for comments and reactions
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingReaction, setAddingReaction] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  
  // Load article, comments, and reactions on component mount
  useEffect(() => {
    fetchArticleData();
  }, [articleId]);

  // Fetch the full article data from Supabase
  const fetchArticleData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the article
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('*')
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
  
  // Fetch comments for the article
  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      
      const { data, error } = await supabase
        .from('article_comments_with_users')
        .select('*')
        .eq('article_id', articleId)
        .order('created_at', { ascending: true });
      
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
    return (
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{item.user}</Text>
          <Text style={styles.commentTime}>{item.time}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    );
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#4285F4" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerType}>{article.type}</Text>
        </View>
      </View>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.date}>{article.date}</Text>
        
        <Text style={styles.articleContent}>{article.content}</Text>
        
        <View style={styles.divider} />
        
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
      </ScrollView>
      
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
    padding: 15,
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
  date: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
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
    marginVertical: 20,
  },
  emptyCommentsText: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  commentItem: {
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444',
  },
  commentTime: {
    fontSize: 12,
    color: '#888',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
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
});

export default ArticleDetailScreen; 