import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, ActivityIndicator, Alert } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  fetchChatGroupTags,
  fetchChatGroupListings,
  fetchUnreadCounts,
} from '../services/chatService';
import {
  fetchDmConversations,
  searchUsersByDisplayName,
  findOrCreateUserDmConversation,
} from '../services/dmService';
import { fetchProfileAvatars } from '../services/profileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAppConfig } from '../context/AppConfigContext';

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl; // Return original if not a valid Supabase Storage URL or already transformed
  }
  // Prevent double transformation
  if (originalUrl.includes('/render/image/public/')) {
      return originalUrl;
  }
  // Replace the path segment and add transform parameters
  return originalUrl.replace('/object/public/', '/render/image/public/') + '?width=100&height=100&resize=cover&quality=60'; // Smaller size for list avatar
};

// Helper to interpret boolean-like env values
const isTrue = (val) => val === true || val === 'true' || val === '1';

const ChatScreen = ({ navigation, route }) => {
  const { isOrganizationActive, activeOrganizationId, activeOrganization } = useOrganization();
  const { user, profile: currentUserProfile, displayName } = useAuth();
  const { isOfflineMode, isConnected } = useNetwork();

  // Remote configuration
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();

  // Feature toggles driven by remote config with env/extra fallback
  const disableChat = appConfigLoading
    ? (isTrue(process.env.EXPO_PUBLIC_DISABLE_CHAT) || isTrue(Constants?.expoConfig?.extra?.disableChat))
    : isTrue(appConfig.EXPO_PUBLIC_DISABLE_CHAT);

  const disableDorfbot = appConfigLoading
    ? (isTrue(process.env.EXPO_PUBLIC_DISABLE_DORFBOT) || isTrue(Constants?.expoConfig?.extra?.disableDorfbot))
    : isTrue(appConfig.EXPO_PUBLIC_DISABLE_DORFBOT);

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
  // Search query state
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingDms, setIsLoadingDms] = useState(true);
  const [dmError, setDmError] = useState(null);

  // Global user search state (search by display name like NewDirectMessageScreen)
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchError, setUserSearchError] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState(null);

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
        const { data, error: filterError } = await fetchChatGroupTags();

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
    if (!user || !currentUserProfile) {
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
        const [groupsResult, dmsResult, unreadResult] = await Promise.all([
            fetchChatGroupsInternal(),
            fetchDirectMessagesInternal(),
            user ? fetchUnreadCounts() : Promise.resolve({ data: null, error: null }),
        ]);

        // Build server-side unread counts map
        let serverUnreadMap = {};
        if (unreadResult?.data && Array.isArray(unreadResult.data)) {
          unreadResult.data.forEach(row => {
            const key = row.item_type === 'chat_group' ? row.item_id : `dm-${row.item_id}`;
            serverUnreadMap[key] = Number(row.unread_count) || 0;
          });
        }

        // Combine and process results (initial pass without user avatars)
        let combinedInitial = processAndCombineData(groupsResult, dmsResult, currentUserProfile.blocked || [], serverUnreadMap);
        setCombinedList(combinedInitial);

        // --- Fetch missing user avatars ---
        const combinedWithAvatars = await fetchAvatarsForUserDms(combinedInitial);
        setCombinedList(combinedWithAvatars); // Update state again with avatars
        // --- End Fetch missing user avatars ---

        filterCombinedList(activeFilter, combinedWithAvatars); // Apply filter to the final list

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
  }, [user, currentUserProfile, isOfflineMode, isOrganizationActive, activeOrganizationId, activeFilter, localUnreadCounts, localLastMessages]);

  // Fetch data on initial load and when context/user changes
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Use the useCallback dependency

  // Fetch on focus
  useEffect(() => {
      const unsubscribeFocus = navigation.addListener('focus', () => {
          // console.log('[ChatScreen] Focused, refetching data...');
          if (!isOfflineMode && user) {
              fetchData(); // Use the combined fetch function
          } else {
              filterCombinedList(activeFilter, combinedList);
          }
      });
      return unsubscribeFocus;
  }, [navigation, isOfflineMode, user, fetchData, activeFilter, combinedList]); // Add dependencies

  // --- Internal Fetch Functions ---

  const fetchChatGroupsInternal = async () => {
    // console.log("[ChatScreen] Fetching chat groups...");
    try {
      const { data, error: fetchError } = await fetchChatGroupListings();

      if (fetchError) {
        console.error('[ChatScreen] Error fetching chat groups:', fetchError);
        setError('Chat-Gruppen konnten nicht geladen werden.');
        return []; // Return empty array on error
      }
      // console.log(`[ChatScreen] Fetched ${data?.length || 0} chat groups.`);
      setChatGroups(data || []); // Update specific state if needed
      return data || [];
    } catch (err) {
      console.error('[ChatScreen] Unexpected error fetching chat groups:', err);
      setError('Unerwarteter Fehler beim Laden der Chat-Gruppen.');
      return [];
    }
  };

  const fetchDirectMessagesInternal = async () => {
    // console.log("[ChatScreen] Fetching direct messages...");
    if (!user) {
        // console.log("[ChatScreen] No user, skipping DM fetch.");
        setDmError("Bitte anmelden.");
        return [];
    }
    if (isOfflineMode) {
        // console.log("[ChatScreen] Offline mode, skipping DM fetch.");
        setDmError("DMs offline nicht verfügbar.");
        return [];
    }

    try {
        const { data, error: fetchError } = await fetchDmConversations({
            isOrgContext: isOrganizationActive && !!activeOrganizationId,
            organizationId: activeOrganizationId,
        });

        if (fetchError) {
            console.error('[ChatScreen] Error fetching DM conversations view:', fetchError);
            setDmError('Direktnachrichten konnten nicht geladen werden.');
            return [];
        }

        // console.log(`[ChatScreen] Fetched ${data?.length || 0} DM conversations.`);
        if (data && data.length > 0) {
            // console.log('[ChatScreen] First DM data:', data[0]);
        }
        setDmConversations(data || []);
        return data || [];

    } catch (err) {
        console.error('[ChatScreen] Unexpected error fetching conversations:', err);
        setDmError('Ein unerwarteter Fehler ist aufgetreten.');
        return [];
    }
  };

  // --- Data Processing and Filtering ---

  const processAndCombineData = (groups, dms, blockedIds, serverUnreadMap = {}) => {
      // console.log(`[ChatScreen] Processing ${groups.length} groups and ${dms.length} DMs for context: ${isOrganizationActive ? 'Organization' : 'Personal'}`);
      let combined = [];

      // --- Context-Specific Group Filtering ---
      let filteredGroupsForContext = groups;
      if (isOrganizationActive && activeOrganizationId) {
          const initialGroupCount = groups.length;
          filteredGroupsForContext = groups.filter(group => 
              group.type === 'broadcast' && group.organization_id === activeOrganizationId
          );
          // console.log(`[ChatScreen] Organization context group filter applied: ${initialGroupCount} -> ${filteredGroupsForContext.length}`);
      } else {
           // console.log(`[ChatScreen] Personal context, keeping all ${groups.length} fetched groups.`);
      }
      // --- End Context-Specific Group Filtering ---

      // Process Filtered Chat Groups
      const processedGroups = filteredGroupsForContext.map(group => {
          let uiType;
          if (group.type === 'open_group') uiType = 'Offene Gruppen';
          else if (group.type === 'broadcast') uiType = 'Ankündigungen';

          // Prefer server-side unread count, fall back to local tracking
          const serverUnread = serverUnreadMap[group.id];
          const unreadCount = localUnreadCounts[group.id] !== undefined
              ? localUnreadCounts[group.id]
              : (serverUnread !== undefined ? serverUnread : (parseInt(group.unread_count) || 0));

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
              id: `group-${group.id}`,
              groupId: group.id,
              name: group.name,
              lastMessage: lastMessage,
              lastMessageSender: senderName,
              time: messageTime,
              lastTimestamp: lastTimestamp,
              unread: unreadCount,
              avatarUrl: null,
              type: 'group',
              uiType: uiType,
              isBot: false,
              isPinned: group.is_pinned || false,
              dbType: group.type,
              organization_id: group.organization_id,
              tags: group.tags || [],
              isOrgConversation: false,
              itemType: 'group',
          };
      });

      // Process Direct Messages
      let filteredDmsForContext = dms;
      if (!isOrganizationActive) {
         const initialDmCount = dms.length;
         filteredDmsForContext = dms.filter(dm => 
            !dm.is_org_conversation || (dm.is_org_conversation && dm.initiator_id === user?.id)
         );
         // console.log(`[ChatScreen] Personal context DM filter applied: ${initialDmCount} -> ${filteredDmsForContext.length}`);
      }

      // Filter out blocked DMs
      const blockedSet = new Set(blockedIds || []);
      const unblockedDms = filteredDmsForContext.filter(dm => {
          if (dm.is_org_conversation) {
              return !blockedSet.has(dm.organization_id);
          } else {
              return !blockedSet.has(dm.other_user_id);
          }
      });
      // console.log(`[ChatScreen] Filtering blocked DMs: ${filteredDmsForContext.length} -> ${unblockedDms.length}`);

      const processedDms = unblockedDms.map(dm => {
           const isOrg = dm.is_org_conversation;
           const targetName = dm.target_name || (isOrg ? 'Organisation' : 'Unbekannter Benutzer');
           const lastTimestamp = dm.last_message_at ? new Date(dm.last_message_at).getTime() : 0;

           let displayMessage = dm.last_message_text || (dm.last_message_image_url ? 'Bild gesendet' : 'Keine Nachrichten');
           const isMyLastMessage = dm.last_message_sender_id === user?.id;

           if (isMyLastMessage) {
               displayMessage = `Du: ${displayMessage}`;
           } else if (isOrg && dm.last_message_sender_name) {
               displayMessage = `${dm.last_message_sender_name}: ${displayMessage}`;
           }

          // Get server-side DM unread count
          const dmServerUnread = serverUnreadMap[`dm-${dm.conversation_id}`] || 0;

          return {
              id: `dm-${dm.conversation_id}`,
              conversationId: dm.conversation_id,
              name: targetName,
              lastMessage: displayMessage,
              lastMessageSenderId: dm.last_message_sender_id,
              lastMessageSenderName: dm.last_message_sender_name,
              time: dm.last_message_time || '',
              lastTimestamp: lastTimestamp,
              unread: dmServerUnread,
              avatarUrl: isOrg ? dm.logo_url : null,
              type: 'dm',
              uiType: isOrg ? 'Organisations-DM' : 'Direktnachricht',
              isBot: false,
              isPinned: false,
              dbType: 'direct_message',
              organization_id: isOrg ? dm.organization_id : null,
              otherUserId: isOrg ? null : dm.other_user_id,
              tags: [],
              isOrgConversation: isOrg,
              itemType: 'dm',
          };
      });

      combined = [...processedGroups, ...processedDms];

      // Sort combined list
      combined.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
      });

      // console.log(`[ChatScreen] Combined list size after sorting and blocking filter: ${combined.length}`);
      return combined;
  };

  // Update local unread count for a specific chat group
  const updateLocalUnreadCount = async (groupId) => {
    try {
      const updatedCounts = { ...localUnreadCounts, [groupId]: 0 };
      setLocalUnreadCounts(updatedCounts);
      await AsyncStorage.setItem('localUnreadCounts', JSON.stringify(updatedCounts));

      setCombinedList(prevList =>
        prevList.map(item =>
          item.itemType === 'group' && item.groupId === groupId
            ? { ...item, unread: 0 }
            : item
        )
      );
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
  }, [activeFilter, combinedList, searchQuery]); // Depend on combinedList and search query

  // --- User Search (by display name) like in NewDirectMessageScreen ---
  const fetchAvatarsForSearchResults = async (results) => {
      if (!results || results.length === 0) {
          return results;
      }

      const userIdsToFetch = results.map(user => user.id);
      try {
          const { data: profilesData, error: profilesError } = await fetchProfileAvatars(userIdsToFetch);

          if (profilesError) {
              console.error('[ChatScreen] Error fetching profiles for avatars (search results):', profilesError);
              return results;
          }

          const avatarMap = profilesData.reduce((map, profile) => {
              map[profile.id] = profile.avatar_url;
              return map;
          }, {});

          return results.map(user => ({
              ...user,
              avatar_url: avatarMap[user.id] || null,
          }));
      } catch (fetchErr) {
          console.error('[ChatScreen] Unexpected error in fetchAvatarsForSearchResults:', fetchErr);
          return results;
      }
  };

  const searchUsers = async (query) => {
      const q = (query || '').trim();
      if (!q || q.length < 3) {
          setUserSearchResults([]);
          setUserSearchError(null);
          setIsSearchingUsers(false);
          return;
      }
      if (!user) {
          setUserSearchError('Bitte melde dich an, um Benutzer zu suchen.');
          setIsSearchingUsers(false);
          setUserSearchResults([]);
          return;
      }
      if (isOfflineMode) {
          setUserSearchError('Benutzersuche ist offline nicht verfügbar.');
          setIsSearchingUsers(false);
          setUserSearchResults([]);
          return;
      }

      setIsSearchingUsers(true);
      setUserSearchError(null);
      try {
          const { data, error: rpcError } = await searchUsersByDisplayName(q);
          if (rpcError) {
              console.error('[ChatScreen] Error searching users via RPC:', rpcError);
              setUserSearchError('Benutzer konnten nicht gesucht werden.');
              setUserSearchResults([]);
          } else if (data) {
              const resultsWithAvatars = await fetchAvatarsForSearchResults(data);
              setUserSearchResults(resultsWithAvatars);
          } else {
              setUserSearchResults([]);
          }
      } catch (err) {
          console.error('[ChatScreen] Unexpected error searching users:', err);
          setUserSearchError('Ein unerwarteter Fehler ist aufgetreten.');
          setUserSearchResults([]);
      } finally {
          setIsSearchingUsers(false);
      }
  };

  const startDirectMessage = async (target) => {
      if (loadingConversation) return;
      setSelectedTargetId(target.id);
      setLoadingConversation(true);
      try {
          if (!user) {
              Alert.alert('Hinweis', 'Bitte melde dich an, um Nachrichten zu senden.');
              return;
          }
          if (isOfflineMode) {
              Alert.alert('Hinweis', 'Nachrichten sind offline nicht verfügbar.');
              return;
          }
          const { data: conversationId, error: rpcError } = await findOrCreateUserDmConversation(target.id);
          if (rpcError || !conversationId) {
              console.error('[ChatScreen] Error finding/creating user DM conversation:', rpcError);
              Alert.alert('Fehler', 'Konversation konnte nicht gestartet werden: ' + (rpcError?.message || 'Unbekannter RPC Fehler'));
              return;
          }
          navigation.navigate('DirectMessageDetail', {
              conversationId: conversationId,
              recipientId: target.id,
              organizationId: null,
              recipientName: target.display_name,
              isOrgConversation: false,
          });
      } catch (err) {
          console.error('[ChatScreen] Error handling startDirectMessage:', err);
          Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      } finally {
          setLoadingConversation(false);
          setSelectedTargetId(null);
      }
  };

  // Trigger user search when searchQuery changes
  useEffect(() => {
      const q = (searchQuery || '').trim();
      if (q.length >= 3) {
          searchUsers(q);
      } else {
          setUserSearchResults([]);
          setUserSearchError(null);
          setIsSearchingUsers(false);
      }
  }, [searchQuery, user, isOfflineMode]);

  // Filter combined list based on selected filter
  const filterCombinedList = (filter, listToFilter) => {
      // console.log(`[ChatScreen] Filtering list by: ${filter}`);
      let resultList = [];
      if (filter === 'Alle') {
          resultList = listToFilter;
      } else {
          resultList = listToFilter.filter(item => {
              if (item.itemType === 'group') {
                  if (filter === 'Offene Gruppen') return item.dbType === 'open_group';
                  if (filter === 'Ankündigungen') return item.dbType === 'broadcast';
                  return item.tags && item.tags.includes(filter);
              } else if (item.itemType === 'dm') {
                  return filter !== 'Offene Gruppen' && filter !== 'Ankündigungen';
              }
              return false;
          });
      }

      // --- Apply search filter ---
      if (searchQuery && searchQuery.trim() !== '') {
          const q = searchQuery.trim().toLowerCase();
          resultList = resultList.filter(item => {
              return (item.name || '').toLowerCase().includes(q) ||
                     (item.lastMessage || '').toLowerCase().includes(q);
          });
      }

      setFilteredList(resultList);
  };

  // --- Rendering ---

  const renderAvatar = (item) => {
      const transformedUrl = item.avatarUrl ? getTransformedImageUrl(item.avatarUrl) : null;

      // DM Avatars
      if (item.itemType === 'dm') {
          if (transformedUrl) {
              return <Image source={{ uri: transformedUrl }} style={styles.avatar} />;
          } else if (item.isOrgConversation) {
              // Org DM Placeholder
              return (
                  <View style={[styles.avatarPlaceholder, styles.orgDmAvatar]}>
                      <Ionicons name="business-outline" size={24} color="#fff" />
                  </View>
              );
          } else {
              // User DM Placeholder (initials)
              return (
                  <View style={[styles.avatarPlaceholder, styles.userDmAvatar]}>
                      <Text style={styles.avatarLetter}>
                          {item.name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                  </View>
              );
          }
      }

      // Group Avatars
      if (transformedUrl) {
          return <Image source={{ uri: transformedUrl }} style={styles.avatar} />;
      }
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
          <Text style={styles.chatName}>KI Assistent</Text>
          <Text style={styles.chatTime}></Text>
        </View>
        <View style={styles.chatBottomLine}>
          <Text style={styles.chatMessage} numberOfLines={1}>
            Frag mich etwas über dein Ort!
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderChatItem = ({ item }) => {
    let displayMessage = item.lastMessage;
    if (item.itemType === 'group') {
        if (item.lastMessage && item.lastMessageSender) {
             const isMyGroupLastMessage = user && item.lastMessageSender === displayName;
             if (isMyGroupLastMessage) {
                 displayMessage = `Du: ${item.lastMessage}`;
             } else {
                 displayMessage = `${item.lastMessageSender}: ${item.lastMessage}`;
             }
        } else if (item.lastMessage && item.dbType === 'broadcast') {
            displayMessage = item.lastMessage;
        }
    } else if (item.itemType === 'dm') {
        displayMessage = item.lastMessage;
    }

    const handlePress = () => {
        if (item.itemType === 'group') {
             if (item.isBot || item.dbType === 'bot') {
                 navigation.navigate('Dorfbot');
             } else {
                 navigation.navigate('ChatDetail', {
                     chatGroup: {
                         id: item.groupId,
                         name: item.name,
                         dbType: item.dbType,
                         organization_id: item.organization_id,
                         isPinned: item.isPinned,
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
              {item.isPinned && item.itemType === 'group' && (
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
            {item.itemType === 'group' && item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
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
    const showLoading = isLoading || isLoadingFilters || isLoadingDms;
    const displayError = error || dmError;

    if (showLoading && combinedList.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Lade Chats & Nachrichten...</Text>
            </View>
        );
    }

    if (displayError && combinedList.length === 0) {
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
        ListHeaderComponent={
          searchQuery && searchQuery.trim().length >= 3 ? (
            <View style={styles.searchResultsContainer}>
              <Text style={styles.sectionTitle}>Benutzer</Text>
              {isSearchingUsers ? (
                <View style={styles.listLoadingContainer}> 
                  <ActivityIndicator size="small" color="#4285F4" />
                  <Text style={styles.loadingText}>Suche Benutzer...</Text>
                </View>
              ) : userSearchError ? (
                <View style={styles.inlineErrorContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color="#ff3b30" />
                  <Text style={styles.inlineErrorText}>{userSearchError}</Text>
                </View>
              ) : userSearchResults.length > 0 ? (
                <FlatList
                  data={userSearchResults}
                  renderItem={renderUserSearchItem}
                  keyExtractor={(item) => `user-${item.id}`}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyText}>Keine Benutzer für "{searchQuery}" gefunden.</Text>
                </View>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
             {displayError ? (
                 <Text style={styles.emptyText}>{displayError}</Text>
             ) : disableChat ? (
                 <Text style={styles.emptyText}>
                   Hier kannst du anderen Nutzer:innen aus der App Direktnachrichten senden. Tippe dafür entweder auf ihren Namen unter einem Beitrag oder klicke unten rechts auf das blaue "+"-Symbol, um eine neue Unterhaltung zu starten.
                 </Text>
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

  const renderUserSearchItem = ({ item }) => {
      const transformedUrl = item.avatar_url ? getTransformedImageUrl(item.avatar_url) : null;
      return (
          <TouchableOpacity
              style={styles.chatItem}
              onPress={() => startDirectMessage(item)}
              disabled={loadingConversation}
          >
              {transformedUrl ? (
                  <Image source={{ uri: transformedUrl }} style={styles.avatar} />
              ) : (
                  <View style={[styles.avatarPlaceholder, styles.userDmAvatar]}>
                      <Text style={styles.avatarLetter}>
                          {item.display_name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                  </View>
              )}
              <View style={styles.chatInfo}>
                  <View style={styles.chatTopLine}>
                      <Text style={styles.chatName}>{item.display_name || 'Unbekannter Benutzer'}</Text>
                  </View>
                  <View style={styles.chatBottomLine}>
                      <Text style={styles.chatMessage} numberOfLines={1}>{item.last_message || ''}</Text>
                      {loadingConversation && selectedTargetId === item.id && (
                          <ActivityIndicator size="small" color="#4285F4" style={styles.itemLoadingIndicator} />
                      )}
                  </View>
              </View>
          </TouchableOpacity>
      );
  };

  const handleAddButtonPress = () => {
      if (isOrganizationActive) {
          navigation.navigate('ManageBroadcastGroups');
      } else {
          navigation.navigate('NewDirectMessage');
      }
  };

  const fetchAvatarsForUserDms = async (dmList) => {
      const userDmsNeedingAvatars = dmList.filter(dm => dm.itemType === 'dm' && !dm.isOrgConversation && dm.otherUserId && !dm.avatarUrl);
      if (userDmsNeedingAvatars.length === 0) {
          return dmList;
      }

      const userIdsToFetch = [...new Set(userDmsNeedingAvatars.map(dm => dm.otherUserId))];
      // console.log(`[ChatScreen] Fetching avatars for ${userIdsToFetch.length} other users.`);

      try {
          const { data: profilesData, error: profilesError } = await fetchProfileAvatars(userIdsToFetch);

          if (profilesError) {
              console.error('[ChatScreen] Error fetching profiles for avatars:', profilesError);
              return dmList;
          }

          const avatarMap = profilesData.reduce((map, profile) => {
              map[profile.id] = profile.avatar_url;
              return map;
          }, {});

          return dmList.map(dm => {
              if (dm.itemType === 'dm' && !dm.isOrgConversation && dm.otherUserId && avatarMap[dm.otherUserId]) {
                  return { ...dm, avatarUrl: avatarMap[dm.otherUserId] };
              }
              return dm;
          });

      } catch (fetchErr) {
          console.error('[ChatScreen] Unexpected error in fetchAvatarsForUserDms:', fetchErr);
          return dmList;
      }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        filters={disableChat ? [] : chatFilters}
        onFilterChange={disableChat ? undefined : setActiveFilter}
        title={isOrganizationActive ? `Chats (${activeOrganization?.name || 'Org'})` : "Meine Chats"}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {!disableDorfbot && renderDorfbotItem()}

      {renderChatList()}

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
    // Avoid extra top gap under header/search
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 90 : 80,
  },
  searchResultsContainer: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 8,
    marginBottom: 8,
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
  listLoadingContainer: {
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 50,
  },
  inlineErrorContainer: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineErrorText: {
    marginLeft: 8,
    color: '#ff3b30',
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
  emptyListContainer: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    marginRight: 5,
  },
  itemLoadingIndicator: {
    marginLeft: 'auto',
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