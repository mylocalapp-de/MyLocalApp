import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

const ChatScreen = () => {
  // Placeholder filters for the chat screen
  const chatFilters = ['Alle', 'Offene Gruppen', 'Behörden', 'Vereine', 'Ungelesen'];

  // Placeholder chat groups
  const chatGroups = [
    {
      id: 1,
      name: 'Offene Gruppe Straßenbau',
      lastMessage: 'Wann beginnen die Bauarbeiten?',
      time: '12:30',
      unread: 2,
      avatar: null,
      type: 'Offene Gruppen'
    },
    {
      id: 2,
      name: 'Ankündigungen Test e.V.',
      lastMessage: 'Neuer Termin für Sportfest',
      time: '09:45',
      unread: 0,
      avatar: null,
      type: 'Vereine'
    },
    {
      id: 3,
      name: 'Kunsthaus Nachrichten',
      lastMessage: 'Neue Ausstellung ab nächste Woche',
      time: '15:15',
      unread: 5,
      avatar: null,
      type: 'Behörden'
    },
    {
      id: 4,
      name: 'Dorfbot - KI Assistent',
      lastMessage: 'Frag mich über dein Dorf!',
      time: '18:00',
      unread: 0,
      avatar: null,
      type: 'Behörden',
      isBot: true
    }
  ];

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
    <TouchableOpacity style={styles.chatItem}>
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
      
      <FlatList
        data={chatGroups}
        renderItem={renderChatItem}
        keyExtractor={item => item.id.toString()}
        style={styles.chatList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
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
});

export default ChatScreen; 