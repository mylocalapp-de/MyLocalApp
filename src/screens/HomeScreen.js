import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { loadOfflineData } from '../utils/storageUtils';
import {
  fetchArticleFilters,
  fetchArticleListings,
  fetchVereinOrganizations as fetchVereinOrgsService,
  fetchPinnedArticles as fetchPinnedArticlesService,
} from '../services/articleService';

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl;
  }
  return originalUrl.replace('/object/public/', '/render/image/public/') + '?width=400&quality=60';
};

const HomeScreen = ({ navigation }) => {
  // Use the refactored organization context for active status
  const { isOrganizationActive, activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { isOfflineMode, isConnected } = useNetwork();
  
  // State for articles and loading
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('Aktuell');
  // include enable_personal on filter objects; default to false for 'Aktuell'
  const [availableFilters, setAvailableFilters] = useState([{ name: 'Aktuell', is_highlighted: false, enable_personal: false }]);
  const [pinnedArticleIds, setPinnedArticleIds] = useState(new Set());
  const [vereinOrganizations, setVereinOrganizations] = useState([]); // Organizations flagged as Vereine
  // Search query state
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch articles from Supabase or Offline Storage
  useEffect(() => {
    if (isOfflineMode) {
      loadDataFromStorage();
    } else {
      fetchFilters();
      fetchArticles();
    }
  }, [isOfflineMode]);

  // Refresh articles/vereine when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Add a small delay to ensure component is mounted before fetching
      const focusTimeout = setTimeout(() => { // Assign timeout to variable for potential cleanup
        // console.log('HomeScreen focused - Preparing to refresh articles...');
        try {
          // Check if user context is available (important if RLS depends on it)
          // console.log('HomeScreen Focus Listener: Current user state before fetch:', user ? `ID: ${user.id}` : 'null'); 
          
          // Fetch based on active filter
          if (selectedFilter === 'Vereine') {
            fetchVereinOrganizations();
          } else {
            fetchArticles(); 
          }

        } catch (error) {
          // --- Added Error Logging ---
          console.error("HomeScreen Focus Listener: Error executing fetchArticles:", error);
          // Optionally set an error state here to inform the user
          // setError("Fehler beim Aktualisieren der Artikel beim Fokussieren."); 
        }
      }, 100);

      // Clear the timeout if the screen loses focus before it executes
      return () => clearTimeout(focusTimeout); 
    });
    
    // Cleanup listener on unmount
    return unsubscribe;
  }, [navigation, user, isOfflineMode, selectedFilter]); // Include selectedFilter

  // Apply filter when articles, selectedFilter, pinned IDs, or search query change
  useEffect(() => {
    applyFilter(selectedFilter);
  }, [articles, selectedFilter, pinnedArticleIds, searchQuery, applyFilter]);

  // Function to load data from AsyncStorage
  const loadDataFromStorage = async () => {
    // console.log("[HomeScreen] Loading data from offline storage...");
    setIsLoading(true);
    setIsLoadingFilters(true);
    setError(null);
    let loadedArticles = [];
    let loadedFilters = [{ name: 'Aktuell', is_highlighted: false }];

    try {
      // Load Articles
      const offlineArticles = await loadOfflineData('articles');
      if (offlineArticles) {
        loadedArticles = formatArticles(offlineArticles); // Use existing formatting logic
        setArticles(loadedArticles);
        // console.log(`[HomeScreen] Loaded ${loadedArticles.length} articles from storage.`);
      } else {
         setError('Keine Offline-Artikel gefunden. Bitte gehe online und speichere Daten.');
         setArticles([]);
      }

      // Load Filters
      const offlineFilters = await loadOfflineData('article_filters');
      if (offlineFilters) {
          // Build storedFilters without duplicates
          let storedFilters = offlineFilters.map(f => ({
              name: f.name,
              is_highlighted: f.is_highlighted || false,
              enable_personal: !!f.enable_personal
          }));

          // Ensure single 'Aktuell' at the front (preserve enable_personal from storage)
          const aktuellFilter = storedFilters.find(f => f.name === 'Aktuell');
          storedFilters = storedFilters.filter(f => f.name !== 'Aktuell');
          storedFilters.unshift(aktuellFilter || { name: 'Aktuell', is_highlighted: false, enable_personal: false });
          setAvailableFilters(storedFilters);
          if (!storedFilters.some(f => f.name === selectedFilter)) setSelectedFilter('Aktuell');
      } else {
          setAvailableFilters([{ name: 'Aktuell', is_highlighted: false, enable_personal: false }]);
          setSelectedFilter('Aktuell');
      }

      // Note: Pinned articles won't work correctly offline without storing pin status
      // For simplicity, we'll just disable pinning logic in offline mode
      setPinnedArticleIds(new Set());

    } catch (err) {
      console.error('[HomeScreen] Error loading data from storage:', err);
      setError('Fehler beim Laden der Offline-Daten.');
      setArticles([]);
      setAvailableFilters([{ name: 'Aktuell', is_highlighted: false, enable_personal: false }]);
      setSelectedFilter('Aktuell');
    } finally {
      setIsLoading(false);
      setIsLoadingFilters(false);
    }
  };

  const fetchFilters = async () => {
    if (isOfflineMode) return;

    setIsLoadingFilters(true);
    try {
      const { data, error } = await fetchArticleFilters();

      if (error) {
        console.error('Error fetching filters:', error);
        // fallback to just Aktuell on error
        setAvailableFilters([{ name: 'Aktuell', is_highlighted: false, enable_personal: false }]);
      } else {
        // Filter out admin only entries
        let fetched = data.filter(f => !f.is_admin_only);

        // No additional filter; show all non-admin filters even in personal context
        fetched = fetched.map(f => ({
          name: f.name,
          is_highlighted: f.is_highlighted || false,
          enable_personal: !!f.enable_personal
        }));

        // Ensure single 'Aktuell' at the front (preserve enable_personal from DB)
        const aktuellFilter = fetched.find(f => f.name === 'Aktuell');
        fetched = fetched.filter(f => f.name !== 'Aktuell');
        fetched.unshift(aktuellFilter || { name: 'Aktuell', is_highlighted: false, enable_personal: false });
        setAvailableFilters(fetched);
        if (!fetched.some(f => f.name === selectedFilter)) setSelectedFilter('Aktuell');
      }
    } catch (err) {
      console.error('Unexpected error fetching filters:', err);
      setAvailableFilters([{ name: 'Aktuell', is_highlighted: false, enable_personal: false }]);
      setSelectedFilter('Aktuell');
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const fetchArticles = async () => {
    if (isOfflineMode) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch articles from the articles table directly with author info
      const { data, error } = await fetchArticleListings();
      
      if (error) {
        console.error('Error fetching articles:', error);
        setError('Artikel konnten nicht geladen werden. Bitte versuche es später erneut.');
      } else {
        // Format the data to match what we expect from article_listings
        const formattedArticles = formatArticles(data || []);
        
        setArticles(formattedArticles || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching articles:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch organizations flagged as "Verein" for Vereine grid
  const fetchVereinOrganizations = async () => {
    if (isOfflineMode) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await fetchVereinOrgsService();

      if (error) {
        console.error('Error fetching Verein organizations:', error);
        setError('Vereine konnten nicht geladen werden. Bitte versuche es später erneut.');
        setVereinOrganizations([]);
      } else {
        setVereinOrganizations(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching Verein organizations:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
      setVereinOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch pinned article IDs for the selected filter
  const fetchPinnedArticles = async (filter) => {
    // Added check: Don't fetch if offline
    if (isOfflineMode || !filter || filter === 'Aktuell') {
      setPinnedArticleIds(new Set()); // No pins for 'Aktuell' or offline
      return;
    }
    try {
      const { data, error } = await fetchPinnedArticlesService(filter);

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
    if (!articles.length) {
        setFilteredArticles([]);
        return;
    }

    let sortedArticles = [];
    if (filter === 'Aktuell') {
      // Determine names of personal filters to exclude in 'Aktuell' (but NOT 'Aktuell' itself)
      const personalFilterNames = availableFilters
        .filter(f => f.enable_personal && f.name !== 'Aktuell')
        .map(f => f.name);
      // Show all articles except personal-board ones from OTHER categories, sorted by date
      sortedArticles = articles
        .filter(article => !personalFilterNames.includes(article.type))
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else {
      // Filter by the selected type, separating pinned articles
      const relevantArticles = articles.filter(article => article.type === filter);
      const pinned = [];
      const notPinned = [];

      relevantArticles.forEach(article => {
        // Disable pinning logic when offline
        if (!isOfflineMode && pinnedArticleIds.has(article.id)) {
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

    // --- Apply search filter ---
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      sortedArticles = sortedArticles.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.content || '').toLowerCase().includes(q)
      );
    }

    setFilteredArticles(sortedArticles);
  }, [articles, pinnedArticleIds, isOfflineMode, availableFilters, searchQuery]);

  // Handle filter change
  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
    // Fetch pinned articles only if online
    if (!isOfflineMode) {
        if (filter === 'Vereine') {
          fetchVereinOrganizations();
        } else {
          fetchPinnedArticles(filter);
        }
    }
  };
  
  // Open article creation screen (for active organization context)
  const handleCreateArticle = () => {
    if (!user) {
      Alert.alert(
        'Permanenter Account erforderlich',
        'Bitte erstelle einen permanenten Account, um einen Artikel zu verfassen.'
      );
      return;
    }
    // Navigate to CreateEventArticle for "Veranstaltungen" filter
    if (selectedFilter === 'Veranstaltungen') {
      navigation.navigate('CreateEventArticle', { filter: selectedFilter });
    } else {
      navigation.navigate('CreateArticle', { filter: selectedFilter });
    }
  };

  // Helper function to format article data (extracted from fetchArticles)
  const formatArticles = (rawData) => {
    // Ensure rawData is an array
    if (!Array.isArray(rawData)) {
        console.warn('[HomeScreen formatArticles] Received non-array data:', rawData);
        return [];
    }
    return rawData.map(article => {
        // Use default values or optional chaining for safety
        const publishDate = article?.published_at ? new Date(article.published_at) : new Date(); // Default to now if missing
        const formattedDate = `${publishDate.getDate().toString().padStart(2, '0')}.${(publishDate.getMonth() + 1).toString().padStart(2, '0')}.${publishDate.getFullYear()}`;
        
        const contentString = article?.content ?? ''; // Default to empty string if null/undefined
        const plainTextContent = contentString.replace(/<[^>]*>/g, '');
        const truncatedContent = plainTextContent.length > 100
            ? plainTextContent.substring(0, 100) + '...'
            : plainTextContent;
            
        return {
            id: article?.id ?? Math.random().toString(), // Use a random fallback ID if necessary
            title: article?.title ?? 'Unbenannter Artikel', // Default title
            content: truncatedContent, // Already defaulted via contentString
            type: article?.type ?? 'Unbekannt', // Default type
            published_at: article?.published_at ?? publishDate.toISOString(), // Use ISO string if needed
            date: formattedDate,
            author_id: article?.author_id ?? null,
            author_name: article?.author_name ?? 'Unbekannter Autor', // Default author name
            is_organization_post: article?.is_organization_post ?? false,
            image_url: article?.image_url ?? null, // Keep null if not present
            preview_image_url: article?.preview_image_url ?? null, // Keep null if not present
            linked_event_id: article?.linked_event_id ?? null // For Event-Articles
        };
    });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        filters={availableFilters} 
        onFilterChange={handleFilterChange} 
        initialFilter={selectedFilter} 
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>{selectedFilter === 'Vereine' ? 'Vereine werden geladen...' : 'Artikel werden geladen...'}</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={() => (selectedFilter === 'Vereine' ? fetchVereinOrganizations() : fetchArticles())}>
            <Text style={styles.retryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedFilter === 'Vereine' ? (
            vereinOrganizations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Keine Vereine gefunden.</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {vereinOrganizations.map(org => (
                  <TouchableOpacity
                    key={org.id}
                    style={styles.gridCard}
                    onPress={() => navigation.navigate('OrganizationProfileView', { organizationId: org.id })}
                  >
                    <View style={styles.gridImageWrapper}>
                      {org.logo_url ? (
                        <Image
                          source={{ uri: getTransformedImageUrl(org.logo_url) }}
                          style={styles.gridImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.gridImage, styles.gridPlaceholder]}>
                          <Ionicons name="business-outline" size={24} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={2}>
                      {org.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          ) : (
            filteredArticles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Keine Artikel verfügbar.</Text>
              </View>
            ) : (
              filteredArticles.map(article => (
                <TouchableOpacity 
                  key={article.id} 
                  style={styles.articleCard}
                  onPress={() => {
                    // Navigate to EventDetail if this is an Event-Article
                    if (article.linked_event_id) {
                      navigation.navigate('EventDetail', { eventId: article.linked_event_id });
                    } else {
                      navigation.navigate('ArticleDetail', { articleId: article.id });
                    }
                  }}
                >
                  <View style={styles.articleHeader}>
                    <View style={styles.articleInfo}>
                      <Text style={styles.articleType}>{article.type}</Text>
                      <Text style={styles.articleDate}>{article.date}</Text>
                    </View>
                    {selectedFilter !== 'Aktuell' && !isOfflineMode && pinnedArticleIds.has(article.id) && (
                      <Ionicons name="pin" size={16} color="#666" style={styles.pinIcon} />
                    )}
                    <Text 
                      style={article.is_organization_post ? styles.organizationAuthor : (article.author_name === 'Redaktion' ? styles.redaktionAuthor : styles.articleAuthor)}
                    >
                      {article.author_name ?? 'Unbekannter Autor'}
                    </Text>
                  </View>
                  <Text style={styles.articleTitle}>{article.title ?? 'Unbenannter Artikel'}</Text>
                  {article.preview_image_url && (
                    <Image 
                      source={{ uri: getTransformedImageUrl(article.preview_image_url) }} 
                      style={styles.articleImage}
                      resizeMode="cover"
                    />
                  )}
                  <Text style={styles.articleContent} numberOfLines={3}>
                    {article.content ?? ''} 
                  </Text>
                </TouchableOpacity>
              ))
            )
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      
      {/* Show Add button based on context and filter */}
      {(isOrganizationActive || (availableFilters.find(f => f.name === selectedFilter)?.enable_personal)) && (
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
    // Eliminate gap directly under header/search
    paddingHorizontal: 10,
    paddingTop: 0,
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
  // --- Grid styles for 'Vereine' ---
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '48%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  gridImageWrapper: {
    position: 'relative',
    width: '100%',
  },
  gridImage: {
    width: '100%',
    height: 120,
  },
  gridPlaceholder: {
    backgroundColor: '#208e5d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  gridSubtitle: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  redaktionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#2db06c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  redaktionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default HomeScreen; 