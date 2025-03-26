import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const ChatScreen = ({ navigation }) => {
  // Use organization context to determine if add button should be shown
  const { isOrganization } = useOrganization();
  const { user } = useAuth();
  
  // State for chat groups and loading
  const [chatGroups, setChatGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Placeholder filters for the chat screen
  const chatFilters = ['Alle', 'Offene Gruppen', 'Behörden', 'Vereine', 'Ungelesen'];

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
        .select('*');
      
      if (error) {
        console.error('Error fetching chat groups:', error);
        setError('Could not load chat groups. Please try again later.');
      } else {
        // Process the data to match the format expected by the component
        const processedData = data.map(group => {
          // Convert database types to UI types
          let uiType;
          if (group.type === 'bot') {
            uiType = 'Behörden'; // Use Behörden for bot as in the placeholder data
          } else if (group.type === 'open_group') {
            uiType = 'Offene Gruppen';
          } else if (group.type === 'broadcast') {
            uiType = 'Vereine'; // Assume broadcasts are from organizations
          }
          
          return {
            id: group.id,
            name: group.name,
            lastMessage: group.last_message || '',
            time: group.last_message_time || '',
            unread: parseInt(group.unread_count) || 0,
            avatar: null,
            type: uiType,
            isBot: group.type === 'bot',
            dbType: group.type, // Keep original type for backend operations
            adminId: group.admin_id
          };
        });
        
        // Sort to ensure Dorfbot is at the top, then by most recent activity
        const sortedData = processedData.sort((a, b) => {
          // Always put Dorfbot first
          if (a.isBot) return -1;
          if (b.isBot) return 1;
          
          // Then sort by time (if available)
          if (a.time && b.time) {
            return 0; // Already sorted by query
          }
          
          return 0;
        });
        
        setChatGroups(sortedData);
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

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => navigation.navigate('ChatDetail', { chatGroup: item })}
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

  return (
    <View style={styles.container}>
      <ScreenHeader filters={chatFilters} />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Chats werden geladen...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChatGroups}>
            <Text style={styles.retryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chatGroups}
          renderItem={renderChatItem}
          keyExtractor={item => item.id.toString()}
          style={styles.chatList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={fetchChatGroups}
        />
      )}
      
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
});

export default ChatScreen; 