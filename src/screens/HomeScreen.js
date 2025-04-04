import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Image } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const HomeScreen = ({ navigation }) => {
  // Use the refactored organization context for active status
  const { isOrganizationActive, activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  
  // State for articles and loading
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('Aktuell');
  const [availableFilters, setAvailableFilters] = useState(['Aktuell']);
  const [pinnedArticleIds, setPinnedArticleIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch articles from Supabase
  useEffect(() => {
    fetchFilters();
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

  // Apply filter when articles, selectedFilter, or pinned IDs change
  useEffect(() => {
    applyFilter(selectedFilter);
  }, [articles, selectedFilter, pinnedArticleIds, applyFilter]);

  const fetchFilters = async () => {
    setIsLoadingFilters(true);
    try {
      const { data, error } = await supabase
        .from('article_filters')
        .select('name')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching filters:', error);
        // Keep default 'Aktuell' if fetch fails
      } else {
        // Get filter names from the fetched data
        let filterNames = data.map(f => f.name);
        
        // Ensure 'Aktuell' is present and at the beginning
        if (filterNames.includes('Aktuell')) {
          // Remove it from its current position
          filterNames = filterNames.filter(name => name !== 'Aktuell');
        }
        // Add 'Aktuell' to the start
        filterNames.unshift('Aktuell');

        setAvailableFilters(filterNames);
        
        // If the initial selected filter is not in the available list anymore (e.g., db changed)
        // default back to 'Aktuell'
        if (!filterNames.includes(selectedFilter)) {
          setSelectedFilter('Aktuell'); 
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching filters:', err);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch articles from the articles table directly with author info
      const { data, error } = await supabase
        .from('article_listings') // Query the VIEW instead of the table
        .select('*') // Select all columns from the view
        .order('published_at', { ascending: false }); // Order by the original timestamp
      
      if (error) {
        console.error('Error fetching articles:', error);
        setError('Artikel konnten nicht geladen werden. Bitte versuche es später erneut.');
      } else {
        // Format the data to match what we expect from article_listings
        const formattedArticles = data.map(article => {
          // Format date
          const publishDate = new Date(article.published_at);
          const formattedDate = `${publishDate.getDate().toString().padStart(2, '0')}.${(publishDate.getMonth() + 1).toString().padStart(2, '0')}.${publishDate.getFullYear()}`;
          
          // Strip HTML tags and then truncate content
          const plainTextContent = article.content.replace(/<[^>]*>/g, ''); // Remove HTML tags
          const truncatedContent = plainTextContent.length > 100 
            ? plainTextContent.substring(0, 100) + '...' 
            : plainTextContent;
            
          return {
            id: article.id,
            title: article.title,
            content: truncatedContent,
            type: article.type,
            published_at: article.published_at,
            date: formattedDate,
            author_id: article.author_id,
            author_name: article.author_name, // Use the name from the view
            is_organization_post: article.is_organization_post,
            image_url: article.image_url, // Include the image URL
            preview_image_url: article.preview_image_url // Include the preview image URL
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
  
  // Fetch pinned article IDs for the selected filter
  const fetchPinnedArticles = async (filter) => {
    if (!filter || filter === 'Aktuell') {
      setPinnedArticleIds(new Set()); // No pins for 'Aktuell'
      return;
    }
    try {
      const { data, error } = await supabase
        .from('pinned_articles')
        .select('article_id')
        .eq('filter_name', filter);

      if (error) {
        console.error(`Error fetching pinned articles for ${filter}:`, error);
        setPinnedArticleIds(new Set());
      } else {
        setPinnedArticleIds(new Set(data.map(p => p.article_id)));
      }
    } catch (err) {
      console.error(`Unexpected error fetching pinned articles for ${filter}:`, err);
      setPinnedArticleIds(new Set());
    }
  };
  
  // Filter articles based on the selected filter
  const applyFilter = useCallback((filter) => {
    if (!articles.length) return;
    
    let sortedArticles = [];
    if (filter === 'Aktuell') {
      // Show all articles sorted by date (newest first)
      sortedArticles = [...articles].sort((a, b) => 
        new Date(b.published_at) - new Date(a.published_at)
      );
    } else {
      // Filter by the selected type, separating pinned articles
      const relevantArticles = articles.filter(article => article.type === filter);
      const pinned = [];
      const notPinned = [];

      relevantArticles.forEach(article => {
        if (pinnedArticleIds.has(article.id)) {
          pinned.push(article);
        } else {
          notPinned.push(article);
        }
      });

      // Sort pinned articles (e.g., by publish date, or pin date if available)
      pinned.sort((a, b) => new Date(b.published_at) - new Date(a.published_at)); // Or use pinned_at if fetched

      // Sort non-pinned articles by publish date
      notPinned.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

      // Combine: pinned first, then non-pinned
      sortedArticles = [...pinned, ...notPinned];
    }
    setFilteredArticles(sortedArticles);
  }, [articles, pinnedArticleIds]);

  // Handle filter change
  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
    // Fetch pinned articles for the new filter (async, effect will re-apply filter)
    fetchPinnedArticles(filter);
  };
  
  // Open article creation screen (for active organization context)
  const handleCreateArticle = () => {
    if (isOrganizationActive && user) {
      navigation.navigate('CreateArticle', { 
        organizationId: activeOrganizationId // Pass the active org ID
      }); 
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        filters={availableFilters} 
        onFilterChange={handleFilterChange} 
        initialFilter={selectedFilter} 
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Artikel werden geladen...</Text>
        </View>
      ) : isLoadingFilters ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4285F4" />
          <Text style={styles.loadingText}>Filter werden geladen...</Text>
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
                  {/* Add Pin Icon if article is pinned and filter is not 'Aktuell' */}
                  {selectedFilter !== 'Aktuell' && pinnedArticleIds.has(article.id) && (
                    <Ionicons name="pin" size={16} color="#666" style={styles.pinIcon} />
                  )}
                  <Text 
                    style={article.is_organization_post ? styles.organizationAuthor : (article.author_name === 'Redaktion' ? styles.redaktionAuthor : styles.articleAuthor)}
                  >
                    {article.author_name}
                  </Text>
                </View>
                <Text style={styles.articleTitle}>{article.title}</Text>
                {/* Show image if available */}
                {article.preview_image_url && (
                  <Image 
                    source={{ uri: article.preview_image_url }} 
                    style={styles.articleImage}
                    resizeMode="cover"
                  />
                )}
                <Text style={styles.articleContent} numberOfLines={3}>
                  {article.content}
                </Text>
              </TouchableOpacity>
            ))
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      
      {/* Show Add button only if an organization context is active and user logged in */} 
      {isOrganizationActive && user && (
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
    position: 'relative', // Needed for absolute positioning of pin icon if desired
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
  organizationAuthor: {
    fontSize: 12,
    color: '#208e5d',
    fontWeight: 'bold',
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
  articleImage: {
    width: '100%',
    height: 160, // Slightly reduced height for preview list
    borderRadius: 6,
    marginVertical: 8,
  },
  pinIcon: {
    // Style the pin icon (e.g., position it top-right within the header)
    marginLeft: 8, // Add some space from the author name
  },
});

export default HomeScreen; 