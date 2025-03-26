import React, { useState } from 'react';
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
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ArticleDetailScreen = ({ route, navigation }) => {
  const { article } = route.params;
  
  // Sample extended content
  const fullContent = article.content + "\n\n" + 
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, " +
    "nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, " +
    "nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, " +
    "nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.\n\n" +
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud " +
    "exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit " +
    "in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n\n" +
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
  
  // State for comments and reactions
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([
    { id: 1, text: 'Das ist sehr interessant!', user: 'Max M.', time: '14:30' },
    { id: 2, text: 'Danke für die Information.', user: 'Lisa W.', time: '15:45' }
  ]);
  const [reactions, setReactions] = useState({
    '👍': 12,
    '❤️': 5,
    '😮': 3,
    '🤔': 2
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const addComment = () => {
    if (comment.trim() === '') return;
    
    const newComment = {
      id: Date.now(),
      text: comment,
      user: 'Me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setComments([...comments, newComment]);
    setComment('');
  };
  
  const addReaction = (emoji) => {
    setReactions({
      ...reactions,
      [emoji]: (reactions[emoji] || 0) + 1
    });
    setShowEmojiPicker(false);
  };
  
  const emojiOptions = ['👍', '❤️', '😮', '👏', '🤔', '😢'];
  
  const renderReactions = () => {
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactions).map(([emoji, count]) => (
          <View key={emoji} style={styles.reactionBubble}>
            <Text>{emoji} {count}</Text>
          </View>
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
            onPress={() => addReaction(emoji)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderComment = ({ item }) => {
    const isMe = item.user === 'Me';
    
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
        
        <Text style={styles.articleContent}>{fullContent}</Text>
        
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
          
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
          />
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
            style={[styles.sendButton, comment.trim() === '' && styles.sendButtonDisabled]} 
            onPress={addComment}
            disabled={comment.trim() === ''}
          >
            <Ionicons name="send" size={20} color={comment.trim() === '' ? "#ccc" : "#fff"} />
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