import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dorfbot_messages';

const DorfbotScreen = ({ navigation }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  // Load messages from local storage when component mounts
  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const storedMessages = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      } else {
        // Add welcome message if no messages exist
        const welcomeMessage = {
          id: Date.now().toString(),
          text: "Hallo! Ich bin der Dorfbot. Wie kann ich dir heute helfen?",
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([welcomeMessage]);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([welcomeMessage]));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMessages = async (updatedMessages) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  const sendMessage = async () => {
    if (message.trim() === '') return;
    
    setSending(true);
    
    try {
      // Add user message
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        isBot: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setMessage('');
      
      // Save to local storage
      await saveMessages(updatedMessages);
      
      // Simulate bot thinking (1 second delay)
      setTimeout(async () => {
        // Add bot response
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: "Antwort", // Simple placeholder response as requested
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);
        
        // Save to local storage again with bot response
        await saveMessages(finalMessages);
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd();
        }, 100);
        
        setSending(false);
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      setSending(false);
    }
  };

  const clearConversation = async () => {
    try {
      const welcomeMessage = {
        id: Date.now().toString(),
        text: "Hallo! Ich bin der Dorfbot. Wie kann ich dir heute helfen?",
        isBot: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages([welcomeMessage]);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([welcomeMessage]));
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.messageContainer}>
      <View 
        style={[
          styles.messageBubble, 
          item.isBot ? styles.botMessage : styles.myMessage
        ]}
      >
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.messageTime}>{item.time}</Text>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#4285F4" />
      </TouchableOpacity>
      
      <View style={styles.headerTitle}>
        <Text style={styles.headerName}>Dorfbot - KI Assistent</Text>
        <Text style={styles.headerType}>Frag mich etwas über dein Dorf</Text>
      </View>
      
      <TouchableOpacity style={styles.clearButton} onPress={clearConversation}>
        <Ionicons name="trash-outline" size={22} color="#666" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#34A853" />
          <Text style={styles.loadingText}>Nachrichten werden geladen...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />
      )}
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 90}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Stelle eine Frage über dein Dorf..."
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              (message.trim() === '' || sending) && styles.sendButtonDisabled
            ]} 
            onPress={sendMessage}
            disabled={message.trim() === '' || sending}
          >
            {sending ? (
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
  clearButton: {
    padding: 10,
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
  botMessage: {
    backgroundColor: '#34A853',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
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
    backgroundColor: '#34A853',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f1f1f1',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  }
});

export default DorfbotScreen; 