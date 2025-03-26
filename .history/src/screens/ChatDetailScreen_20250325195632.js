import React, { useState, useRef } from 'react';
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
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ChatDetailScreen = ({ route, navigation }) => {
  const { chatGroup } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(getInitialMessages(chatGroup));
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentingOnMessageId, setCommentingOnMessageId] = useState(null);
  const flatListRef = useRef(null);

  // Get different initial messages based on chat type
  function getInitialMessages(group) {
    if (group.isBot) {
      return [
        {
          id: 1,
          text: 'Hallo! Ich bin der Dorfbot. Wie kann ich dir bei Fragen zu deinem Dorf helfen?',
          sender: 'bot',
          time: '18:00',
        }
      ];
    } else if (group.type === 'Offene Gruppen') {
      return [
        {
          id: 1,
          text: 'Hallo zusammen! Weiß jemand, wann die Bauarbeiten an der Hauptstraße beginnen?',
          sender: 'Max Mustermann',
          time: '11:45',
        },
        {
          id: 2,
          text: 'Laut Gemeindeblatt soll es nächste Woche Montag losgehen.',
          sender: 'Anna Schmidt',
          time: '12:02',
        },
        {
          id: 3,
          text: 'Danke für die Info!',
          sender: 'Max Mustermann',
          time: '12:05',
        }
      ];
    } else {
      // Broadcast groups (Vereine, Behörden)
      return [
        {
          id: 1,
          text: group.type === 'Vereine' 
            ? 'Das Sportfest findet am 15. Juli statt. Bitte merkt euch den Termin vor!' 
            : 'Unsere neue Ausstellung "Lokale Kunst im Wandel der Zeit" öffnet nächsten Freitag. Eintritt frei!',
          sender: group.name,
          time: group.time,
          reactions: {
            '👍': 5,
            '❤️': 2,
          },
          comments: [
            {
              id: 101,
              text: 'Super, ich freue mich darauf!',
              sender: 'Lisa Weber',
              time: '15:30'
            }
          ]
        }
      ];
    }
  }

  const sendMessage = () => {
    if (message.trim() === '') return;

    const newMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'Me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // For broadcasts, add the comment to the commented message
    if (commentingOnMessageId !== null && !isOpenChat()) {
      const updatedMessages = messages.map(msg => {
        if (msg.id === commentingOnMessageId) {
          const comments = msg.comments || [];
          return {
            ...msg,
            comments: [...comments, {
              id: Date.now(),
              text: message,
              sender: 'Me',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]
          };
        }
        return msg;
      });
      setMessages(updatedMessages);
      setCommentingOnMessageId(null);
    } else if (isOpenChat() || chatGroup.isBot) {
      // Regular message for open chats or bot
      setMessages([...messages, newMessage]);
    }

    setMessage('');
    
    // Scroll to the bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd();
    }, 100);
  };

  const addReaction = (messageId, emoji) => {
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        return {
          ...msg,
          reactions: {
            ...reactions,
            [emoji]: (reactions[emoji] || 0) + 1
          }
        };
      }
      return msg;
    });
    setMessages(updatedMessages);
    setShowEmojiPicker(false);
  };

  const startCommenting = (messageId) => {
    setCommentingOnMessageId(messageId);
  };

  const cancelCommenting = () => {
    setCommentingOnMessageId(null);
  };

  const isOpenChat = () => chatGroup.type === 'Offene Gruppen';
  const isBroadcast = () => !isOpenChat() && !chatGroup.isBot;
  const isBot = () => chatGroup.isBot;

  const renderReactions = (item) => {
    if (!item.reactions) return null;
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(item.reactions).map(([emoji, count]) => (
          <View key={emoji} style={styles.reactionBubble}>
            <Text>{emoji} {count}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderComments = (item) => {
    if (!item.comments || item.comments.length === 0) return null;
    
    return (
      <View style={styles.commentsContainer}>
        <Text style={styles.commentsHeader}>Kommentare:</Text>
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
    if (!showEmojiPicker) return null;
    
    return (
      <View style={styles.emojiPickerContainer}>
        {emojiOptions.map(emoji => (
          <TouchableOpacity 
            key={emoji} 
            style={styles.emojiOption}
            onPress={() => addReaction(messageId, emoji)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBroadcastActions = (item) => {
    if (!isBroadcast()) return null;
    
    return (
      <View style={styles.broadcastActionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowEmojiPicker(!showEmojiPicker)}
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
        
        {showEmojiPicker && renderEmojiPicker(item.id)}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isMe = item.sender === 'Me';
    const isSystemOrBroadcast = item.sender === chatGroup.name || item.sender === 'bot';
    
    return (
      <View style={styles.messageContainer}>
        <View 
          style={[
            styles.messageBubble, 
            isMe ? styles.myMessage : 
            isSystemOrBroadcast ? styles.systemMessage : styles.otherMessage
          ]}
        >
          {!isMe && <Text style={styles.messageSender}>{item.sender}</Text>}
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.messageTime}>{item.time}</Text>
        </View>
        
        {renderReactions(item)}
        {renderComments(item)}
        {renderBroadcastActions(item)}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#4285F4" />
      </TouchableOpacity>
      
      <View style={styles.headerTitle}>
        <Text style={styles.headerName}>{chatGroup.name}</Text>
        <Text style={styles.headerType}>
          {isOpenChat() ? 'Offene Gruppe' : isBroadcast() ? 'Ankündigungen' : 'KI Assistent'}
        </Text>
      </View>
    </View>
  );

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
        
        {(isOpenChat() || commentingOnMessageId !== null || isBot()) && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={
                isBot() ? "Stelle eine Frage über dein Dorf..." : 
                commentingOnMessageId !== null ? "Schreibe einen Kommentar..." :
                "Nachricht schreiben..."
              }
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, message.trim() === '' && styles.sendButtonDisabled]} 
              onPress={sendMessage}
              disabled={message.trim() === ''}
            >
              <Ionicons name="send" size={20} color={message.trim() === '' ? "#ccc" : "#fff"} />
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
});

export default ChatDetailScreen; 