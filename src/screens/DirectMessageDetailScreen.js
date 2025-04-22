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
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';
import { useOrganization } from '../context/OrganizationContext';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05;

const DirectMessageDetailScreen = ({ route, navigation }) => {
  const { 
      conversationId, 
      recipientId, // Null for org DMs
      organizationId, // Null for user DMs
      recipientName, // Name of the user OR the organization
      isOrgConversation 
  } = route.params;
  
  const { user, displayName } = useAuth();
  const { isOfflineMode } = useNetwork();
  const { isOrganizationActive, activeOrganization } = useOrganization();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [imageAsset, setImageAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const flatListRef = useRef(null);

  // Load messages when component mounts or conversationId changes
  useEffect(() => {
    if (conversationId && !isOfflineMode) {
      fetchMessages();
      // Consider marking conversation as read here or on view
    } else if (isOfflineMode) {
      setError("Nachrichten sind offline nicht verfügbar.");
      setLoading(false);
    } else {
        setError("Konversations-ID fehlt.");
        setLoading(false);
    }
  }, [conversationId, isOfflineMode]);

  // Subscribe to new messages in this conversation
  useEffect(() => {
    if (isOfflineMode || !conversationId) return;

    const channel = supabase
      .channel(`public:direct_messages:conversation_id=eq.${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          console.log('New DM received:', payload.new);
          const newMessage = payload.new;

          // Use a function to get sender name to keep it DRY
          const getSenderName = (senderId) => {
             if (senderId === user?.id) {
                 return displayName || 'Ich'; // Current user
             } else if (isOrgConversation) {
                 // In Org DMs, need to fetch profile of the sending member
                 // For now, use a placeholder or try a quick fetch (less ideal)
                 // A better approach involves joining profile in the message select or subscription
                 return 'Mitglied'; // Placeholder - TODO: Fetch actual member name 
             } else {
                 // User DM, use the recipientName passed in
                 return recipientName || 'Unbekannt';
             }
          };

          setMessages((prevMessages) => {
             if (prevMessages.some(msg => msg.id === newMessage.id)) {
                return prevMessages;
            }
            const formattedTime = new Date(newMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return [
                 ...prevMessages,
                 {
                    id: newMessage.id,
                    text: newMessage.text,
                    image_url: newMessage.image_url,
                    sender_id: newMessage.sender_id,
                    time: formattedTime,
                    // Use the helper function to determine sender name
                    sender: getSenderName(newMessage.sender_id),
                    user_id: newMessage.sender_id // Keep original user_id for isMe check
                 }
             ];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to DM conversation ${conversationId}`);
        } else {
           console.log(`Subscription status: ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // Dependencies: include isOrgConversation and recipientName for sender resolution
  }, [conversationId, isOfflineMode, user, displayName, recipientName, isOrgConversation]);


  // Fetch messages for the current conversation
  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch profiles along with messages for accurate sender names
      const { data, error: fetchError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          sender_id,
          text,
          image_url,
          created_at,
          sender:profiles ( display_name ) 
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching direct messages:', fetchError);
        setError('Nachrichten konnten nicht geladen werden.');
      } else if (data) {
        const processedMessages = data.map(msg => {
          const messageDate = new Date(msg.created_at);
          const formattedTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isMyMessage = msg.sender_id === user?.id;
          
          // Determine sender name based on context
          let finalSenderName = 'Unbekannt'; // Default

          if (isOrganizationActive) { // Viewing in Org Context
              if (isMyMessage) {
                  // Message sent BY ME while in Org Context -> Show Org Name
                  finalSenderName = activeOrganization?.name || 'Organisation';
              } else {
                  // Message sent BY ANOTHER USER TO the Org -> Show User's Name
                  finalSenderName = msg.sender?.display_name || 'Benutzer'; 
              }
          } else { // Viewing in Personal Context
              if (isMyMessage) {
                  // Message sent BY ME -> Show My Name
                  finalSenderName = displayName || 'Ich';
              } else if (isOrgConversation) {
                  // Message received FROM Org -> Show Org Name
                  finalSenderName = recipientName || 'Organisation'; // recipientName holds Org name
              } else {
                  // Message received FROM another USER -> Show Other User's Name
                  finalSenderName = msg.sender?.display_name || recipientName || 'Unbekannt';
              }
          }

          return {
            id: msg.id,
            text: msg.text,
            image_url: msg.image_url,
            sender: finalSenderName, // Use the determined name
            time: formattedTime,
            user_id: msg.sender_id, // Keep original field name for isMe check
            sender_id: msg.sender_id, // Keep for consistency
          };
        });
        setMessages(processedMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Unexpected error fetching messages:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
     if (isOfflineMode) {
      Alert.alert("Offline", "Bilder können offline nicht ausgewählt werden.");
      return;
    }
     if (!user) {
         Alert.alert("Anmeldung erforderlich", "Bitte melde dich an, um Bilder zu senden.");
         return;
     }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Zugriff auf Fotos wird benötigt.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImageAsset(result.assets[0]);
    }
  };

  const uploadImage = async (asset) => {
    if (isOfflineMode || !asset || !asset.base64) return null;

    setIsUploading(true);
    try {
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      // Use a dedicated bucket for DM images if preferred
      const bucketName = 'article_images'; // Or 'dm_images'
      const filePath = `${fileName}`; 

      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, decode(asset.base64), {
          contentType: asset.mimeType ?? `image/${fileExt}`
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return urlData?.publicUrl;

    } catch (error) {
      console.error('Error uploading DM image:', error);
      Alert.alert('Upload Fehler', 'Bild konnte nicht hochgeladen werden.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async () => {
    if (isOfflineMode) {
      Alert.alert("Offline", "Nachrichten können offline nicht gesendet werden.");
      return;
    }
    if (!user) {
      Alert.alert("Anmeldung erforderlich", "Bitte melde dich an, um Nachrichten zu senden.");
      return;
    }
    if ((message.trim() === '' && !imageAsset) || sendingMessage || isUploading) return;

    setSendingMessage(true);
    let imageUrl = null;

    // --- Optimistic Update --- 
    // 1. Create the message object locally first
    const optimisticMessage = {
      id: uuidv4(), // Generate a temporary unique ID
      text: message.trim() || null,
      image_url: imageAsset ? imageAsset.uri : null, // Use local URI for preview initially
      // Determine sender based on context
      sender: isOrganizationActive ? (activeOrganization?.name || 'Organisation') : (displayName || 'Ich'), 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      user_id: user.id,
      isOptimistic: true // Optional flag to style differently if needed
    };

    // 2. Add it to the local state immediately
    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    // 3. Clear input fields now (optional, or clear after successful DB insert)
    // setMessage(''); 
    // setImageAsset(null);
    // --- End Optimistic Update ---

    try {
      if (imageAsset) {
        // If uploading an image, wait for the public URL
        // The real-time subscription will handle updating the message with the proper URL
        imageUrl = await uploadImage(imageAsset);
        if (!imageUrl && message.trim() === '') {
           // If upload failed and no text, remove the optimistic message
           setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
           setSendingMessage(false);
           return; 
        }
      }

      // 4. Send the actual data to Supabase
      const { data, error: insertError } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: message.trim() || null,
          image_url: imageUrl, // Use the uploaded URL here
        })
        .select(); 

      if (insertError) {
        console.error('Error sending direct message:', insertError);
        Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden: ' + insertError.message);
        // Remove the optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      } else {
        console.log('Direct message sent successfully to DB:', data);
         // Clear input fields AFTER successful DB insert
         setMessage(''); 
         setImageAsset(null);
        // Optional: Update the optimistic message with real data if needed, 
        // but the subscription should handle replacing it eventually.
      }
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    } finally {
      setSendingMessage(false);
    }
  };

  const renderItem = ({ item }) => {
    const isMe = user && item.user_id === user.id;
    const canNavigateToProfile = !isMe && !isOrgConversation && item.user_id;

    return (
      <View style={styles.messageContainer}>
        {/* Display sender name ABOVE bubble only if NOT sent by current user */}
        {!isMe && (
            <TouchableOpacity 
                disabled={isOfflineMode || !canNavigateToProfile} // Disable if offline or cannot navigate
                onPress={() => canNavigateToProfile && navigation.navigate('UserProfileView', { userId: item.user_id })}
            >
                <Text style={[styles.messageSenderName, styles.otherMessageSenderName]}>
                    {item.sender} {/* Sender name determined by context */}
                </Text>
            </TouchableOpacity>
        )}

        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myMessage : styles.otherMessage,
            // Add specific style if acting as org?
            (isMe && isOrganizationActive) ? styles.orgSentMessage : {}
          ]}
        >
          {item.text && <Text style={styles.messageText}>{item.text}</Text>}

          {item.image_url && (
            <TouchableOpacity>
              <Image
                source={{ uri: item.image_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {/* Optional: Add indicator that message was sent on behalf of org? */}
          {isMe && isOrganizationActive && <Text style={styles.orgSentIndicator}>(Gesendet als {activeOrganization?.name})</Text>}

          <Text style={styles.messageTime}>{item.time}</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    const canNavigateFromHeader = !isOrgConversation && recipientId;
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#4285F4" />
        </TouchableOpacity>
         {/* Render correct avatar/icon */}
         {isOrgConversation ? (
            <View style={[styles.avatarPlaceholder, styles.orgAvatar]}>
                <Ionicons name="business-outline" size={18} color="#fff" />
            </View>
         ) : (
            // Make avatar touchable for user profile navigation
            <TouchableOpacity 
                disabled={isOfflineMode || !canNavigateFromHeader}
                onPress={() => canNavigateFromHeader && navigation.navigate('UserProfileView', { userId: recipientId })}
                style={[styles.avatarPlaceholder, styles.userAvatar]} // Wrap in TouchableOpacity
            >
                <Text style={styles.avatarLetter}>
                    {recipientName?.charAt(0).toUpperCase() || 'U'}
                </Text>
            </TouchableOpacity>
         )}
        {/* Make name touchable for user profile navigation */}
         <TouchableOpacity 
             disabled={isOfflineMode || !canNavigateFromHeader}
             onPress={() => canNavigateFromHeader && navigation.navigate('UserProfileView', { userId: recipientId })}
             style={{ flex: 1 }} // Make touchable area expand
         >
            <Text style={styles.headerName}>{recipientName || (isOrgConversation ? 'Organisation' : 'Nachricht')}</Text>
         </TouchableOpacity>
         {/* Optional: Add online status indicator? Not applicable for orgs */}
      </View>
    );
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {renderHeader()}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Lade Nachrichten...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
           <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { isOfflineMode ? navigation.goBack() : fetchMessages() }}
          >
            <Text style={styles.retryButtonText}>{isOfflineMode ? 'Zurück' : 'Erneut versuchen'}</Text>
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
        onRefresh={isOfflineMode ? undefined : fetchMessages}
        refreshing={!isOfflineMode && loading}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} // Scroll on initial load
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })} // Scroll when layout changes
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isOfflineMode ? 'Offline keine Nachrichten.' : 'Schreibe die erste Nachricht!'}
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 90} // Adjust as needed
        style={styles.inputContainer}
      >
        {/* Image preview */}
        {imageAsset && (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: imageAsset.uri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setImageAsset(null)}
              disabled={isUploading || sendingMessage}
            >
              <Ionicons name="close-circle" size={24} color="#ff3b30" />
            </TouchableOpacity>
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}
          </View>
        )}

        {!isOfflineMode && user && (
           <View style={styles.inputRow}>
            <TouchableOpacity
                style={styles.imageButton}
                onPress={pickImage}
                disabled={isUploading || sendingMessage}
              >
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={isUploading || sendingMessage ? "#ccc" : "#4285F4"}
                />
              </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Nachricht schreiben..."
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                ((message.trim() === '' && !imageAsset) || sendingMessage || isUploading) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={(message.trim() === '' && !imageAsset) || sendingMessage || isUploading}
            >
              {sendingMessage || isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={(message.trim() === '' && !imageAsset) ? "#ccc" : "#fff"}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Reuse styles from ChatDetailScreen, adapting as needed
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
  headerName: { // Changed from headerTitleContainer
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
    alignItems: 'stretch',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    maxWidth: '80%',
    alignSelf: 'auto',
  },
  myMessage: {
    backgroundColor: '#4285F4',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
     color: '#fff', // Ensure text is white on blue background
  },
  otherMessage: {
    backgroundColor: '#e5e5e5',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
    color: '#000', // Ensure text is dark on light background
  },
   messageText: {
    fontSize: 15,
     color: 'inherit', // Inherit color from bubble style
  },
  messageTime: {
    fontSize: 10,
    color: '#999', // Default light gray for time
    alignSelf: 'flex-end',
    marginTop: 4,
  },
   inputContainer: {
    paddingHorizontal: 10,
     paddingBottom: Platform.OS === 'ios' ? 15 : 10, // More padding bottom for keyboard avoidance
     paddingTop: 10,
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
    paddingVertical: 8,
     paddingHorizontal: 15,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    maxHeight: 100,
     marginHorizontal: 10, // Add horizontal margin
  },
  sendButton: {
    //marginLeft: 10, // Removed margin, handled by input margin
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#b0c4de', // Lighter blue when disabled
  },
  imageButton: {
    padding: 5, // Slightly smaller padding
    // No background needed if it's just an icon
  },
   imagePreviewContainer: {
    paddingVertical: 5, // Add padding around preview
    // Removed marginTop, handled by inputContainer padding
    alignItems: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: 100, // Smaller preview
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 0, // Adjust position for smaller preview
    right: 0, // Adjust position
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
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
    flex: 1, // Allow empty component to fill space
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // Removed background color
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 5,
    marginBottom: 5,
  },
  messageSenderName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  myMessageSenderName: {
      color: '#eee',
  },
  otherMessageSenderName: {
      color: '#555',
  },
  // New styles for messages sent AS organization
  orgSentMessage: {
    backgroundColor: '#34A853', // Use Org color (e.g., green)
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  orgSentIndicator: {
    fontSize: 10,
    color: '#e0e0e0', // Lighter text on green
    marginTop: 2,
    fontStyle: 'italic',
    alignSelf: 'flex-start',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatar: {
    backgroundColor: '#4285F4',
  },
  orgAvatar: {
    backgroundColor: '#34A853', // Example green for orgs
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DirectMessageDetailScreen; 