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
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Assuming EXPO_PUBLIC_SUPABASE_URL is set in your environment (e.g., .env file)
// Make sure to install cross-env or use expo-constants if direct process.env access is problematic
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const API_ENDPOINT = 'https://admin.mylocalapp.de/api/knowledge/chat/stream';

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
        const parsedMessages = JSON.parse(storedMessages);
        // Filter out any incomplete/streaming messages from previous sessions if necessary
        setMessages(parsedMessages.filter(m => m.streaming !== true));
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
      // Optionally show an alert to the user
      Alert.alert("Fehler", "Nachrichten konnten nicht geladen werden.");
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
    if (message.trim() === '' || sending) return; // Prevent multiple sends

    if (!SUPABASE_URL) {
      Alert.alert("Konfigurationsfehler", "Die Supabase URL ist nicht gesetzt. Bitte überprüfe die Umgebungsvariablen.");
      console.error("EXPO_PUBLIC_SUPABASE_URL is not defined.");
      return;
    }

    setSending(true);

    const userMessage = {
      id: Date.now().toString(),
      text: message,
      isBot: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Prepare messages for API (map isBot to role)
    const apiMessages = [...messages, userMessage].map(msg => ({
      role: msg.isBot ? 'assistant' : 'user',
      content: msg.text
    }));

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const currentUserMessage = message; // Store current message before clearing
    setMessage('');

    // Save messages up to user's input
    await saveMessages(updatedMessages);

    // Add a placeholder for the bot's response
    const botMessageId = (Date.now() + 1).toString();
    const botPlaceholderMessage = {
      id: botMessageId,
      text: "", // Start with empty text
      isBot: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      streaming: true // Flag to indicate streaming
    };

    setMessages(prevMessages => [...prevMessages, botPlaceholderMessage]);

    // Scroll down after adding messages
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);


    // --- Using XMLHttpRequest instead of fetch ---
    const xhr = new XMLHttpRequest();
    let streamedText = "";
    let lastResponseLength = 0;

    xhr.open('POST', API_ENDPOINT, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Supabase-Url', SUPABASE_URL);
    xhr.setRequestHeader('Accept', 'text/plain'); // Keep accepting text/plain

    // --- Event Listener for Progress (Streaming) ---
    xhr.onprogress = () => {
      const currentResponseText = xhr.responseText;
      const chunk = currentResponseText.substring(lastResponseLength);
      lastResponseLength = currentResponseText.length;

      // Parse the new chunk for Vercel AI SDK format (0:"...")
      const lines = chunk.split('\n').filter(line => line.startsWith('0:"'));
      lines.forEach(line => {
        try {
          const contentMatch = line.match(/^0:"(.*)"$/);
          if (contentMatch && contentMatch[1]) {
            const parsedContent = JSON.parse(`"${contentMatch[1]}"`);
            streamedText += parsedContent;

            // Update the specific bot message in the state
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === botMessageId
                  ? { ...msg, text: streamedText }
                  : msg
              )
            );

            // Scroll as content streams in
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
          }
        } catch (e) {
          console.error("Error parsing stream chunk:", line, e);
        }
      });
    };

    // --- Event Listener for Request Completion ---
    xhr.onload = async () => {
      if (xhr.status === 200) {
        // Ensure final state is captured
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === botMessageId
              ? { ...msg, text: streamedText, streaming: false } // Mark as complete
              : msg
          )
        );

        // Save final messages to AsyncStorage
        const finalMessages = messages.map(msg =>
          msg.id === botMessageId
              ? { ...msg, text: streamedText, streaming: false }
              : msg
          );
        // Need to use the state setter's callback or useEffect to get the *really* final state for saving
        // For simplicity here, we reconstruct based on the last update
        const finalMessagesToSave = [...updatedMessages, { ...botPlaceholderMessage, text: streamedText, streaming: false }];
        await saveMessages(finalMessagesToSave);
        setSending(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
      } else {
        // Handle HTTP errors (non-200 status)
        const errorText = xhr.responseText || `HTTP Error ${xhr.status}`;
        console.error('XHR Error:', errorText);
        handleRequestError(new Error(errorText), botMessageId, updatedMessages, botPlaceholderMessage);
      }
    };

    // --- Event Listener for Network Errors ---
    xhr.onerror = async () => {
      const errorText = 'Network request failed';
      console.error('XHR Network Error');
      handleRequestError(new Error(errorText), botMessageId, updatedMessages, botPlaceholderMessage);
    };

    // --- Send the Request ---
    xhr.send(JSON.stringify({ messages: apiMessages }));

    // --- Moved Error Handling Logic to a Helper Function ---
    const handleRequestError = async (error, currentBotId, userMessages, placeholder) => {
       console.error('Error during XHR request:', error);
       const errorMessageText = `Fehler: ${error.message || 'Unbekannter Fehler'}`;
       Alert.alert("Fehler", `Nachricht konnte nicht gesendet werden: ${error.message}`);

        setMessages(prevMessages =>
         prevMessages.map(msg =>
           msg.id === currentBotId
             ? { ...msg, text: errorMessageText, streaming: false, isError: true }
             : msg
         )
       );

        const errorMessagesToSave = [...userMessages, { ...placeholder, text: errorMessageText, streaming: false, isError: true }];
        await saveMessages(errorMessagesToSave);
        setSending(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }

    /*
    // --- Original fetch logic (commented out) ---
       // eslint-disable-next-line no-constant-condition
       while (true) {
         const { value, done } = await reader.read();
         if (done) {
           break;
         }

         const chunk = decoder.decode(value, { stream: true });
         // Reverted to manual parsing for Vercel AI SDK Stream format (e.g., 0:"text")
         const lines = chunk.split('\n').filter(line => line.startsWith('0:"'));
         lines.forEach(line => {
           try {
             // Extract content within quotes, unescaping JSON string content
             const contentMatch = line.match(/^0:"(.*)"$/);
             if (contentMatch && contentMatch[1]) {
               const parsedContent = JSON.parse(`"${contentMatch[1]}"`); // Use JSON.parse for proper unescaping
               streamedText += parsedContent;
               // Update the specific bot message in the state
               setMessages(prevMessages =>
                 prevMessages.map(msg =>
                   msg.id === botMessageId
                     ? { ...msg, text: streamedText }
                     : msg
                 )
               );
                // Scroll as content streams in
               setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
             }
           } catch (e) {
             console.error("Error parsing stream chunk:", line, e);
           }
         });
       }

       // Streaming finished, update the final message state and save
       setMessages(prevMessages =>
         prevMessages.map(msg =>
           msg.id === botMessageId
             ? { ...msg, text: streamedText, streaming: false } // Mark as complete
             : msg
         )
       );
       const finalMessages = messages.map(msg =>
         msg.id === botMessageId
             ? { ...msg, text: streamedText, streaming: false } // Ensure final save has complete message
             : msg
         );

       await saveMessages(finalMessages);


    } catch (error) {
      console.error('Error sending message or processing stream:', error);
      Alert.alert("Fehler", `Nachricht konnte nicht gesendet werden: ${error.message}`);
      // Update placeholder to show error or remove it
       setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === botMessageId
            ? { ...msg, text: `Fehler: ${error.message || 'Unbekannter Fehler beim Streamen'}`, streaming: false, isError: true } // Indicate error
            : msg
        )
      );
       const errorMessages = messages.map(msg =>
        msg.id === botMessageId
            ? { ...msg, text: `Fehler: ${error.message || 'Unbekannter Fehler beim Streamen'}`, streaming: false, isError: true }
            : msg
        );
       await saveMessages(errorMessages); // Save state with error message
    } finally {
      // This needs to be handled within onload/onerror for XHR
      setSending(false);
       // Ensure scroll to end after all updates
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
    */
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
          item.isBot ? styles.botMessage : styles.myMessage,
          item.isError ? styles.errorMessage : null, // Style for error messages
          item.streaming && styles.streamingMessage // Style for streaming indicator
        ]}
      >
        <Text style={[styles.messageText, item.isError ? styles.errorText : null]}>{item.text}</Text>
         {/* Show blinking cursor or indicator if streaming */}
        {item.streaming && <ActivityIndicator size="small" color="#fff" style={styles.streamingIndicator} />}
        {!item.streaming && <Text style={[styles.messageTime, item.isError ? styles.errorTime : null]}>{item.time}</Text>}
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
    backgroundColor: '#34A853', // Google Green
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
  errorMessage: {
    backgroundColor: '#DB4437', // Google Red
    borderColor: '#c53929',
    borderWidth: 1,
  },
  errorText: {
    color: '#fff',
    fontStyle: 'italic',
  },
  errorTime: {
     color: 'rgba(255, 255, 255, 0.7)',
  },
  streamingMessage: {
    // Optional: slightly different style while streaming
    paddingBottom: 18, // Make space for time/indicator
   },
   streamingIndicator: {
     position: 'absolute',
     bottom: 4,
     right: 8,
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