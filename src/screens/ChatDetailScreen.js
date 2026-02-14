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
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Linking,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useNetwork } from '../context/NetworkContext';
import { loadOfflineData } from '../utils/storageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';
// --- Push Notification Imports ---
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
// ------------------------------

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 5% of screen height for better scaling

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl;
  }
  return originalUrl.replace('/object/public/', '/render/image/public/') + '?width=400&quality=60';
};

// Note: Notification handler is configured globally in App.js

const ChatDetailScreen = ({ route, navigation }) => {
  const { chatGroup: initialChatGroup, onReturn } = route.params;
  const { user, displayName, userOrganizations } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const { isOfflineMode, isConnected } = useNetwork();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatGroup, setChatGroup] = useState(initialChatGroup);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeEmojiPickerMessageId, setActiveEmojiPickerMessageId] = useState(null);
  const [commentingOnMessageId, setCommentingOnMessageId] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addingReaction, setAddingReaction] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [imageAsset, setImageAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const flatListRef = useRef(null);
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false); // Track initial auto-scroll
  // --- Push Notification State ---
  const [expoPushToken, setExpoPushToken] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [togglingSubscription, setTogglingSubscription] = useState(false); // For loading indicator on toggle
  // -----------------------------

  // --- Push Notification Logic ---
  // Function to register for push notifications and get token
  async function registerForPushNotificationsAsync() {
    let token;
    if (!Device.isDevice) {
      // console.log('Push notifications require a physical device, skipping registration.');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Push-Benachrichtigungen können nicht aktiviert werden, da die Berechtigung fehlt.');
      return null;
    }

    // Get the token that identifies this device
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('Project ID not found. Make sure eas.json is configured.');
        Alert.alert('Fehler', 'Projekt-ID für Push-Benachrichtigungen nicht gefunden.');
        return null;
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      // console.log('Expo Push Token:', token);
      setExpoPushToken(token); // Store token in state
    } catch (e) {
      console.error("Error getting push token:", e);
      Alert.alert('Fehler', 'Push-Token konnte nicht abgerufen werden.');
      return null;
    }

    // Android specific setup
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  }

  // Get push token on mount if not already available
  useEffect(() => {
    if (!expoPushToken) {
      // console.log('Attempting to register for push notifications...');
      registerForPushNotificationsAsync();
    }
  }, []);


  // Check subscription status when user, chatGroup, and token are available
  useEffect(() => {
    const checkSubscription = async () => {
      if (!chatGroup?.id || !expoPushToken) {
        // Reset subscription status if dependencies are missing
        setIsSubscribed(false);
        setCheckingSubscription(false);
        // console.log('Skipping subscription check: Missing chatGroup ID or token.');
        return;
      }

      // console.log(`Checking subscription for group ${chatGroup.id}, token ${expoPushToken.substring(0, 10)}...`);
      setCheckingSubscription(true);
      
      try {
        // First check anonymous subscriptions table (works for both logged in and anonymous users)
        let { data: anonData, error: anonError, count: anonCount } = await supabase
          .from('anonymous_push_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('chat_group_id', chatGroup.id)
          .eq('expo_push_token', expoPushToken);

        if (anonError) {
          console.error('Error checking anonymous subscription:', anonError);
        } else if (anonCount > 0) {
          // Found anonymous subscription
          // console.log(`Anonymous subscription found: count=${anonCount}`);
          setIsSubscribed(true);
          setCheckingSubscription(false);
          return; // Exit early if found
        }
        
        // If no anonymous subscription found AND user is logged in, check authenticated subscriptions
        if (user) {
          const { data, error, count } = await supabase
            .from('push_notification_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('chat_group_id', chatGroup.id);

          if (error) {
            console.error('Error checking authenticated subscription:', error);
          } else {
            // console.log(`Authenticated subscription check result: count=${count}`);
            setIsSubscribed(count > 0);
            setCheckingSubscription(false);
            return;
          }
        }
        
        // If we reach here, no subscription was found
        setIsSubscribed(false);
      } catch (err) {
        console.error('Unexpected error checking subscription:', err);
        setIsSubscribed(false);
      } finally {
        setCheckingSubscription(false);
        // console.log('Subscription check finished.');
      }
    };

    checkSubscription();
  }, [chatGroup?.id, expoPushToken, user]); // Dependencies: group ID, token, and user

  // Function to toggle subscription status
  const toggleSubscription = async () => {
    // console.log('toggleSubscription triggered');

    if (!expoPushToken) {
      // console.log('toggleSubscription: Expo push token is missing.');
      Alert.alert('Fehler', 'Push Token nicht verfügbar. Bitte versuche es erneut.');
      return;
    }
    // console.log('toggleSubscription: Expo push token found:', expoPushToken.substring(0,10) + '...');

    if (checkingSubscription || togglingSubscription) {
        // console.log(`toggleSubscription: Aborting, already in progress (checking: ${checkingSubscription}, toggling: ${togglingSubscription})`);
        return; // Prevent multiple simultaneous toggles
    }
    // console.log(`toggleSubscription: Proceeding. isSubscribed: ${isSubscribed}`);

    const action = isSubscribed ? 'deaktivieren' : 'aktivieren';
    const title = `Benachrichtigungen ${action}?`;
    const message = `Möchtest du Push-Benachrichtigungen für neue Nachrichten in dieser Gruppe ${isSubscribed ? 'nicht mehr erhalten' : 'erhalten'}?`;

    Alert.alert(
      title,
      message,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ja",
          onPress: async () => {
            setTogglingSubscription(true);
            try {
              if (isSubscribed) {
                // UNSUBSCRIBE: Need to check both tables
                
                // First try anonymous_push_subscriptions
                let { error: anonError } = await supabase
                  .from('anonymous_push_subscriptions')
                  .delete()
                  .eq('chat_group_id', chatGroup.id)
                  .eq('expo_push_token', expoPushToken);
                
                if (anonError) {
                  console.error('Error deleting anonymous subscription:', anonError);
                }
                
                // Then try authenticated subscriptions if user exists
                if (user) {
                  const { error } = await supabase
                    .from('push_notification_subscriptions')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('chat_group_id', chatGroup.id);
                  
                  if (error) {
                    console.error('Error deleting authenticated subscription:', error);
                  }
                }
                
                setIsSubscribed(false);
                // console.log('Successfully unsubscribed.');
              } else {
                // SUBSCRIBE: Use appropriate table based on login status
                if (user) {
                  // Authenticated user: use push_notification_subscriptions
                  const { error } = await supabase
                    .from('push_notification_subscriptions')
                    .insert({
                      user_id: user.id,
                      chat_group_id: chatGroup.id,
                      expo_push_token: expoPushToken,
                    });

                  if (error) {
                    // Handle potential unique constraint violation
                    if (error.code === '23505') {
                      console.warn('Subscription already exists for this user and group.');
                      setIsSubscribed(true);
                    } else {
                      throw error;
                    }
                  } else {
                    setIsSubscribed(true);
                    // console.log('Successfully subscribed authenticated user.');
                  }
                } else {
                  // Anonymous user: use anonymous_push_subscriptions
                  const { error } = await supabase
                    .from('anonymous_push_subscriptions')
                    .insert({
                      chat_group_id: chatGroup.id,
                      expo_push_token: expoPushToken,
                    });

                  if (error) {
                    // Handle potential unique constraint violation
                    if (error.code === '23505') {
                      console.warn('Anonymous subscription already exists for this token and group.');
                      setIsSubscribed(true);
                    } else {
                      throw error;
                    }
                  } else {
                    setIsSubscribed(true);
                    // console.log('Successfully subscribed anonymous user.');
                  }
                }
              }
            } catch (err) {
              console.error(`Error ${action} subscription:`, err);
              Alert.alert('Fehler', `Abonnement konnte nicht ${action} werden.`);
            } finally {
              setTogglingSubscription(false);
            }
          }
        }
      ]
    );
  };
  // ------------------------------

  // Check if user is member of the org associated with this chat group
  useEffect(() => {
    // Log the dependencies whenever this effect runs
    // console.log(`ChatDetailScreen: Membership Effect Triggered. User: ${!!user}, OrgID: ${chatGroup?.organization_id}, UserOrgs available: ${!!userOrganizations}`);

    if (user && chatGroup?.organization_id && userOrganizations) {
      // console.log(`ChatDetailScreen: Checking membership. UserOrgs: ${JSON.stringify(userOrganizations)}`); // Log the actual orgs list
      const memberCheck = userOrganizations.some(org => org.id === chatGroup.organization_id);
      setIsOrgMember(memberCheck);
      // console.log(`ChatDetailScreen: User ${user.id} membership check for org ${chatGroup.organization_id}: ${memberCheck}`);
    } else {
      // Log why the check might be failing
      // console.log(`ChatDetailScreen: Membership check skipped/failed in ELSE block. User: ${!!user}, OrgID: ${chatGroup?.organization_id}, UserOrgs: ${JSON.stringify(userOrganizations)}`);
      setIsOrgMember(false);
    }
  }, [user, chatGroup, userOrganizations]);

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

  // Function to pick an image
  const pickImage = async () => {
    if (isOfflineMode) {
      Alert.alert("Offline", "Bilder können offline nicht ausgewählt werden.");
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      showAuthPrompt();
      return;
    }
    
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Sorry, wir benötigen die Berechtigung, um auf deine Fotos zugreifen zu können.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8, // Reduce quality slightly for faster uploads
      base64: true, // Request base64 data
    });

    if (!result.canceled) {
      setImageAsset(result.assets[0]);
    }
  };

  // Function to upload image and return URL
  const uploadImage = async (asset) => {
    if (isOfflineMode) return null; // Cannot upload offline
    if (!asset || !asset.base64) return null; // Check if asset and base64 data exist

    setIsUploading(true);
    try {
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`; // Store directly in the root for simplicity

      const { data, error: uploadError } = await supabase.storage
        .from('article_images')
        .upload(filePath, decode(asset.base64), { // Use decode here
          contentType: asset.mimeType ?? `image/${fileExt}`
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('article_images')
        .getPublicUrl(filePath);

      return urlData?.publicUrl;

    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Fehler', 'Das Bild konnte nicht hochgeladen werden.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Redirect to Dorfbot screen if this is a bot chat
  useEffect(() => {
    if (isBot()) {
      navigation.replace('Dorfbot');
      return;
    }
  }, []);

  // Load messages when component mounts or chat group changes
  useEffect(() => {
    fetchMessages();
    setHasAutoScrolled(false); // Reset auto-scroll when switching chats
  }, [chatGroup.id]);

  // Utility: reliably scroll to the latest message (bottom)
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    });
  };

  // Auto-scroll to the latest message once after initial load
  useEffect(() => {
    if (!isOfflineMode && !loading && messages.length > 0 && !hasAutoScrolled) {
      scrollToBottom();
      setHasAutoScrolled(true);
    }
  }, [messages, loading, isOfflineMode, hasAutoScrolled]);

  // Fetch messages for the current chat group
  const fetchMessages = async () => {
    if (isOfflineMode) {
      setLoading(false); // Ensure loading stops if we somehow enter here while offline
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      // 1. Fetch messages for this chat group, joining with profiles
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages_with_users') // Query the VIEW
        .select(`*`) // View already contains sender name
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
          sender: msg.sender, // Use the sender field directly from the view
          time: formattedTime,
          reactions: reactionsByMessageId[msg.id] || {},
          comments: commentsByMessageId[msg.id] || [],
          user_id: msg.user_id,
          image_url: msg.image_url
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

  const showAuthPrompt = () => {
    Alert.alert(
      "Konto benötigt",
      "Für diese Aktion benötigst du einen permanenten Account.",
      [
        { 
          text: "Registrieren", 
          onPress: () => navigation.navigate("Profile") 
        },
        { 
          text: "Abbrechen", 
          style: "cancel" 
        }
      ]
    );
  };

  // Add handleMessageAction to show report option on long press
  const handleMessageAction = (messageId) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Abbrechen', 'Melden'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          userInterfaceStyle: 'light'
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            Linking.openURL(`https://mylocalapp.de/report?id=${messageId}`);
          }
        }
      );
    } else {
      Alert.alert(
        '',
        '',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Melden', onPress: () => Linking.openURL(`https://mylocalapp.de/report?id=${messageId}`) }
        ],
        { cancelable: true }
      );
    }
  };

  const sendMessage = async () => {
    if (isOfflineMode) {
      Alert.alert("Offline", "Nachrichten können offline nicht gesendet werden.");
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      showAuthPrompt();
      return;
    }

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
    
    // If neither text nor image, don't proceed
    if (message.trim() === '' && !imageAsset) return;
    
    setSendingMessage(true);
    
    try {
      // console.log('Sending message:', {
      //   chatGroupId: chatGroup.id,
      //   chatGroupType: chatGroup.dbType,
      //   userId: user?.id,
      //   isAdmin: isOrgMember,
      //   text: message.substring(0, 20) + (message.length > 20 ? '...' : ''),
      //   hasImage: !!imageAsset,
      //   commentingOn: commentingOnMessageId
      // });
      
      // For comments, we currently only support text (no images)
      if (commentingOnMessageId !== null && !isOpenChat()) {
        await addComment(commentingOnMessageId, message);
        setCommentingOnMessageId(null);
      } else if (isOpenChat() || isBot() || (isBroadcast() && isOrgMember)) {
        // Regular message for open chats, bot, or admin posting to broadcast
        
        // If there's an image, upload it first
        let imageUrl = null;
        if (imageAsset) {
          imageUrl = await uploadImage(imageAsset);
          if (!imageUrl && message.trim() === '') {
            // If image upload failed and there's no text, exit
            Alert.alert('Fehler', 'Bild konnte nicht hochgeladen werden. Bitte versuche es später erneut.');
            setSendingMessage(false);
            return;
          }
        }
        
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            chat_group_id: chatGroup.id,
            text: message.trim() || null, // Use null for empty text
            image_url: imageUrl,
            user_id: user ? user.id : null
          })
          .select();
        
        if (error) {
          console.error('Error sending message:', error);
          Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden: ' + error.message);
          return;
        } else {
          // console.log('Message sent successfully:', data);
          
          // Update local chat group object with the last message
          chatGroup.lastMessage = message.trim() || 'Bild';
          chatGroup.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          // Also update the group's last message time in the chat list via AsyncStorage
          try {
            const storedLastMessages = await AsyncStorage.getItem('chatLastMessages') || '{}';
            const lastMessages = JSON.parse(storedLastMessages);
            
            lastMessages[chatGroup.id] = {
              text: message.trim() || 'Bild',
              time: chatGroup.time,
              timestamp: Date.now()
            };
            
            await AsyncStorage.setItem('chatLastMessages', JSON.stringify(lastMessages));
          } catch (err) {
            console.error('Error storing last message:', err);
          }
        }
        
        // Clear the image asset
        setImageAsset(null);
        
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
    if (isOfflineMode) {
      Alert.alert("Offline", "Reaktionen sind offline nicht verfügbar.");
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      showAuthPrompt();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        });

      if (error) {
        console.error('Error adding reaction:', error);
        return;
      }

      // Update local state to show the reaction immediately
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId 
            ? {
                ...msg,
                reactions: msg.reactions 
                  ? {
                      ...msg.reactions,
                      [emoji]: (msg.reactions[emoji] || 0) + 1
                    }
                  : { [emoji]: 1 }
              }
            : msg
        )
      );

      // Close emoji picker
      setActiveEmojiPickerMessageId(null);

    } catch (err) {
      console.error('Error in reaction process:', err);
    }
  };
  
  const addComment = async (messageId, commentText) => {
    if (isOfflineMode) {
      Alert.alert("Offline", "Kommentare sind offline nicht verfügbar.");
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      showAuthPrompt();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('message_comments')
        .insert({
          message_id: messageId,
          user_id: user.id,
          text: commentText
        });

      if (error) {
        console.error('Error adding comment:', error);
        return;
      }

      // Update UI to show comment
      fetchMessages();

      // Reset comment state
      setCommentingOnMessageId(null);
      setMessage('');

    } catch (err) {
      console.error('Unexpected error when adding comment:', err);
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
            <TouchableOpacity
              disabled={isOfflineMode || !comment.user_id} // Disable if offline or no user ID
              onPress={() => comment.user_id && navigation.navigate('UserProfileView', { userId: comment.user_id })}
            >
                <Text style={styles.commentSender}>{comment.sender}</Text>
            </TouchableOpacity>
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
    const canReact = !isBot() && !isOfflineMode && user;
    const canComment = !isBroadcast() && !isBot() && !isOfflineMode && user;

    // Transform image url
    const transformedImageUrl = item.image_url ? getTransformedImageUrl(item.image_url) : null;

    return (
      <View style={styles.messageContainer}>
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isMe ? styles.myMessage :
            item.sender === 'System' ? styles.systemMessage : styles.otherMessage
          ]}
          activeOpacity={0.7}
          onPress={() => handleMessageAction(item.id)}
        >
          {/* Display sender name only if it's not me and not a system message */}
          {!isMe && item.sender !== 'System' && (
            isOpenChat() && item.user_id ? (
              // Make name clickable in Open Chats if user_id exists
              <TouchableOpacity
                disabled={isOfflineMode || !item.user_id}
                onPress={() => item.user_id && navigation.navigate('UserProfileView', { userId: item.user_id })}
              >
                <Text style={styles.messageSender}>{item.sender}</Text>
              </TouchableOpacity>
            ) : (
              // Otherwise, just display the name (e.g., in Broadcasts)
              <Text style={styles.messageSender}>{item.sender}</Text>
            )
          )}
          
          {/* Display text if present */}
          {item.text && <Text style={styles.messageText}>{item.text}</Text>}
          
          {/* Display image if present */}
          {item.image_url && (
            <TouchableOpacity 
              onPress={() => {
                // Optional: Implement image preview/full screen view here
              }}
            >
              <Image 
                source={{ uri: transformedImageUrl }} 
                style={styles.messageImage} 
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          
          <Text style={styles.messageTime}>{item.time}</Text>
        </TouchableOpacity>
        
        {/* Render reactions and comments which are now part of the item object */}
        {renderReactions(item)}
        {isBroadcast() && renderBroadcastActions(item)}
        {renderComments(item)}
      </View>
    );
  };

  // Render Header with Notification Bell
  const renderHeader = () => {
    // Log state before rendering button
    // console.log(`Render Header: checking=${checkingSubscription}, toggling=${togglingSubscription}, hasToken=${!!expoPushToken}`);

    // Determine if the header title should be clickable
    const isOrgProfileLinkable = isBroadcast() && chatGroup?.organization_id && !isOfflineMode;

    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#4285F4" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}> 
           {/* Conditionally wrap the name in TouchableOpacity */}
           {isOrgProfileLinkable ? (
               <TouchableOpacity
                 onPress={() => navigation.navigate('OrganizationProfileView', { organizationId: chatGroup.organization_id })}
               >
                  <Text style={styles.headerNameClickable}>{chatGroup.name}</Text> 
               </TouchableOpacity>
           ) : (
               <Text style={styles.headerName}>{chatGroup.name}</Text>
           )}
          <Text style={styles.headerType}>
            {isOpenChat() ? 'Offene Gruppe' : isBroadcast() ? 'Ankündigungen' : 'KI Assistent'}
          </Text>
        </View>

        {/* Notification Bell Icon */}
        {/* Only show bell for non-bot chats if token is available */}
        {!isBot() && expoPushToken && (
          <TouchableOpacity 
            style={styles.notificationButton} 
            onPress={toggleSubscription}
            disabled={checkingSubscription || togglingSubscription || isOfflineMode}
          >
            {checkingSubscription || togglingSubscription ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <Ionicons 
                name={isSubscribed ? "notifications" : "notifications-outline"} 
                size={24} 
                color={(isOfflineMode || checkingSubscription || togglingSubscription) ? "#ccc" : (isSubscribed ? "#4285F4" : "#666")}
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {renderHeader()}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>
            {isOfflineMode ? 'Gruppeninfo laden...' : 'Nachrichten werden geladen...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !chatGroup) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error || 'Chat-Gruppe konnte nicht geladen werden.'}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {/* Reverse messages for inverted list so newest is first in data */}
      {(() => { return null })()}
      
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        inverted
        onContentSizeChange={() => {
          if (!hasAutoScrolled) {
            scrollToBottom();
          }
        }}
        onLayout={() => {
          if (!hasAutoScrolled && messages.length > 0) {
            scrollToBottom();
          }
        }}
        onRefresh={isOfflineMode ? undefined : fetchMessages}
        refreshing={!isOfflineMode && loading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isOfflineMode ? (
              <Text style={styles.emptyText}>
                Nachrichten sind im Offline-Modus nicht verfügbar.
              </Text>
            ) : (
              <Text style={styles.emptyText}>
                {isBot() ? 'Frag den Dorfbot etwas über dein Dorf!' :
                 isOpenChat() ? 'Sei der Erste, der eine Nachricht schreibt!' :
                 'Keine Ankündigungen vorhanden.'}
              </Text>
            )}
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
        
        {(() => {
            // Revised condition: Show input if not offline AND (
            //   it's an open chat OR 
            //   commenting OR 
            //   it's the bot OR 
            //   it's a broadcast group AND the user is a member of the org owning this group
            // )
            const showInputCondition = !isOfflineMode && (
                (isOpenChat()) || // Removed !isBroadcast() check, isOpenChat implies it's not broadcast
                commentingOnMessageId !== null || 
                isBot() || 
                (isBroadcast() && isOrgMember) // Removed the check for activeOrganizationId === chatGroup?.organization_id
            );
            
            if (!showInputCondition) return null;
            
            return (
                <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder={
                        isBot() ? "Stelle eine Frage über dein Dorf..." : 
                        commentingOnMessageId !== null ? "Schreibe einen Kommentar..." :
                        (isBroadcast() && isOrgMember) ?
                        "Neue Ankündigung schreiben..." : 
                        "Nachricht schreiben..."
                      }
                      value={message}
                      onChangeText={setMessage}
                      multiline
                    />
                    
                    {!commentingOnMessageId && (
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
                    )}
                    
                    <TouchableOpacity 
                      style={[
                        styles.sendButton, 
                        ((message.trim() === '' && !imageAsset) || sendingMessage || addingComment || isUploading) && styles.sendButtonDisabled
                      ]} 
                      onPress={sendMessage}
                      disabled={(message.trim() === '' && !imageAsset) || sendingMessage || addingComment || isUploading}
                    >
                      {sendingMessage || addingComment || isUploading ? (
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
            );
         })() && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={
                isBot() ? "Stelle eine Frage über dein Dorf..." : 
                commentingOnMessageId !== null ? "Schreibe einen Kommentar..." :
                (isBroadcast() && isOrgMember) ?
                "Neue Ankündigung schreiben..." : 
                "Nachricht schreiben..."
              }
              value={message}
              onChangeText={setMessage}
              multiline
            />
            
            {/* Image picker button */}
            {!commentingOnMessageId && (
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
            )}
            
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                ((message.trim() === '' && !imageAsset) || sendingMessage || addingComment || isUploading) && styles.sendButtonDisabled
              ]} 
              onPress={sendMessage}
              disabled={(message.trim() === '' && !imageAsset) || sendingMessage || addingComment || isUploading}
            >
              {sendingMessage || addingComment || isUploading ? (
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
      
      {/* Image preview */}
      {!isOfflineMode && imageAsset && (
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
  headerTitleContainer: { // Container for name and type
    flex: 1,
    marginLeft: 10, // Add some margin from back button
    marginRight: 10, // Add margin before notification button
  },
  headerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerNameClickable: { // Style for clickable org name
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208e5d', // Org color, maybe add underline later if needed
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
    borderRadius: 10,
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
  imageButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f1f1f1',
    marginLeft: 10,
  },
  imagePreviewContainer: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
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
  notificationButton: { // Style for the bell button
    padding: 5, // Add padding for easier tapping
  },
});

export default ChatDetailScreen; 