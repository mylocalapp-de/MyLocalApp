import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const HomeScreen = ({ navigation }) => {
  // Use organization context to determine if add button should be shown
  const { isOrganization } = useOrganization();
  const { user, userPreferences } = useAuth();
  
  // State for articles and loading status
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Aktuell');
  
  // Placeholder filters for the home screen
  const homeFilters = ['Aktuell', 'Vereine', 'Gemeinde', 'Veranstaltungen', 'Polizei'];

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd.MM.yyyy', { locale: de });
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString;
    }
  };

  // Fetch articles from Supabase
  useEffect(() => {
    fetchArticles();
  }, [activeFilter, userPreferences]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('articles')
        .select('*')
        .order('published_at', { ascending: false });
      
      // Filter by type if not on "Aktuell" tab
      if (activeFilter !== 'Aktuell') {
        query = query.eq('type', activeFilter);
      }
      
      // Apply user preferences if any
      if (userPreferences && userPreferences.length > 0 && activeFilter === 'Aktuell') {
        // Convert preferences to title case to match the article types
        const formattedPreferences = userPreferences.map(pref => 
          pref.charAt(0).toUpperCase() + pref.slice(1)
        );
        
        query = query.in('type', formattedPreferences);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching articles:', error);
        return;
      }
      
      // Transform data to match the app's format
      const formattedArticles = data.map(article => ({
        id: article.id,
        title: article.title,
        date: formatDate(article.published_at),
        content: article.short_content,
        type: article.type,
        fullContent: article.content
      }));
      
      setArticles(formattedArticles);
    } catch (error) {
      console.error('Error in fetchArticles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const handleCreateArticle = () => {
    // Navigate to create article screen
    // navigation.navigate('CreateArticle');
    console.log('Create article');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        filters={homeFilters} 
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {articles.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                {userPreferences && userPreferences.length > 0 
                  ? 'Keine Artikel für Ihre Präferenzen gefunden.'
                  : 'Keine Artikel gefunden.'}
              </Text>
            </View>
          ) : (
            articles.map(article => (
              <TouchableOpacity 
                key={article.id} 
                style={styles.articleCard}
                onPress={() => navigation.navigate('ArticleDetail', { articleId: article.id })}
              >
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
            ))
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      
      {isOrganization && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleCreateArticle}
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  bottomPadding: {
    height: 60, // Extra space at the bottom of the scroll for better UX
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
  emptyStateContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default HomeScreen; 