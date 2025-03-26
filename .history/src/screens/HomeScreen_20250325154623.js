import React from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import SearchBar from '../components/SearchBar';
import FilterButtons from '../components/FilterButtons';

const HomeScreen = () => {
  const filters = ['Aktuelles', 'Polizei', 'Feuerwehr', 'Vereine', 'Kultur'];
  const placeholderArticles = [
    {
      title: 'Polizei hält wieder Sprechstunden',
      date: '01.03.2024',
      preview: 'Ab dem kommenden Monat werden wieder regelmäßige Bürgersprechstunden im Rathaus angeboten...',
    },
    {
      title: 'Neue Feuerwehr Geräte',
      date: '29.02.2024',
      preview: 'Die freiwillige Feuerwehr freut sich über neue Ausrüstung...',
    },
    {
      title: 'Offene Gruppe Strohkirchen',
      date: '28.02.2024',
      preview: 'Jeden Dienstag trifft sich die offene Gruppe im Gemeindehaus...',
    },
  ];

  return (
    <View style={styles.container}>
      <SearchBar />
      <FilterButtons filters={filters} />
      <ScrollView style={styles.content}>
        {placeholderArticles.map((article, index) => (
          <View key={index} style={styles.articleCard}>
            <Text style={styles.articleDate}>{article.date}</Text>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articlePreview}>{article.preview}</Text>
          </View>
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
  articleCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  articleDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  articlePreview: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default HomeScreen; 