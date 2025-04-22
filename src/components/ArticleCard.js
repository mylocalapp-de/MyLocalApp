import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ArticleCard = ({ article, onPress }) => {
  // Basic display of title and content snippet
  const title = article?.title || 'Unbekannter Titel';
  const contentString = article?.content ?? ''; // Get content or empty string
  const plainTextContent = contentString.replace(/<[^>]*>/g, ''); // Strip HTML tags
  const contentSnippet = plainTextContent.length > 80
    ? `${plainTextContent.substring(0, 80)}...` 
    : plainTextContent; // Use plain text for snippet
  const authorName = article?.author_name || 'Unbekannt';
  const date = article?.date || ''

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.content}>{contentSnippet}</Text>
        <View style={styles.metaContainer}>
            <Text style={styles.author}>{authorName}</Text>
            <Text style={styles.date}>{date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  contentContainer: {
    // Styles for text content area
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  content: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  metaContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 5,
  },
  author: {
      fontSize: 12,
      color: '#888',
  },
  date: {
      fontSize: 12,
      color: '#888',
  },
});

export default ArticleCard; 