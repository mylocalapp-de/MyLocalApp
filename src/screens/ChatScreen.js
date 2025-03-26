import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatScreen = ({ navigation, route }) => {
  // Use organization context to determine if add button should be shown
  const { isOrganization } = useOrganization();
  const { user } = useAuth();
  
  // State for chat groups and loading
  const [chatGroups, setChatGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Alle');
  const [localUnreadCounts, setLocalUnreadCounts] = useState({});
  const [localLastMessages, setLocalLastMessages] = useState({});

  // Filters for the chat screen
  const chatFilters = ['Alle', 'Offene Gruppen', 'Ankündigungen', 'Vereine', 'Kultur', 'Sport', 'Verkehr'];

  // Listen for navigation events to update unread counts
  useEffect(() => {
    if (route.params?.viewedChatId && route.params?.timestamp) {
      updateLocalUnreadCount(route.params.viewedChatId);
    }
  }, [route.params?.viewedChatId, route.params?.timestamp]);

  // Load local unread counts from AsyncStorage
  useEffect(() => {
    const loadLocalUnreadCounts = async () => {
      try {
        const storedCounts = await AsyncStorage.getItem('localUnreadCounts');
        if (storedCounts) {
          setLocalUnreadCounts(JSON.parse(storedCounts));
        }
        
        // Also load stored last messages
        const storedLastMessages = await AsyncStorage.getItem('chatLastMessages');
        if (storedLastMessages) {
          setLocalLastMessages(JSON.parse(storedLastMessages));
        }
      } catch (err) {
        console.error('Error loading local data:', err);
      }
    };
    
    loadLocalUnreadCounts();
  }, []);
  
  // Also refresh when the screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const loadLocalData = async () => {
        try {
          // Load stored last messages
          const storedLastMessages = await AsyncStorage.getItem('chatLastMessages');
          if (storedLastMessages) {
            const parsedLastMessages = JSON.parse(storedLastMessages);
            setLocalLastMessages(parsedLastMessages);
            
            // Update chat groups with local last messages
            setChatGroups(prevGroups => 
              prevGroups.map(group => {
                const localMsg = parsedLastMessages[group.id];
                if (localMsg && (!group.lastTimestamp || localMsg.timestamp > group.lastTimestamp)) {
                  return {
                    ...group,
                    lastMessage: localMsg.text,
                    time: localMsg.time,
                    lastTimestamp: localMsg.timestamp
                  };
                }
                return group;
              })
            );
          }
        } catch (err) {
          console.error('Error loading local message data:', err);
        }
      };
      
      loadLocalData();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Update local unread count for a specific chat
  const updateLocalUnreadCount = async (chatId) => {
    try {
      // Set unread count to 0 for the viewed chat
      const updatedCounts = {
        ...localUnreadCounts,
        [chatId]: 0
      };
      
      setLocalUnreadCounts(updatedCounts);
      await AsyncStorage.setItem('localUnreadCounts', JSON.stringify(updatedCounts));
      
      // Update the chat groups to reflect this change
      setChatGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === chatId 
            ? { ...group, unread: 0 } 
            : group
        )
      );
    } catch (err) {
      console.error('Error updating local unread count:', err);
    }
  };

  // Listen for filter selection from FilterButtons component
  useEffect(() => {
    filterChatGroups(activeFilter);
  }, [activeFilter, chatGroups]);

  // Filter chat groups based on selected filter
  const filterChatGroups = (filter) => {
    if (filter === 'Alle') {
      setFilteredGroups(chatGroups);
    } else if (filter === 'Offene Gruppen') {
      setFilteredGroups(chatGroups.filter(group => group.dbType === 'open_group'));
    } else if (filter === 'Ankündigungen') {
      setFilteredGroups(chatGroups.filter(group => group.dbType === 'broadcast'));
    } else {
      // Filter by tag
      setFilteredGroups(chatGroups.filter(group => 
        group.tags && group.tags.includes(filter)
      ));
    }
  };

  // Fetch chat groups from Supabase
  useEffect(() => {
    fetchChatGroups();
  }, []);

  const fetchChatGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch chat groups from the chat_group_listings view
      const { data, error } = await supabase
        .from('chat_group_listings')
        .select('*')
        .neq('type', 'bot'); // Exclude bots from database query, as Dorfbot is now handled separately
      
      if (error) {
        console.error('Error fetching chat groups:', error);
        setError('Could not load chat groups. Please try again later.');
      } else {
        // Process the data to match the format expected by the component
        const processedData = data.map(group => {
          // Convert database types to UI types
          let uiType;
          if (group.type === 'open_group') {
            uiType = 'Offene Gruppen';
          } else if (group.type === 'broadcast') {
            uiType = 'Ankündigungen'; // Renamed to match filter name
          }
          
          // Get the local unread count if available, otherwise use the server count
          const unreadCount = localUnreadCounts[group.id] !== undefined 
            ? localUnreadCounts[group.id]
            : parseInt(group.unread_count) || 0;
          
          // Check if we have a local last message that's more recent than the server one
          const localMsg = localLastMessages[group.id];
          let lastMessage = group.last_message || '';
          let messageTime = group.last_message_time || '';
          let lastTimestamp = group.last_message_timestamp || 0;
          
          if (localMsg && (!lastTimestamp || localMsg.timestamp > lastTimestamp)) {
            lastMessage = localMsg.text;
            messageTime = localMsg.time;
            lastTimestamp = localMsg.timestamp;
          }
          
          return {
            id: group.id,
            name: group.name,
            lastMessage: lastMessage,
            time: messageTime,
            lastTimestamp: lastTimestamp,
            unread: unreadCount,
            avatar: null,
            type: uiType,
            isBot: false,
            dbType: group.type, // Keep original type for backend operations
            adminId: group.admin_id,
            tags: group.tags || [] // Include tags for filtering
          };
        });
        
        setChatGroups(processedData);
        setFilteredGroups(processedData); // Initially show all groups
      }
    } catch (err) {
      console.error('Unexpected error fetching chat groups:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAvatar = (item) => {
    if (item.avatar) {
      return <Image source={{ uri: item.avatar }} style={styles.avatar} />;
    }
    
    return (
      <View 
        style={[styles.avatarPlaceholder, 
          item.isBot ? styles.botAvatar : {}
        ]}
      >
        <Text style={styles.avatarLetter}>
          {item.isBot ? 'AI' : item.name.charAt(0)}
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

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => {
        // If it's a bot type for some reason, navigate to Dorfbot screen
        if (item.dbType === 'bot' || item.isBot) {
          navigation.navigate('Dorfbot');
        } else {
          // Pass timestamp parameter to trigger unread count update when returning
          navigation.navigate('ChatDetail', { 
            chatGroup: item,
            onReturn: () => updateLocalUnreadCount(item.id)
          });
        }
      }}
    >
      {renderAvatar(item)}
      <View style={styles.chatInfo}>
        <View style={styles.chatTopLine}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <View style={styles.chatBottomLine}>
          <Text style={styles.chatMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderChatList = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Chats werden geladen...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChatGroups}>
            <Text style={styles.retryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <FlatList
        data={filteredGroups}
        renderItem={renderChatItem}
        keyExtractor={item => item.id.toString()}
        style={styles.chatList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={fetchChatGroups}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Keine Chats gefunden</Text>
          </View>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        filters={chatFilters}
        onFilterChange={setActiveFilter}
      />
      
      {/* Dorfbot always at the top */}
      {renderDorfbotItem()}
      
      {/* Divider */}
      <View style={styles.divider} />
      
      {/* Other chat groups */}
      {renderChatList()}
      
      {isOrganization && user && (
        <TouchableOpacity style={styles.addButton}>
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
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  divider: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  botAvatar: {
    backgroundColor: '#34A853',
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
  unreadBadge: {
    backgroundColor: '#4285F4',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 30,
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

export default ChatScreen; 