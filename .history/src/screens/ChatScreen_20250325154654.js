import React from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SearchBar from '../components/SearchBar';
import FilterButtons from '../components/FilterButtons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ChatScreen = () => {
  const filters = ['Alle', 'Gruppen', 'Broadcast', 'KI-Chat'];
  const chatGroups = [
    {
      title: 'Allgemeine Offene Gruppe',
      type: 'group',
      lastMessage: 'Was ist los am Wochenende?',
      time: '10:30',
    },
    {
      title: 'Neue Feuerwehr Geräte',
      type: 'broadcast',
      lastMessage: 'Neue Ausrüstung ist eingetroffen...',
      time: '09:15',
    },
    {
      title: 'Offene Gruppe Strohkirchen',
      type: 'group',
      lastMessage: 'Treffen heute um 19 Uhr',
      time: '08:45',
    },
    {
      title: 'Dorf-KI Assistent',
      type: 'ai',
      lastMessage: 'Frag mich alles über das Dorf!',
      time: '',
    },
  ];

  const getIconName = (type) => {
    switch (type) {
      case 'group':
        return 'account-group';
      case 'broadcast':
        return 'bullhorn';
      case 'ai':
        return 'robot';
      default:
        return 'chat';
    }
  };

  return (
    <View style={styles.container}>
      <SearchBar placeholder="Chat oder Gruppe suchen..." />
      <FilterButtons filters={filters} />
      <ScrollView style={styles.content}>
        {chatGroups.map((chat, index) => (
          <TouchableOpacity key={index} style={styles.chatCard}>
            <Icon
              name={getIconName(chat.type)}
              size={24}
              color="#007AFF"
              style={styles.chatIcon}
            />
            <View style={styles.chatInfo}>
              <Text style={styles.chatTitle}>{chat.title}</Text>
              <Text style={styles.lastMessage}>{chat.lastMessage}</Text>
            </View>
            {chat.time && (
              <Text style={styles.timeText}>{chat.time}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatIcon: {
    marginRight: 16,
  },
  chatInfo: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
});

export default ChatScreen; 