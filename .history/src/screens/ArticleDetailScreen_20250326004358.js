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
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const ArticleDetailScreen = ({ route, navigation }) => {
  const { articleId } = route.params;
  const { user } = useAuth();
  
  // State for article, comments, reactions, and loading states
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Available emoji options
  const emojiOptions = ['👍', '❤️', '😮', '👏', '🤔', '😢'];
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd.MM.yyyy', { locale: de });
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString;
    }
  };
  
  // Format time for comments
  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm', { locale: de });
    } catch (error) {
      console.error('Time formatting error:', error);
      return '';
    }
  };
  
  // Fetch article data
  useEffect(() => {
    fetchArticle();
  }, [articleId]);
  
  // Fetch comments when article loads
  useEffect(() => {
    if (article) {
      fetchComments();
      fetchReactions();
    }
  }, [article]);
  
  // Set up real-time subscription for new comments
  useEffect(() => {
    if (!articleId) return;
    
    // Subscribe to comment changes for this article
    const commentsSubscription = supabase
      .channel('article_comments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'article_comments',
        filter: `article_id=eq.${articleId}`
      }, () => {
        fetchComments();
      })
      .subscribe();
    
    // Subscribe to reaction changes for this article
    const reactionsSubscription = supabase
      .channel('article_reactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'article_reactions',
        filter: `article_id=eq.${articleId}`
      }, () => {
        fetchReactions();
      })
      .subscribe();
    
    // Clean up subscriptions on unmount
    return () => {
      commentsSubscription.unsubscribe();
      reactionsSubscription.unsubscribe();
    };
  }, [articleId]);
  
  const fetchArticle = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();
      
      if (error) {
        console.error('Error fetching article:', error);
        return;
      }
      
      setArticle({
        ...data,
        date: formatDate(data.published_at)
      });
    } catch (error) {
      console.error('Error in fetchArticle:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchComments = async () => {
    try {
      // Using the view that joins with user data
      const { data, error } = await supabase
        .from('article_comments_with_users')
        .select('*')
        .eq('article_id', articleId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }
      
      // Format comments for display
      const formattedComments = data.map(comment => ({
        id: comment.id,
        text: comment.text,
        user: comment.user_name || 'Anonymous',
        userId: comment.user_id,
        time: formatTime(comment.created_at)
      }));
      
      setComments(formattedComments);
    } catch (error) {
      console.error('Error in fetchComments:', error);
    }
  };
  
  const fetchReactions = async () => {
    try {
      setReactionsLoading(true);
      
      // Get all reactions with counts and user's reaction status
      const { data, error } = await supabase.rpc('get_article_reactions', {
        p_article_id: articleId
      });
      
      if (error) {
        console.error('Error fetching reactions:', error);
        return;
      }
      
      // Format reactions as an object for easier use
      const reactionObject = {};
      data.forEach(item => {
        reactionObject[item.emoji] = {
          count: item.count,
          userReacted: item.user_reacted
        };
      });
      
      setReactions(reactionObject);
    } catch (error) {
      console.error('Error in fetchReactions:', error);
    } finally {
      setReactionsLoading(false);
    }
  };
  
  const addComment = async () => {
    if (!user) {
      Alert.alert('Nicht angemeldet', 'Bitte melden Sie sich an, um einen Kommentar zu hinterlassen.');
      return;
    }
    
    if (comment.trim() === '') return;
    
    try {
      setCommentLoading(true);
      
      const { error } = await supabase
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
      
      // Clear comment field - comments will update via subscription
      setComment('');
    } catch (error) {
      console.error('Error in addComment:', error);
      Alert.alert('Fehler', 'Kommentar konnte nicht gespeichert werden.');
    } finally {
      setCommentLoading(false);
    }
  };
  
  const toggleReaction = async (emoji) => {
    if (!user) {
      Alert.alert('Nicht angemeldet', 'Bitte melden Sie sich an, um zu reagieren.');
      return;
    }
    
    try {
      setReactionsLoading(true);
      
      // Call the toggle function in the database
      const { error } = await supabase.rpc('toggle_article_reaction', {
        p_article_id: articleId,
        p_emoji: emoji
      });
      
      if (error) {
        console.error('Error toggling reaction:', error);
        Alert.alert('Fehler', 'Reaktion konnte nicht gespeichert werden.');
        return;
      }
      
      // Reactions will update via subscription
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error in toggleReaction:', error);
      Alert.alert('Fehler', 'Reaktion konnte nicht gespeichert werden.');
    } finally {
      setReactionsLoading(false);
    }
  };
  
  const renderReactions = () => {
    if (reactionsLoading) {
      return (
        <View style={styles.reactionsContainer}>
          <ActivityIndicator size="small" color="#4285F4" />
        </View>
      );
    }
    
    if (Object.keys(reactions).length === 0) {
      return (
        <View style={styles.reactionsContainer}>
          <Text style={styles.noReactionsText}>Noch keine Reaktionen</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactions).map(([emoji, data]) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBubble,
              data.userReacted && styles.reactionBubbleActive
            ]}
            onPress={() => toggleReaction(emoji)}
          >
            <Text>{emoji} {data.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderEmojiPicker = () => {
    if (!showEmojiPicker) return null;
    
    return (
      <View style={styles.emojiPickerContainer}>
        {emojiOptions.map(emoji => (
          <TouchableOpacity 
            key={emoji} 
            style={styles.emojiOption}
            onPress={() => toggleReaction(emoji)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderComment = ({ item }) => {
    const isMe = item.userId === (user?.id || '');
    
    return (
      <View style={[styles.commentItem, isMe && styles.myCommentItem]}>
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
      </SafeAreaView>
    );
  }
  
  if (!article) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Artikel konnte nicht geladen werden.</Text>
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
          
          {comments.length === 0 ? (
            <Text style={styles.noCommentsText}>Noch keine Kommentare</Text>
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
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
            editable={!!user}
          />
          {commentLoading ? (
            <View style={styles.sendButton}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                (comment.trim() === '' || !user) && styles.sendButtonDisabled
              ]} 
              onPress={addComment}
              disabled={comment.trim() === '' || !user}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={comment.trim() === '' || !user ? "#ccc" : "#fff"} 
              />
            </TouchableOpacity>
          )}
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
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#4285F4',
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
    minHeight: 30,
  },
  reactionBubble: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionBubbleActive: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  noReactionsText: {
    color: '#888',
    fontSize: 14,
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
  noCommentsText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
  },
  commentItem: {
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  myCommentItem: {
    backgroundColor: '#e3f2fd',
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