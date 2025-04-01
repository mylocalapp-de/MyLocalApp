import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const HomeScreen = ({ navigation }) => {
  // Use organization context to determine if add button should be shown
  const { isOrganization } = useOrganization();
  const { user } = useAuth();
  
  // State for articles and loading
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('Aktuell');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Update filters to match all article types available in CreateArticleScreen
  const homeFilters = ['Aktuell', 'Kultur', 'Sport', 'Verkehr', 'Politik', 'Vereine', 'Gemeinde', 'Polizei', 'Veranstaltungen'];

  // Fetch articles from Supabase
  useEffect(() => {
    fetchArticles();
  }, []);

  // Refresh articles when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Add a small delay to ensure component is mounted before fetching
      setTimeout(() => {
        console.log('HomeScreen focused - refreshing articles');
        fetchArticles();
      }, 100);
    });
    
    return unsubscribe;
  }, [navigation]);

  // Apply filter when articles or selectedFilter changes
  useEffect(() => {
    applyFilter(selectedFilter);
  }, [articles, selectedFilter]);

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch articles from the articles table directly with author info
      const { data, error } = await supabase
        .from('articles')
        .select(`
          id,
          title,
          content,
          type,
          published_at,
          author_id,
          app_users(display_name)
        `)
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching articles:', error);
        setError('Could not load articles. Please try again later.');
      } else {
        // Format the data to match what we expect from article_listings
        const formattedArticles = data.map(article => {
          // Format date
          const publishDate = new Date(article.published_at);
          const formattedDate = `${publishDate.getDate().toString().padStart(2, '0')}.${(publishDate.getMonth() + 1).toString().padStart(2, '0')}.${publishDate.getFullYear()}`;
          
          // Truncate content to 100 chars with ellipsis
          const truncatedContent = article.content.length > 100 
            ? article.content.substring(0, 100) + '...' 
            : article.content;
            
          return {
            id: article.id,
            title: article.title,
            content: truncatedContent,
            type: article.type,
            published_at: article.published_at,
            date: formattedDate,
            author_id: article.author_id,
            author_name: article.app_users?.display_name || 'Redaktion'
          };
        });
        
        setArticles(formattedArticles || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching articles:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter articles based on the selected filter
  const applyFilter = (filter) => {
    if (!articles.length) return;
    
    if (filter === 'Aktuell') {
      // Show all articles sorted by date (newest first)
      setFilteredArticles([...articles].sort((a, b) => 
        new Date(b.published_at) - new Date(a.published_at)
      ));
    } else {
      // Filter by the selected type
      setFilteredArticles(
        articles.filter(article => article.type === filter)
      );
    }
  };

  // Handle filter change
  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };
  
  // Open article creation screen (for organization accounts)
  const handleCreateArticle = () => {
    if (isOrganization && user) {
      navigation.navigate('CreateArticle');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        filters={homeFilters} 
        onFilterChange={handleFilterChange} 
        initialFilter={selectedFilter} 
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Artikel werden geladen...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchArticles}>
            <Text style={styles.retryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredArticles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Keine Artikel verfügbar.</Text>
            </View>
          ) : (
            filteredArticles.map(article => (
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
                  <Text 
                  style={article.author_name === 'Redaktion' ? styles.redaktionAuthor : styles.articleAuthor}
                >
                  {article.author_name}
                </Text>
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
      
      {isOrganization && user && (
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
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
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
    marginBottom: 8,
  },
  articleAuthor: {
    fontSize: 12,
    color: '#4285F4',
    fontWeight: 'bold',
    alignSelf: 'flex-end',
  },
  redaktionAuthor: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    alignSelf: 'flex-end',
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

export default HomeScreen; 