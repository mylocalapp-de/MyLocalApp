import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView
} from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader'; // Reuse if applicable
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useOrganization } from '../context/OrganizationContext'; // <-- Import useOrganization

const DirectMessagesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { isOfflineMode } = useNetwork();
  const { isOrganizationActive, activeOrganizationId, activeOrganization } = useOrganization(); // <-- Get org context
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setError("Bitte melde dich an, um Direktnachrichten zu sehen.");
      setLoading(false);
      return;
    }
    if (!isOfflineMode) {
      fetchConversations();
    } else {
      setError("Direktnachrichten sind offline nicht verfügbar.");
      setLoading(false);
    }

    // Listen for focus to refresh data (optional, but good for UX)
    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (!isOfflineMode && user) {
        fetchConversations();
      }
    });

    // --- Real-time Subscription --- 
    // This is more complex now because we need to listen to two types of events:
    // 1. Updates to dm_conversations (last_message_at changes)
    // 2. Inserts into direct_messages (to potentially trigger a re-sort or update last message preview)
    
    let conversationChangesChannel;
    if (!isOfflineMode && user) {
        console.log('[DMScreen] Setting up real-time subscription...');
        conversationChangesChannel = supabase
            .channel('dm-list-changes')
            .on(
                'postgres_changes',
                { 
                    event: '*', // Listen to INSERT/UPDATE on conversations and messages
                    schema: 'public',
                    // We need to listen to both tables, but can filter more effectively
                    // This might be overly broad and could be optimized with DB functions/triggers
                    // table: 'dm_conversations' // Might miss new message updates
                },
                (payload) => {
                    console.log('[DMScreen] Real-time change received:', payload);
                    // Basic approach: Refetch the list on any relevant change.
                    // More advanced: Try to update the specific row in state.
                    if (payload.table === 'dm_conversations' || payload.table === 'direct_messages') {
                        console.log(`[DMScreen] Change detected in ${payload.table}, refetching conversations.`);
                        fetchConversations();
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[DMScreen] Real-time channel subscribed.');
                } else {
                    // Check if err object exists before logging details
                    if (err) {
                      console.error('[DMScreen] Real-time subscription error:', JSON.stringify(err, null, 2));
                    } else {
                      // Log non-subscribed statuses that aren't errors as info/warnings
                      if (status === 'CLOSED') {
                         console.warn(`[DMScreen] Real-time subscription CLOSED. Attempting reconnect or will reconnect on next interaction.`);
                         // Optionally, implement an automatic reconnect strategy here if needed.
                      } else {
                         console.log(`[DMScreen] Real-time subscription status: ${status}`);
                      }
                    }
                }
            });
    }

    return () => {
      unsubscribeFocus();
      if (conversationChangesChannel) {
         console.log('[DMScreen] Removing real-time channel.');
         supabase.removeChannel(conversationChangesChannel);
      }
    };

  }, [user, isOfflineMode, navigation]);

  const fetchConversations = async () => {
    // Prevent race condition - Re-enabled based on further thought
    if (loading && conversations.length > 0) {
      // Only prevent refetch if already loading AND we already have some data
      // This allows the initial load to proceed even if the subscription triggers early.
      console.log("[DMScreen] Fetch already in progress, skipping duplicate call.");
      return; 
    } 

    setLoading(true);
    setError(null);
    try {
      // Base query
      let query = supabase
        .from('dm_conversation_list') // Use the updated view
        .select('*');

      // Apply context-based filtering
      if (isOrganizationActive && activeOrganizationId) {
        console.log(`[DMScreen] Fetching in Org Context for Org ID: ${activeOrganizationId}`);
        // In Org context, ONLY show conversations FOR THIS specific organization
        query = query.eq('is_org_conversation', true)
                     .eq('organization_id', activeOrganizationId);
      } else {
        console.log("[DMScreen] Fetching in Personal Context (excluding Org DMs)");
        // In Personal context, show ALL conversations (user and org)
        // No additional server-side filter needed here as the view returns everything relevant.
      }

      // Add sorting
      query = query.order('last_message_at', { ascending: false });

      // Execute the query
      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching DM conversations view:', fetchError);
        setError('Konversationen konnten nicht geladen werden.');
        setConversations([]);
      } else if (data) {
          console.log('[DMScreen] Fetched conversations:', data.length);
          
          // Apply client-side filtering for Personal Context
          if (!isOrganizationActive) {
             const filteredData = data.filter(conv => 
                !conv.is_org_conversation || (conv.is_org_conversation && conv.initiator_id === user?.id)
             );
             console.log(`[DMScreen] Personal context: Filtered ${data.length} down to ${filteredData.length} conversations.`);
             setConversations(filteredData);
          } else {
             // Org Context: Show all fetched (already filtered by Org ID server-side)
             setConversations(data);
          }
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Unexpected error fetching conversations:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Avatar Rendering --- 
  const renderUserAvatar = (item) => {
    return (
      <View style={[styles.avatarPlaceholder, styles.userAvatar]}>
        <Text style={styles.avatarLetter}>
          {item.target_name?.charAt(0).toUpperCase() || 'U'} 
        </Text>
      </View>
    );
  };

  const renderOrgAvatar = (item) => {
    // TODO: Use item.logo_url if available from the view
    return (
      <View style={[styles.avatarPlaceholder, styles.orgAvatar]}>
        <Ionicons name="business-outline" size={24} color="#fff" /> 
      </View>
    );
  };
  // --- End Avatar Rendering --- 

  const renderConversationItem = ({ item }) => {
    const isOrg = item.is_org_conversation;
    const isMyLastMessage = item.last_message_sender_id === user?.id;
    const targetName = item.target_name || (isOrg ? 'Organisation' : 'Unbekannter Benutzer');
    let baseMessage = item.last_message_text || (item.last_message_image_url ? 'Bild gesendet' : 'Keine Nachrichten');
    let displayMessage = baseMessage; // Start with the base message
    
    if (isMyLastMessage) {
      // If I sent the last message (regardless of context or type)
      displayMessage = `Du: ${baseMessage}`;
    } else if (isOrg) {
      // If it's an Org DM and someone else sent the last message
      // Prefix with the actual sender's name (who sent it TO the org)
      const senderName = item.last_message_sender_name || 'Mitglied';
      displayMessage = `${senderName}: ${baseMessage}`;
    }
    // No prefix needed for user-to-user DMs received from others

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('DirectMessageDetail', {
          conversationId: item.conversation_id,
          recipientId: isOrg ? null : item.other_user_id,
          organizationId: isOrg ? item.organization_id : null,
          recipientName: targetName,
          isOrgConversation: isOrg,
        })}
      >
        {isOrg ? renderOrgAvatar(item) : renderUserAvatar(item)}
        <View style={styles.chatInfo}>
          <View style={styles.chatTopLine}>
            <Text style={styles.chatName}>{targetName}</Text>
            <Text style={styles.chatTime}>{item.last_message_time || ''}</Text>
          </View>
          <View style={styles.chatBottomLine}>
            <Text style={styles.chatMessage} numberOfLines={1}>
              {displayMessage}
            </Text>
            {/* Optional: Add unread count logic here */} 
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (!user) {
        return (
             <View style={styles.centerContainer}>
                <Ionicons name="lock-closed-outline" size={40} color="#888" />
                <Text style={styles.infoText}>{error || "Bitte melde dich an."}</Text>
                <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.buttonText}>Zum Profil</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Lade Konversationen...</Text>
        </View>
      );
    }

    if (error && !isOfflineMode) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={fetchConversations}>
            <Text style={styles.buttonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (isOfflineMode) {
         return (
            <View style={styles.centerContainer}>
                <Ionicons name="cloud-offline-outline" size={40} color="#888" />
                <Text style={styles.infoText}>{error || "Direktnachrichten sind offline nicht verfügbar."}</Text>
            </View>
        );
    }

    return (
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={item => item.conversation_id.toString()} 
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading} // Show refresh indicator while loading
        onRefresh={isOfflineMode ? undefined : fetchConversations} // Only allow pull-to-refresh online
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={40} color="#888" />
            {/* Show context-specific empty message */} 
            {isOrganizationActive ? (
              <Text style={styles.emptyText}>
                Hier werden Direktnachrichten an die Organisation "{activeOrganization?.name || '...'}" angezeigt.
                {`\n`}{/* New line */} 
                Wechsle zu deinem persönlichen Account, um andere Nachrichten zu sehen.
              </Text>
            ) : (
              <Text style={styles.emptyText}>
                Keine Direktnachrichten vorhanden.
                Starte eine neue Konversation über das '+' Symbol!
              </Text>
            )}
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Direktnachrichten" showBackButton={true} navigation={navigation}/>
      {renderContent()}

      {/* Floating Action Button - Hide when offline OR in Org context */}
      {user && !isOfflineMode && !isOrganizationActive && ( 
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('NewDirectMessage')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

// Reuse styles from ChatScreen, adapting as needed
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Platform.OS === 'ios' ? 80 : 70, // Space for FAB
  },
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    // backgroundColor: '#4285F4', // Default blue, set per type now
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatar: {
      backgroundColor: '#4285F4', // Blue for users
  },
  orgAvatar: {
      backgroundColor: '#34A853', // Green for orgs
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  chatTime: {
    fontSize: 12,
    color: '#888',
  },
  chatMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 30 : 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
   loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
   infoText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 15,
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default DirectMessagesScreen; 