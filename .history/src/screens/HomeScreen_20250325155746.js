import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

const HomeScreen = () => {
  // Placeholder filters for the home screen
  const homeFilters = ['Aktuell', 'Vereine', 'Gemeinde', 'Veranstaltungen', 'Polizei'];

  // Placeholder articles
  const articles = [
    {
      id: 1,
      title: 'Polizei hat wieder Sprechstunden',
      date: '01.03.2023',
      content: 'Beitrag vom 01.03.2023. Die Polizei informiert über neue Sprechzeiten...',
      type: 'Polizei'
    },
    {
      id: 2,
      title: 'Dein Heimatort-Rat',
      date: '15.03.2023',
      content: 'Der Rat tagt ab sofort jeden zweiten Mittwoch im Monat...',
      type: 'Gemeinde'
    },
    {
      id: 3,
      title: 'Allgemeine Offene Gruppe',
      date: '20.03.2023',
      content: 'Neue Treffen ab jetzter Woche jeden Donnerstag...',
      type: 'Vereine'
    },
    {
      id: 4,
      title: 'Neue Feuerwehr-Spritze',
      date: '25.03.2023',
      content: 'Was tun, ob die Sirene heult?...',
      type: 'Gemeinde'
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader filters={homeFilters} />
      
      <ScrollView style={styles.content}>
        {articles.map(article => (
          <TouchableOpacity key={article.id} style={styles.articleCard}>
            <View style={styles.articleHeader}>
              <View style={styles.articleInfo}>
                <Text style={styles.articleType}>{article.type}</Text>
                <Text style={styles.articleDate}>{article.date}</Text>
              </View>
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </View>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleContent} numberOfLines={3}>
              {article.content}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
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
  content: {
    flex: 1,
    padding: 10,
  },
  articleCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  articleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleType: {
    fontSize: 12,
    color: '#4285F4',
    fontWeight: 'bold',
    marginRight: 8,
  },
  articleDate: {
    fontSize: 12,
    color: '#888',
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  articleContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
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

export default HomeScreen; 