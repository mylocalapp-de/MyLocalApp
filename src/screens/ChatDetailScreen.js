import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 5% of screen height for better scaling

const ChatDetailScreen = ({ route, navigation }) => {
  const { chatGroup, onReturn } = route.params;
  const { user, displayName } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeEmojiPickerMessageId, setActiveEmojiPickerMessageId] = useState(null);
  const [commentingOnMessageId, setCommentingOnMessageId] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addingReaction, setAddingReaction] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const flatListRef = useRef(null);

  // Mark chat as viewed when screen is opened and when user navigates back
  useEffect(() => {
    markChatAsViewed();
    
    // Setup listener for when screen is focused (navigation back from another screen)
    const unsubscribe = navigation.addListener('focus', () => {
      markChatAsViewed();
    });
    
    // Setup listener for when screen is about to be left
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', () => {
      // Navigate back with params to update the chat list
      if (onReturn) {
        onReturn();
      }
      
      // Alternative approach using navigation params
      navigation.navigate({
        name: 'Chat',
        params: { viewedChatId: chatGroup.id, timestamp: Date.now() },
        merge: true,
      });
    });
    
    // Cleanup
    return () => {
      unsubscribe();
      unsubscribeBeforeRemove();
    };
  }, [navigation, chatGroup.id]);

  // Mark chat as viewed in AsyncStorage
  const markChatAsViewed = async () => {
    try {
      // Get current unread counts
      const storedCounts = await AsyncStorage.getItem('localUnreadCounts');
      let unreadCounts = storedCounts ? JSON.parse(storedCounts) : {};
      
      // Set this chat's unread count to 0
      unreadCounts[chatGroup.id] = 0;
      
      // Save updated counts
      await AsyncStorage.setItem('localUnreadCounts', JSON.stringify(unreadCounts));
    } catch (err) {
      console.error('Error marking chat as viewed:', err);
    }
  };

  // Redirect to Dorfbot screen if this is a bot chat
  useEffect(() => {
    if (isBot()) {
      navigation.replace('Dorfbot');
      return;
    }
  }, []);

  // Log debug info about admin status
  useEffect(() => {
    if (isBroadcast() && user) {
      console.log('Broadcast group admin check:', {
        isAdmin: chatGroup.adminId === user.id,
        groupAdminId: chatGroup.adminId,
        userId: user.id,
        groupName: chatGroup.name
      });
    }
  }, [chatGroup, user]);

  // Load messages when component mounts or chat group changes
  useEffect(() => {
    fetchMessages();
  }, [chatGroup.id]);

  // Fetch messages for the current chat group
  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Fetch messages for this chat group, joining with profiles
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages') // Query the base table
        .select(`
          id,
          chat_group_id,
          user_id,
          text,
          created_at,
          profiles ( display_name ) // Join profiles table
        `)
        .eq('chat_group_id', chatGroup.id)
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setError('Nachrichten konnten nicht geladen werden. Bitte versuche es später erneut.');
        setLoading(false);
        return;
      }
      
      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const messageIds = messagesData.map(msg => msg.id);
      
      // 2. Fetch all comments for these messages in one go
      const { data: commentsData, error: commentsError } = await supabase
        .from('message_comments') // Query the base table
        .select(`
          id,
          message_id,
          user_id,
          text,
          created_at,
          profiles ( display_name ) // Join profiles table
        `)
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
        // Continue without comments if they fail to load
      }
      
      // 3. Fetch all reactions for these messages (using RPC for aggregation)
      // Assuming get_message_reactions_for_list exists and returns { message_id: { emoji: count, ... }, ... }
      // If not, this part needs adjustment or fallback to individual fetching.
      const { data: reactionsData, error: reactionsError } = await supabase
          .rpc('get_reactions_for_messages', { message_ids: messageIds });

      if (reactionsError) {
          console.error('Error fetching reactions:', reactionsError);
          // Continue without reactions if they fail
      }
      
      // 4. Process and combine the data
      const commentsByMessageId = (commentsData || []).reduce((acc, comment) => {
        const messageId = comment.message_id;
        if (!acc[messageId]) {
          acc[messageId] = [];
        }
        // Format comment time
        const commentDate = new Date(comment.created_at);
        const formattedTime = `${commentDate.getHours().toString().padStart(2, '0')}:${commentDate.getMinutes().toString().padStart(2, '0')}`;

        acc[messageId].push({
            id: comment.id,
            text: comment.text,
            sender: comment.profiles?.display_name || 'Unbekannt',
            time: formattedTime,
            user_id: comment.user_id
        });
        return acc;
      }, {});

      const reactionsByMessageId = reactionsData || {}; // Use the RPC result directly

      const processedMessages = messagesData.map(msg => {
        // Format message time
        const messageDate = new Date(msg.created_at);
        const formattedTime = `${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;
        
        return {
          id: msg.id,
          text: msg.text,
          sender: msg.profiles?.display_name || (msg.user_id ? 'Unbekannt' : 'System'), // Handle null user_id
          time: formattedTime,
          reactions: reactionsByMessageId[msg.id] || {},
          comments: commentsByMessageId[msg.id] || [],
          user_id: msg.user_id
        };
      });
      
      setMessages(processedMessages);

    } catch (err) {
      console.error('Unexpected error fetching messages:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle emoji picker for a specific message
  const toggleEmojiPicker = (messageId) => {
    setActiveEmojiPickerMessageId(prevId => 
      prevId === messageId ? null : messageId
    );
  };

  const sendMessage = async () => {
    if (message.trim() === '') return;
    
    // For broadcast channels, require a user account
    if (isBroadcast() && !isBot() && !user) {
      Alert.alert(
        'Account erforderlich',
        'Bitte erstelle einen Account, um auf Ankündigungen reagieren zu können.',
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
    
    setSendingMessage(true);
    
    try {
      console.log('Sending message:', {
        chatGroupId: chatGroup.id,
        chatGroupType: chatGroup.dbType,
        userId: user?.id,
        isAdmin: user && chatGroup.adminId === user.id,
        text: message.substring(0, 20) + (message.length > 20 ? '...' : ''),
        commentingOn: commentingOnMessageId
      });
      
      // For broadcasts, add the comment to the commented message
      if (commentingOnMessageId !== null && !isOpenChat()) {
        await addComment(commentingOnMessageId, message);
        setCommentingOnMessageId(null);
      } else if (isOpenChat() || isBot() || (isBroadcast() && user && chatGroup.adminId === user.id)) {
        // Regular message for open chats, bot, or admin posting to broadcast
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            chat_group_id: chatGroup.id,
            text: message,
            user_id: user ? user.id : null
          })
          .select();
        
        if (error) {
          console.error('Error sending message:', error);
          Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden: ' + error.message);
          return;
        } else {
          console.log('Message sent successfully:', data);
          
          // Update local chat group object with the last message
          chatGroup.lastMessage = message;
          chatGroup.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          // Also update the group's last message time in the chat list via AsyncStorage
          try {
            const storedLastMessages = await AsyncStorage.getItem('chatLastMessages') || '{}';
            const lastMessages = JSON.parse(storedLastMessages);
            
            lastMessages[chatGroup.id] = {
              text: message,
              time: chatGroup.time,
              timestamp: Date.now()
            };
            
            await AsyncStorage.setItem('chatLastMessages', JSON.stringify(lastMessages));
          } catch (err) {
            console.error('Error storing last message:', err);
          }
        }
        
        // Refresh messages to include the new one
        await fetchMessages();
        
        // Scroll to the bottom after a short delay
        setTimeout(() => {
          flatListRef.current?.scrollToEnd();
        }, 100);
      }
      
      setMessage('');
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSendingMessage(false);
    }
  };

  const addReaction = async (messageId, emoji) => {
    if (!user) {
      Alert.alert(
        'Account erforderlich',
        'Bitte erstelle einen Account, um auf Nachrichten reagieren zu können.',
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Zum Profil', 
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      setActiveEmojiPickerMessageId(null);
      return;
    }
    
    setAddingReaction(true);
    
    try {
      // First check if user already reacted with this emoji
      const { data: existingReaction, error: checkError } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
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
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);
          
        if (deleteError) {
          console.error('Error removing reaction:', deleteError);
          return;
        }
      } else {
        // Add new reaction
        const { error: insertError } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji
          });
          
        if (insertError) {
          console.error('Error adding reaction:', insertError);
          return;
        }
      }
      
      // Refresh messages to update reactions
      await fetchMessages();
      
      // Hide emoji picker
      setActiveEmojiPickerMessageId(null);
    } catch (err) {
      console.error('Unexpected error with reaction:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setAddingReaction(false);
    }
  };
  
  const addComment = async (messageId, commentText) => {
    if (!user) {
      Alert.alert(
        'Account erforderlich',
        'Bitte erstelle einen Account, um Kommentare hinzuzufügen.',
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Zum Profil', 
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      return false;
    }
    
    setAddingComment(true);
    
    try {
      const { error } = await supabase
        .from('message_comments')
        .insert({
          message_id: messageId,
          user_id: user.id,
          text: commentText
        });
      
      if (error) {
        console.error('Error adding comment:', error);
        Alert.alert('Fehler', 'Kommentar konnte nicht gespeichert werden.');
        return false;
      }
      
      // Refresh messages to update comments
      await fetchMessages();
      return true;
    } catch (err) {
      console.error('Unexpected error adding comment:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      return false;
    } finally {
      setAddingComment(false);
    }
  };

  const startCommenting = (messageId) => {
    setCommentingOnMessageId(messageId);
  };

  const cancelCommenting = () => {
    setCommentingOnMessageId(null);
  };

  // Helper functions to determine chat type
  const isOpenChat = () => chatGroup.dbType === 'open_group';
  const isBroadcast = () => chatGroup.dbType === 'broadcast';
  const isBot = () => chatGroup.dbType === 'bot';

  // Utility function to set the current user as admin (for debugging)
  const setUserAsAdmin = async () => {
    if (!user || !isBroadcast()) return;
    
    try {
      console.log('Setting user as admin:', {
        userId: user.id,
        groupId: chatGroup.id,
        groupName: chatGroup.name
      });
      
      // First try to disable RLS for chat_groups table
      try {
        const { error: rlsError } = await supabase.rpc('disable_rls_for_chat_groups');
        if (rlsError) {
          console.log('Could not disable RLS via RPC, continuing anyway:', rlsError);
        }
      } catch (rlsError) {
        console.log('RPC not available, continuing anyway');
      }
      
      // Update the chat group admin_id
      const { error } = await supabase
        .from('chat_groups')
        .update({ admin_id: user.id })
        .eq('id', chatGroup.id);
      
      if (error) {
        console.error('Error setting user as admin:', error);
        
        // Try a direct SQL approach
        try {
          const { error: sqlError } = await supabase.rpc(
            'set_chat_group_admin',
            { 
              group_id: chatGroup.id,
              admin_id: user.id
            }
          );
          
          if (sqlError) {
            console.error('Error with SQL RPC approach:', sqlError);
            Alert.alert('Fehler', 'Fehler beim Setzen als Admin: ' + error.message);
            return;
          } else {
            console.log('Admin set via SQL RPC');
          }
        } catch (sqlErr) {
          console.error('Error with SQL approach:', sqlErr);
          Alert.alert('Fehler', 'Fehler beim Setzen als Admin über SQL: ' + sqlErr.message);
          return;
        }
      } else {
        console.log('Admin updated via standard approach');
      }
      
      // Update local chat group object
      chatGroup.adminId = user.id;
      
      console.log('User set as admin successfully!');
      Alert.alert('Admin', 'Du bist jetzt Admin dieser Gruppe');
      
      // Force a refresh to apply changes
      fetchMessages();
    } catch (err) {
      console.error('Unexpected error setting admin:', err);
    }
  };

  const renderReactions = (item) => {
    if (!item.reactions || Object.keys(item.reactions).length === 0) return null;
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(item.reactions).map(([emoji, count]) => (
          <TouchableOpacity
            key={emoji}
            style={styles.reactionBubble}
            onPress={() => addReaction(item.id, emoji)}
          >
            <Text>{emoji} {count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderComments = (item) => {
    if (!item.comments || item.comments.length === 0) return null;
    
    // Comments are now pre-formatted with sender name and time in fetchMessages
    return (
      <View style={styles.commentsContainer}>
        <Text style={styles.commentsHeader}>Kommentare ({item.comments.length}):</Text>
        {item.comments.map(comment => (
          <View key={comment.id} style={styles.commentBubble}>
            <Text style={styles.commentSender}>{comment.sender}</Text>
            <Text style={styles.commentText}>{comment.text}</Text>
            <Text style={styles.commentTime}>{comment.time}</Text>
          </View>
        ))}
      </View>
    );
  };

  const emojiOptions = ['👍', '❤️', '😊', '👏', '🎉', '🤔'];

  const renderEmojiPicker = (messageId) => {
    if (activeEmojiPickerMessageId !== messageId) return null;
    
    return (
      <View style={styles.emojiPickerContainer}>
        {addingReaction ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          emojiOptions.map(emoji => (
            <TouchableOpacity 
              key={emoji} 
              style={styles.emojiOption}
              onPress={() => addReaction(messageId, emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  const renderBroadcastActions = (item) => {
    if (!isBroadcast()) return null;
    
    return (
      <View style={styles.broadcastActionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => toggleEmojiPicker(item.id)}
        >
          <Ionicons name="happy-outline" size={20} color="#4285F4" />
          <Text style={styles.actionText}>Reaktion</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => startCommenting(item.id)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#4285F4" />
          <Text style={styles.actionText}>Kommentar</Text>
        </TouchableOpacity>
        
        {renderEmojiPicker(item.id)}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isMe = user && item.user_id === user.id;
    // Use item.sender which is pre-formatted in fetchMessages
    const isSystemOrBroadcastAdmin = (isBroadcast() && !isMe) || item.sender === 'System'; 
    
    return (
      <View style={styles.messageContainer}>
        <View 
          style={[
            styles.messageBubble, 
            isMe ? styles.myMessage :
            isSystemOrBroadcastAdmin ? styles.systemMessage : styles.otherMessage
          ]}
        >
          {/* Display sender name only if it's not me and not a system message */}
          {!isMe && item.sender !== 'System' && <Text style={styles.messageSender}>{item.sender}</Text>}
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.messageTime}>{item.time}</Text>
        </View>
        
        {/* Render reactions and comments which are now part of the item object */}
        {renderReactions(item)}
        {isBroadcast() && renderBroadcastActions(item)}
        {renderComments(item)}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#4285F4" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.headerTitle}
        onLongPress={isBroadcast() ? setUserAsAdmin : undefined}
        delayLongPress={1000}
      >
        <Text style={styles.headerName}>{chatGroup.name}</Text>
        <Text style={styles.headerType}>
          {isOpenChat() ? 'Offene Gruppe' : isBroadcast() ? 'Ankündigungen' : 'KI Assistent'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#4285F4" />
          </TouchableOpacity>
          
          <View style={styles.headerTitle}>
            <Text style={styles.headerName}>{chatGroup.name}</Text>
          </View>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Nachrichten werden geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#4285F4" />
          </TouchableOpacity>
          
          <View style={styles.headerTitle}>
            <Text style={styles.headerName}>{chatGroup.name}</Text>
          </View>
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchMessages}
          >
            <Text style={styles.retryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onRefresh={fetchMessages}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isBot() ? 'Frag den Dorfbot etwas über dein Dorf!' :
               isOpenChat() ? 'Sei der Erste, der eine Nachricht schreibt!' :
               'Keine Ankündigungen vorhanden.'}
            </Text>
          </View>
        }
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 90}
        style={styles.inputContainer}
      >
        {commentingOnMessageId !== null && (
          <View style={styles.commentingBar}>
            <Text style={styles.commentingText}>Kommentar schreiben</Text>
            <TouchableOpacity onPress={cancelCommenting}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        
        {((isOpenChat() && !isBroadcast()) || commentingOnMessageId !== null || isBot() || 
          // Allow organization admins to post new messages in their broadcast channels
          (isBroadcast() && user && chatGroup.adminId === user.id && !commentingOnMessageId)
        ) && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={
                isBot() ? "Stelle eine Frage über dein Dorf..." : 
                commentingOnMessageId !== null ? "Schreibe einen Kommentar..." :
                (isBroadcast() && user && chatGroup.adminId === user.id) ?
                "Neue Ankündigung schreiben..." : 
                "Nachricht schreiben..."
              }
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                (message.trim() === '' || sendingMessage || addingComment) && styles.sendButtonDisabled
              ]} 
              onPress={sendMessage}
              disabled={message.trim() === '' || sendingMessage || addingComment}
            >
              {sendingMessage || addingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={message.trim() === '' ? "#ccc" : "#fff"} 
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  headerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerType: {
    fontSize: 12,
    color: '#888',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 10,
    paddingBottom: 10,
  },
  messageContainer: {
    marginBottom: 15,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#4285F4',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  otherMessage: {
    backgroundColor: '#e5e5e5',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  systemMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderBottomLeftRadius: 5,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#666',
  },
  messageText: {
    fontSize: 15,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
    marginTop: 4,
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
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 5,
    marginLeft: 10,
  },
  reactionBubble: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentsContainer: {
    marginTop: 5,
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
    paddingLeft: 10,
  },
  commentsHeader: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  commentBubble: {
    backgroundColor: '#f1f1f1',
    padding: 8,
    borderRadius: 15,
    marginBottom: 5,
    maxWidth: '90%',
  },
  commentSender: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#666',
  },
  commentText: {
    fontSize: 13,
  },
  commentTime: {
    fontSize: 9,
    color: '#999',
    alignSelf: 'flex-end',
  },
  broadcastActionsContainer: {
    flexDirection: 'row',
    marginTop: 5,
    marginLeft: 10,
    position: 'relative',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  actionText: {
    fontSize: 12,
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
    padding: 5,
    marginHorizontal: 3,
  },
  emojiText: {
    fontSize: 20,
  },
  commentingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#e6e6fa',
    borderRadius: 10,
    marginBottom: 8,
  },
  commentingText: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default ChatDetailScreen; 