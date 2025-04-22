import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatScreen = ({ navigation, route }) => {
  const { isOrganizationActive, activeOrganizationId, activeOrganization } = useOrganization();
  const { user, displayName } = useAuth();
  const { isOfflineMode, isConnected } = useNetwork();

  // State for chat groups and loading
  const [chatGroups, setChatGroups] = useState([]);
  const [dmConversations, setDmConversations] = useState([]);
  const [combinedList, setCombinedList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Alle');
  const [localUnreadCounts, setLocalUnreadCounts] = useState({});
  const [localLastMessages, setLocalLastMessages] = useState({});
  const [chatFilters, setChatFilters] = useState(['Alle']);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingDms, setIsLoadingDms] = useState(true);
  const [dmError, setDmError] = useState(null);

  // Listen for navigation events to update unread counts
  useEffect(() => {
    if (route.params?.viewedChatId && route.params?.timestamp) {
      updateLocalUnreadCount(route.params.viewedChatId);
    }
  }, [route.params?.viewedChatId, route.params?.timestamp]);

  // Load local unread counts from AsyncStorage
  useEffect(() => {
    const loadLocalData = async () => {
      try {
        const storedCounts = await AsyncStorage.getItem('localUnreadCounts');
        if (storedCounts) {
          setLocalUnreadCounts(JSON.parse(storedCounts));
        }
        const storedLastMessages = await AsyncStorage.getItem('chatLastMessages');
        if (storedLastMessages) {
          setLocalLastMessages(JSON.parse(storedLastMessages));
        }
      } catch (err) {
        console.error('[ChatScreen] Error loading local data:', err);
      }
    };
    loadLocalData();
  }, []);
  
  // Fetch chat filters (tags) from Supabase
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoadingFilters(true);
      try {
        const { data, error: filterError } = await supabase
          .from('chat_group_tags')
          .select('name, is_highlighted')
          .order('display_order', { ascending: true });

        if (filterError) {
          console.error('[ChatScreen] Error fetching chat filters:', filterError);
          setChatFilters([{ name: 'Alle', is_highlighted: false }]);
        } else if (data) {
          const fetchedFilters = data.map(tag => ({
            name: tag.name,
            is_highlighted: tag.is_highlighted || false
          }));
          setChatFilters([{ name: 'Alle', is_highlighted: false }, ...fetchedFilters]);
        } else {
          setChatFilters([{ name: 'Alle', is_highlighted: false }]);
        }
      } catch (err) {
        console.error('[ChatScreen] Unexpected error fetching filters:', err);
        setChatFilters([{ name: 'Alle', is_highlighted: false }]);
      } finally {
        setIsLoadingFilters(false);
      }
    };
    fetchFilters();
  }, []);

  // Combined data fetching logic
  const fetchData = useCallback(async () => {
    if (isOfflineMode) {
        setError("Chats und Nachrichten sind offline nicht verfügbar.");
        setIsLoading(false);
        setIsLoadingDms(false);
        setChatGroups([]);
        setDmConversations([]);
        return;
    }
    if (!user) {
        setError("Bitte melde dich an, um Chats und Nachrichten zu sehen.");
        setIsLoading(false);
        setIsLoadingDms(false);
        setChatGroups([]);
        setDmConversations([]);
        return;
    }

    setIsLoading(true);
    setIsLoadingDms(true);
    setError(null);
    setDmError(null);

    // Use Promise.all to fetch both concurrently
    try {
        const [groupsResult, dmsResult] = await Promise.all([
            fetchChatGroupsInternal(),
            fetchDirectMessagesInternal()
        ]);

        // Combine and process results
        const combined = processAndCombineData(groupsResult, dmsResult);
        setCombinedList(combined);
        filterCombinedList(activeFilter, combined); // Apply filter immediately

    } catch (err) {
        console.error('[ChatScreen] Error during combined fetch:', err);
        setError('Fehler beim Laden der Daten.');
        setChatGroups([]); // Keep state consistent
        setDmConversations([]);
        setCombinedList([]);
        setFilteredList([]);
    } finally {
        setIsLoading(false); // Combined loading state
        setIsLoadingDms(false); // Also track DM loading specifically if needed
    }
  }, [user, isOfflineMode, isOrganizationActive, activeOrganizationId, activeFilter, localUnreadCounts, localLastMessages]); // Dependencies

  // Fetch data on initial load and when context/user changes
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Use the useCallback dependency

  // Fetch on focus
  useEffect(() => {
      const unsubscribeFocus = navigation.addListener('focus', () => {
          console.log('[ChatScreen] Focused, refetching data...');
          if (!isOfflineMode && user) {
              fetchData(); // Use the combined fetch function
          } else {
              // Handle offline/logged out state on focus if needed
              // Maybe just update based on existing state?
              filterCombinedList(activeFilter, combinedList);
          }
      });
      return unsubscribeFocus;
  }, [navigation, isOfflineMode, user, fetchData, activeFilter, combinedList]); // Add dependencies

  // --- Internal Fetch Functions ---

  const fetchChatGroupsInternal = async () => {
    console.log("[ChatScreen] Fetching chat groups...");
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_group_listings')
        .select('*')
        .neq('type', 'bot'); // Exclude bots from database query

      if (fetchError) {
        console.error('[ChatScreen] Error fetching chat groups:', fetchError);
        setError('Chat-Gruppen konnten nicht geladen werden.');
        return []; // Return empty array on error
      }
      console.log(`[ChatScreen] Fetched ${data?.length || 0} chat groups.`);
      setChatGroups(data || []); // Update specific state if needed
      return data || [];
    } catch (err) {
      console.error('[ChatScreen] Unexpected error fetching chat groups:', err);
      setError('Unerwarteter Fehler beim Laden der Chat-Gruppen.');
      return [];
    }
  };

  const fetchDirectMessagesInternal = async () => {
    console.log("[ChatScreen] Fetching direct messages...");
    if (!user) {
        console.log("[ChatScreen] No user, skipping DM fetch.");
        setDmError("Bitte anmelden.");
        return [];
    }
    if (isOfflineMode) {
        console.log("[ChatScreen] Offline mode, skipping DM fetch.");
        setDmError("DMs offline nicht verfügbar.");
        return [];
    }

    try {
        let query = supabase
            .from('dm_conversation_list') // Use the view
            .select('*');

        if (isOrganizationActive && activeOrganizationId) {
            console.log(`[ChatScreen] Fetching DMs in Org Context for Org ID: ${activeOrganizationId}`);
            query = query.eq('is_org_conversation', true)
                         .eq('organization_id', activeOrganizationId);
        } else {
            console.log("[ChatScreen] Fetching DMs in Personal Context");
            // In Personal context, view returns all, filtering happens client-side in processAndCombineData
        }

        query = query.order('last_message_at', { ascending: false });
        const { data, error: fetchError } = await query;

        if (fetchError) {
            console.error('[ChatScreen] Error fetching DM conversations view:', fetchError);
            setDmError('Direktnachrichten konnten nicht geladen werden.');
            return [];
        }

        console.log(`[ChatScreen] Fetched ${data?.length || 0} DM conversations.`);
        setDmConversations(data || []); // Update specific state if needed
        return data || [];

    } catch (err) {
        console.error('[ChatScreen] Unexpected error fetching conversations:', err);
        setDmError('Ein unerwarteter Fehler ist aufgetreten.');
        return [];
    }
  };

  // --- Data Processing and Filtering ---

  const processAndCombineData = (groups, dms) => {
      console.log(`[ChatScreen] Processing ${groups.length} groups and ${dms.length} DMs for context: ${isOrganizationActive ? 'Organization' : 'Personal'}`);
      let combined = [];

      // --- Context-Specific Group Filtering ---
      let filteredGroupsForContext = groups;
      if (isOrganizationActive && activeOrganizationId) {
          const initialGroupCount = groups.length;
          filteredGroupsForContext = groups.filter(group => 
              // Keep only broadcast groups belonging to the active organization
              group.type === 'broadcast' && group.organization_id === activeOrganizationId
          );
          console.log(`[ChatScreen] Organization context group filter applied: ${initialGroupCount} -> ${filteredGroupsForContext.length}`);
      } else {
           // Personal context: Keep all non-bot groups fetched (open and broadcast)
           // Future enhancement: Filter based on user membership if needed.
           console.log(`[ChatScreen] Personal context, keeping all ${groups.length} fetched groups.`);
      }
      // --- End Context-Specific Group Filtering ---

      // Process Filtered Chat Groups
      const processedGroups = filteredGroupsForContext.map(group => { // Use filteredGroupsForContext
          let uiType;
          if (group.type === 'open_group') uiType = 'Offene Gruppen';
          else if (group.type === 'broadcast') uiType = 'Ankündigungen';

          const unreadCount = localUnreadCounts[group.id] !== undefined
              ? localUnreadCounts[group.id]
              : parseInt(group.unread_count) || 0;

          const localMsg = localLastMessages[group.id];
          let lastMessage = group.last_message || '';
          let messageTime = group.last_message_time || '';
          let lastTimestamp = group.last_message_timestamp ? new Date(group.last_message_timestamp).getTime() : 0;
          let senderName = group.last_message_sender_name || null;

          if (localMsg && (!lastTimestamp || localMsg.timestamp > lastTimestamp)) {
              lastMessage = localMsg.text;
              messageTime = localMsg.time;
              lastTimestamp = localMsg.timestamp;
              senderName = null;
          }

          return {
              id: `group-${group.id}`, // Ensure unique keys
              groupId: group.id, // Keep original ID if needed
              name: group.name,
              lastMessage: lastMessage,
              lastMessageSender: senderName,
              time: messageTime,
              lastTimestamp: lastTimestamp,
              unread: unreadCount,
              avatar: null, // Handled in renderAvatar
              type: 'group', // Distinguish type
              uiType: uiType, // For potential filtering/display
              isBot: false,
              isPinned: group.is_pinned || false,
              dbType: group.type,
              organization_id: group.organization_id,
              tags: group.tags || [],
              isOrgConversation: false, // Explicitly false for groups
              itemType: 'group', // Add explicit item type
          };
      });

      // Process Direct Messages
      // Use the original dms data here for filtering before mapping
      let filteredDmsForContext = dms;
      if (!isOrganizationActive) {
         const initialDmCount = dms.length;
         // Filter the raw dms data first based on initiator_id
         filteredDmsForContext = dms.filter(dm => 
            !dm.is_org_conversation || (dm.is_org_conversation && dm.initiator_id === user?.id)
         );
         console.log(`[ChatScreen] Personal context DM filter applied: ${initialDmCount} -> ${filteredDmsForContext.length}`);
      }

      // Now map the filtered DMs
      const processedDms = filteredDmsForContext.map(dm => {
           const isOrg = dm.is_org_conversation;
           const targetName = dm.target_name || (isOrg ? 'Organisation' : 'Unbekannter Benutzer');
           const lastTimestamp = dm.last_message_at ? new Date(dm.last_message_at).getTime() : 0;

          return {
              id: `dm-${dm.conversation_id}`, // Ensure unique keys
              conversationId: dm.conversation_id,
              name: targetName,
              lastMessage: dm.last_message_text || (dm.last_message_image_url ? 'Bild gesendet' : 'Keine Nachrichten'),
              lastMessageSenderId: dm.last_message_sender_id,
              lastMessageSenderName: dm.last_message_sender_name, // Use if available
              time: dm.last_message_time || '',
              lastTimestamp: lastTimestamp,
              unread: 0, // TODO: Implement unread count for DMs if needed
              avatar: dm.logo_url, // Use logo if available (for orgs)
              type: 'dm', // Distinguish type
              uiType: isOrg ? 'Organisations-DM' : 'Direktnachricht',
              isBot: false, // DMs are not bots
              isPinned: false, // DMs are not pinnable currently
              dbType: 'direct_message', // Custom type
              organization_id: isOrg ? dm.organization_id : null,
              tags: [], // DMs don't have tags
              isOrgConversation: isOrg,
              otherUserId: isOrg ? null : dm.other_user_id, // Need this for navigation
              itemType: 'dm', // Add explicit item type
          };
      });

      combined = [...processedGroups, ...processedDms];

      // Sort combined list: Pinned items first, then by last message timestamp (descending)
      combined.sort((a, b) => {
          // Pinned items come first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;

          // If both are pinned or both are unpinned, sort by timestamp
          return (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
      });

      console.log(`[ChatScreen] Combined list size after sorting: ${combined.length}`);
      return combined;
  };

  // Update local unread count for a specific chat group
  const updateLocalUnreadCount = async (groupId) => {
    try {
      const updatedCounts = { ...localUnreadCounts, [groupId]: 0 };
      setLocalUnreadCounts(updatedCounts);
      await AsyncStorage.setItem('localUnreadCounts', JSON.stringify(updatedCounts));

      // Update the combined list state directly
      setCombinedList(prevList =>
        prevList.map(item =>
          item.itemType === 'group' && item.groupId === groupId
            ? { ...item, unread: 0 }
            : item
        )
      );
      // Also update the filtered list if necessary
      setFilteredList(prevList =>
          prevList.map(item =>
              item.itemType === 'group' && item.groupId === groupId
                  ? { ...item, unread: 0 }
                  : item
          )
      );

    } catch (err) {
      console.error('[ChatScreen] Error updating local unread count:', err);
    }
  };

  // Listen for filter selection from FilterButtons component
  useEffect(() => {
    filterCombinedList(activeFilter, combinedList);
  }, [activeFilter, combinedList]); // Depend on combinedList

  // Filter combined list based on selected filter
  const filterCombinedList = (filter, listToFilter) => {
      console.log(`[ChatScreen] Filtering list by: ${filter}`);
      if (filter === 'Alle') {
          setFilteredList(listToFilter);
      } else {
          const filtered = listToFilter.filter(item => {
              if (item.itemType === 'group') {
                  // Group filtering logic
                  if (filter === 'Offene Gruppen') return item.dbType === 'open_group';
                  if (filter === 'Ankündigungen') return item.dbType === 'broadcast';
                  return item.tags && item.tags.includes(filter);
              } else if (item.itemType === 'dm') {
                  // DM filtering logic (Currently DMs are always shown if filter is not 'Alle')
                  // If specific DM filters are needed, add logic here.
                  // For now, DMs pass through any filter except 'Alle'.
                  // If filter is 'Offene Gruppen' or 'Ankündigungen', DMs should be excluded.
                  return filter !== 'Offene Gruppen' && filter !== 'Ankündigungen';
              }
              return false; // Exclude unknown item types
          });
          setFilteredList(filtered);
      }
  };

  // --- Rendering ---

  const renderAvatar = (item) => {
      // DM Avatars
      if (item.itemType === 'dm') {
          if (item.isOrgConversation) {
              // Org DM Avatar
              return (
                  <View style={[styles.avatarPlaceholder, styles.orgDmAvatar]}>
                      <Ionicons name="business-outline" size={24} color="#fff" />
                  </View>
              );
          } else {
              // User DM Avatar
              return (
                  <View style={[styles.avatarPlaceholder, styles.userDmAvatar]}>
                      <Text style={styles.avatarLetter}>
                          {item.name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                  </View>
              );
          }
      }

      // Group Avatars (Existing Logic)
      if (item.avatar) { // Assuming groups might have avatars eventually
          return <Image source={{ uri: item.avatar }} style={styles.avatar} />;
      }
      // Placeholder for Groups
      return (
          <View style={[styles.avatarPlaceholder, item.isBot ? styles.botAvatar : styles.groupAvatar]}>
              <Text style={styles.avatarLetter}>
                  {item.isBot ? 'AI' : item.name?.charAt(0).toUpperCase() || 'G'}
              </Text>
          </View>
      );
  };

  const renderDorfbotItem = () => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('Dorfbot')}
    >
      <View style={[styles.avatarPlaceholder, styles.botAvatar]}>
        <Text style={styles.avatarLetter}>AI</Text>
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTopLine}>
          <Text style={styles.chatName}>Dorfbot - KI Assistent</Text>
          <Text style={styles.chatTime}></Text>
        </View>
        <View style={styles.chatBottomLine}>
          <Text style={styles.chatMessage} numberOfLines={1}>
            Frag mich etwas über dein Dorf!
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderChatItem = ({ item }) => {
    // Determine display message based on item type and sender
    let displayMessage = item.lastMessage;
    if (item.itemType === 'group') {
        // Group message display logic
        if (item.lastMessage && item.lastMessageSender) {
            if (user && item.lastMessageSender === displayName) {
                displayMessage = `Du: ${item.lastMessage}`;
            } else {
                displayMessage = `${item.lastMessageSender}: ${item.lastMessage}`;
            }
        } else if (item.lastMessage && item.dbType === 'broadcast') {
            displayMessage = item.lastMessage; // No sender prefix for broadcast
        }
    } else if (item.itemType === 'dm') {
        // DM message display logic
        const isMyLastMessage = item.lastMessageSenderId === user?.id;
        if (isMyLastMessage) {
            displayMessage = `Du: ${item.lastMessage}`;
        } else if (item.isOrgConversation) {
             displayMessage = `${item.name}: ${item.lastMessage}`;
        } 
        // User-to-user DMs received from others: show base message (no prefix needed)
        // This case is implicitly handled if none of the above conditions are met.
    }

    const handlePress = () => {
        if (item.itemType === 'group') {
             if (item.isBot || item.dbType === 'bot') { // Handle potential bot groups
                 navigation.navigate('Dorfbot');
             } else {
                 navigation.navigate('ChatDetail', {
                     chatGroup: { // Pass data compatible with ChatDetail
                         id: item.groupId,
                         name: item.name,
                         dbType: item.dbType, // Ensure dbType is passed correctly
                         organization_id: item.organization_id,
                         isPinned: item.isPinned, // Pass isPinned status as well
                     },
                     onReturn: () => updateLocalUnreadCount(item.groupId)
                 });
             }
        } else if (item.itemType === 'dm') {
            navigation.navigate('DirectMessageDetail', {
                conversationId: item.conversationId,
                recipientId: item.isOrgConversation ? null : item.otherUserId,
                organizationId: item.isOrgConversation ? item.organization_id : null,
                recipientName: item.name,
                isOrgConversation: item.isOrgConversation,
                // Pass timestamp or similar if unread count update is needed for DMs
            });
        }
    };

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={handlePress}
      >
        {renderAvatar(item)}
        <View style={styles.chatInfo}>
          <View style={styles.chatTopLine}>
            <View style={styles.chatNameContainer}>
              {item.isPinned && item.itemType === 'group' && ( // Only show pin for groups
                <Ionicons name="pin" size={16} color="#666" style={styles.pinIcon} />
              )}
              <Text style={styles.chatName}>{item.name}</Text>
            </View>
            <Text style={styles.chatTime}>{item.time}</Text>
          </View>
          <View style={styles.chatBottomLine}>
            <Text style={styles.chatMessage} numberOfLines={1}>
              {displayMessage || 'Keine Nachrichten'}
            </Text>
            {/* Conditionally render unread badge only for groups for now */}
            {item.itemType === 'group' && item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
             {/* TODO: Add unread badge logic for DMs if implemented */}
             {item.itemType === 'dm' && item.unread > 0 && (
               <View style={[styles.unreadBadge, styles.dmUnreadBadge]}>
                 <Text style={styles.unreadText}>{item.unread}</Text>
               </View>
             )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderChatList = () => {
    // Combine loading states
    const showLoading = isLoading || isLoadingFilters || isLoadingDms;
    // Combine error states (prioritize general error)
    const displayError = error || dmError;

    if (showLoading && combinedList.length === 0) { // Show loading only if list is empty
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Lade Chats & Nachrichten...</Text>
            </View>
        );
    }

    if (displayError && combinedList.length === 0) { // Show error only if list is empty
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
                <Text style={styles.errorText}>{displayError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                    <Text style={styles.retryButtonText}>Erneut versuchen</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Handle logged out state
     if (!user && !showLoading) {
        return (
             <View style={styles.centerMessageContainer}>
                <Ionicons name="lock-closed-outline" size={40} color="#888" />
                <Text style={styles.centerMessageText}>Bitte melde dich an, um deine Chats und Nachrichten zu sehen.</Text>
                <TouchableOpacity style={styles.buttonLink} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.buttonLinkText}>Zum Profil</Text>
                </TouchableOpacity>
            </View>
        );
    }

     // Handle offline state
    if (isOfflineMode && !showLoading) {
         return (
            <View style={styles.centerMessageContainer}>
                <Ionicons name="cloud-offline-outline" size={40} color="#888" />
                <Text style={styles.centerMessageText}>Chats und Direktnachrichten sind offline nicht verfügbar.</Text>
            </View>
        );
    }

    return (
      <FlatList
        data={filteredList}
        renderItem={renderChatItem}
        keyExtractor={item => item.id.toString()}
        style={styles.chatList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={showLoading}
        onRefresh={fetchData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
             {/* Show specific message if filtered list is empty */}
             {displayError ? (
                 <Text style={styles.emptyText}>{displayError}</Text> // Show error if filtering resulted in empty but error exists
             ) : (
                <Text style={styles.emptyText}>
                  {activeFilter === 'Alle' ? 'Keine Chats oder Nachrichten gefunden.' : `Keine Einträge für Filter "${activeFilter}" gefunden.`}
                </Text>
             )}
          </View>
        }
      />
    );
  };

  // Determine FAB action based on context
  const handleAddButtonPress = () => {
      if (isOrganizationActive) {
          // Navigate to Create Broadcast Group screen
          navigation.navigate('ManageBroadcastGroups'); // Use the renamed screen
      } else {
          // Navigate to New Direct Message screen
          navigation.navigate('NewDirectMessage');
      }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        filters={chatFilters}
        onFilterChange={setActiveFilter}
        title={isOrganizationActive ? `Chats (${activeOrganization?.name || 'Org'})` : "Meine Chats"}
      />

      {/* Dorfbot always at the top */}
      {renderDorfbotItem()}

      {/* Other chat groups and DMs */}
      {renderChatList()}

      {/* Show Add button based on context and user status */}
      {user && !isOfflineMode && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddButtonPress}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  chatList: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  listContent: {
    paddingBottom: Platform.OS === 'ios' ? 90 : 80,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupAvatar: {
    backgroundColor: '#4285F4',
  },
  botAvatar: {
    backgroundColor: '#34A853',
  },
  userDmAvatar: {
    backgroundColor: '#EA4335',
  },
  orgDmAvatar: {
    backgroundColor: '#fbbc05',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
    flexShrink: 1,
    marginRight: 5,
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
  chatNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
    marginRight: 5,
  },
  chatTime: {
    fontSize: 12,
    color: '#888',
    whiteSpace: 'nowrap',
  },
  chatMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#4285F4',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
   dmUnreadBadge: {
    backgroundColor: '#EA4335',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
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
    paddingVertical: 50,
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
    marginTop: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
  pinIcon: {
    marginRight: 5,
  },
  centerMessageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
  },
  centerMessageText: {
      marginTop: 15,
      color: '#666',
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 20,
  },
  buttonLink: {
      backgroundColor: '#4285F4',
      paddingVertical: 10,
      paddingHorizontal: 25,
      borderRadius: 5,
  },
  buttonLinkText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 15,
  },
});

export default ChatScreen; 