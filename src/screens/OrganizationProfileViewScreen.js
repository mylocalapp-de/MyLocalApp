import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ScrollView, 
    Image, 
    ActivityIndicator, 
    TouchableOpacity, 
    FlatList, 
    Alert,
    Platform,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchOrganizationProfile,
  fetchOrgArticleListings,
  fetchOrgPublishedEvents,
  updateProfileBlocked,
} from '../services/profileService';
import { findOrCreateOrgDmConversation } from '../services/dmService';
import { useAuth } from '../context/AuthContext'; // To check if user is member for potential actions
import { useNetwork } from '../context/NetworkContext';
import ScreenHeader from '../components/common/ScreenHeader'; 
// TODO: Import components for displaying Org Articles/Events if needed
import ArticleCard from '../components/ArticleCard'; // <-- ADDED Import
// import EventCard from '../components/EventCard'; // Assuming you have an EventCard component

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl, width = 100, quality = 80) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl;
  }
  return `${originalUrl.replace('/object/public/', '/render/image/public/')}?width=${width}&quality=${quality}`;
};

const OrganizationProfileViewScreen = ({ route, navigation }) => {
    const { organizationId } = route.params;
    const { user, userOrganizations, profile: currentUserProfile, updateProfile } = useAuth(); // Get user profile and update func
    const { isOfflineMode } = useNetwork();

    const [organizationProfile, setOrganizationProfile] = useState(null);
    const [articles, setArticles] = useState([]);
    const [events, setEvents] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [error, setError] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [loadingConversation, setLoadingConversation] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    
    // Tag filtering state
    const [selectedTags, setSelectedTags] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    useEffect(() => {
        if (!organizationId) {
            setError('Organisation nicht gefunden.');
            setLoadingProfile(false);
            return;
        }

        // Check if the current user is a member of the viewed organization
        let membershipCheck = false;
        if (user && userOrganizations) {
            membershipCheck = userOrganizations.some(org => org.id === organizationId);
            setIsMember(membershipCheck);
            // console.log(`[OrgProfileView] Is User Member? ${membershipCheck}`);
        } else {
            setIsMember(false);
        }

        // Check if the organization is blocked by the current user
        if (currentUserProfile && currentUserProfile.blocked && !membershipCheck) {
            const blockedCheck = currentUserProfile.blocked.includes(organizationId);
            setIsBlocked(blockedCheck);
            // console.log(`[OrgProfileView] Is Org Blocked? ${blockedCheck}`);
        }

        if (isOfflineMode) {
            setError("Organisationsprofil ist offline nicht verfügbar.");
            setLoadingProfile(false);
        } else {
            fetchOrganizationData();
            // fetchOrganizationArticles(); // <-- REMOVED Call from here
            // fetchOrganizationMembers(); // Fetch members if needed
            // fetchOrganizationContent(); // Fetch articles/events if needed
        }
    }, [organizationId, user, userOrganizations, currentUserProfile, isOfflineMode]);

    const fetchOrganizationData = async () => {
        setLoadingProfile(true);
        setError(null);
        let orgData = null; // Declare orgData outside try block
        try {
            const { data, error: orgError } = await fetchOrganizationProfile(organizationId);

            if (orgError) throw orgError;
            if (!data) throw new Error('Organisation nicht gefunden.'); // <-- Check data

            orgData = data; // Assign fetched data
            setOrganizationProfile(orgData);

        } catch (err) {
            console.error("Error fetching organization profile:", err);
            setError(err.message || "Organisationsprofil konnte nicht geladen werden.");
        } finally {
            setLoadingProfile(false);
            // Call fetch articles and events ONLY if profile was loaded successfully
            if (orgData && !isOfflineMode) {
                fetchOrganizationArticles(orgData.id, orgData.name);
                fetchOrganizationEvents(orgData.id);
            }
        }
    };

    // Function to fetch organization articles
    const fetchOrganizationArticles = async (orgIdToFetch, orgNameToFormat) => {
        setLoadingArticles(true);
        try {
            const { data: articlesData, error: articlesError } = await fetchOrgArticleListings(orgIdToFetch);

            if (articlesError) throw articlesError;

            const formattedArticles = articlesData.map(article => ({
                ...article,
                author_name: article.organization_id 
                    ? (orgNameToFormat || 'Organisation')
                    : (article.profiles?.display_name || 'Unbekannt'), 
                date: article.created_at ? new Date(article.created_at).toLocaleDateString('de-DE') : 'Unbekanntes Datum'
            }));

            setArticles(formattedArticles);
            updateAvailableTags(formattedArticles, events);
        } catch (err) {
            console.error("Error fetching organization articles:", err);
            Alert.alert("Fehler", "Organisationsartikel konnten nicht geladen werden.");
        } finally {
            setLoadingArticles(false);
        }
    };

    // Function to fetch organization events
    const fetchOrganizationEvents = async (orgIdToFetch) => {
        setLoadingEvents(true);
        try {
            const { data: eventsData, error: eventsError } = await fetchOrgPublishedEvents(orgIdToFetch);

            if (eventsError) throw eventsError;

            const formattedEvents = (eventsData || []).map(event => ({
                ...event,
                formattedDate: event.date ? new Date(event.date).toLocaleDateString('de-DE') : 'Datum unbekannt'
            }));

            setEvents(formattedEvents);
            updateAvailableTags(articles, formattedEvents);
        } catch (err) {
            console.error("Error fetching organization events:", err);
            Alert.alert("Fehler", "Organisationsveranstaltungen konnten nicht geladen werden.");
        } finally {
            setLoadingEvents(false);
        }
    };

    // Function to collect unique tags from articles and events
    const updateAvailableTags = (articlesList, eventsList) => {
        const allTags = new Set();
        
        articlesList.forEach(article => {
            if (article.tags && Array.isArray(article.tags)) {
                article.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        eventsList.forEach(event => {
            if (event.tags && Array.isArray(event.tags)) {
                event.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        setAvailableTags(Array.from(allTags).sort());
    };

    // Toggle tag selection for filtering
    const toggleTagFilter = (tag) => {
        setSelectedTags(prev => 
            prev.includes(tag) 
                ? prev.filter(t => t !== tag) 
                : [...prev, tag]
        );
    };

    // Filter articles by selected tags
    const filteredArticles = selectedTags.length === 0 
        ? articles 
        : articles.filter(article => 
            article.tags && article.tags.some(tag => selectedTags.includes(tag))
        );

    // Filter events by selected tags
    const filteredEvents = selectedTags.length === 0 
        ? events 
        : events.filter(event => 
            event.tags && event.tags.some(tag => selectedTags.includes(tag))
        );

    const renderArticle = ({ item }) => ( 
        <ArticleCard 
            article={item} 
            onPress={() => {
                if (item.linked_event_id) {
                    navigation.navigate('EventDetail', { eventId: item.linked_event_id });
                } else {
                    navigation.navigate('ArticleDetail', { articleId: item.id });
                }
            }}
        /> 
    );

    const renderEvent = ({ item }) => (
        <TouchableOpacity 
            style={styles.eventCard}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        >
            {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.eventImage} />
            )}
            <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.eventMeta}>
                    <Ionicons name="calendar-outline" size={14} color="#666" />
                    <Text style={styles.eventDate}>{item.formattedDate}</Text>
                </View>
                {item.location && (
                    <View style={styles.eventMeta}>
                        <Ionicons name="location-outline" size={14} color="#666" />
                        <Text style={styles.eventLocation} numberOfLines={1}>{item.location}</Text>
                    </View>
                )}
                {item.tags && item.tags.length > 0 && (
                    <View style={styles.eventTags}>
                        {item.tags.slice(0, 3).map((tag, index) => (
                            <View key={index} style={styles.eventTagChip}>
                                <Text style={styles.eventTagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    // Render tag filter buttons
    const renderTagFilters = () => {
        if (availableTags.length === 0) return null;
        
        return (
            <View style={styles.tagFilterSection}>
                <Text style={styles.tagFilterLabel}>Nach Schlagwörtern filtern:</Text>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tagFilterContainer}
                >
                    {availableTags.map((tag, index) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                            <TouchableOpacity
                                key={index}
                                style={[styles.tagFilterButton, isSelected && styles.tagFilterButtonSelected]}
                                onPress={() => toggleTagFilter(tag)}
                            >
                                <Text style={[styles.tagFilterText, isSelected && styles.tagFilterTextSelected]}>
                                    {tag}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {selectedTags.length > 0 && (
                    <TouchableOpacity 
                        style={styles.clearFiltersButton}
                        onPress={() => setSelectedTags([])}
                    >
                        <Text style={styles.clearFiltersText}>Filter zurücksetzen</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // --- ADDED: Function to handle sending message ---
    const handleSendMessage = async () => {
        if (!organizationProfile || !user || isOfflineMode || loadingConversation || isBlocked) return;

        setLoadingConversation(true);
        try {
            // console.log(`Calling RPC find_or_create_org_dm_conversation for org: ${organizationProfile.id}`);
            const { data: conversationId, error: rpcError } = await findOrCreateOrgDmConversation(organizationProfile.id);

            if (rpcError || !conversationId) {
                console.error('Error finding/creating Org DM conversation:', rpcError);
                Alert.alert('Fehler', 'Konversation konnte nicht gestartet werden: ' + (rpcError?.message || 'Unbekannter RPC Fehler'));
                return;
            }

            navigation.navigate('DirectMessageDetail', {
                conversationId: conversationId,
                recipientId: null, // No specific user recipient for org DMs
                organizationId: organizationProfile.id,
                recipientName: organizationProfile.name,
                isOrgConversation: true, // Explicitly org conversation
            });
        } catch (error) {
            console.error("Error starting Org DM conversation:", error);
            Alert.alert('Fehler', error.message || 'Ein Fehler ist beim Starten des Chats aufgetreten.');
        } finally {
            setLoadingConversation(false);
        }
    };
    // --- END ADDED ---

    // --- Block/Unblock Logic ---
    const handleBlockToggle = async () => {
        if (!user || !currentUserProfile || !organizationProfile || isMember || blockLoading) return;

        setBlockLoading(true);
        const currentlyBlocked = currentUserProfile.blocked || [];
        const targetOrgId = organizationProfile.id;
        let updatedBlockedList;

        if (isBlocked) {
            // Unblock: Remove the org ID
            updatedBlockedList = currentlyBlocked.filter(id => id !== targetOrgId);
            // console.log(`[OrgProfileView] Unblocking organization ${targetOrgId}`);
        } else {
            // Block: Add the org ID
            updatedBlockedList = [...currentlyBlocked, targetOrgId];
            // console.log(`[OrgProfileView] Blocking organization ${targetOrgId}`);
        }

        try {
            const { data, error: updateError } = await updateProfileBlocked(user.id, updatedBlockedList);

            if (updateError) throw updateError;

            // Update local state and context
            setIsBlocked(!isBlocked);
            updateProfile({ ...currentUserProfile, blocked: data.blocked });

            Alert.alert(
                isBlocked ? 'Organisation entsperrt' : 'Organisation blockiert',
                `${organizationProfile.name} wurde ${isBlocked ? 'entsperrt' : 'blockiert'}. Du wirst keine Direktnachrichten von dieser Organisation mehr sehen.`
            );
        } catch (err) {
            console.error('Error updating org block status:', err);
            Alert.alert('Fehler', `Konnte Blockierstatus der Organisation nicht ändern: ${err.message}`);
        } finally {
            setBlockLoading(false);
        }
    };
    // --- End Block/Unblock Logic ---

    if (loadingProfile) {
        return (
             <View style={[styles.container, styles.centered]}>
                <ScreenHeader showBackButton={true} navigation={navigation} title="Organisation" />
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Organisationsprofil wird geladen...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                 <ScreenHeader showBackButton={true} navigation={navigation} title="Fehler" />
                 <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity 
                        style={styles.backButtonInline}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>Zurück</Text>
                    </TouchableOpacity>
                 </View>
            </View>
        );
    }

    if (!organizationProfile) {
         return (
            <View style={styles.container}>
                 <ScreenHeader showBackButton={true} navigation={navigation} title="Fehler" />
                 <View style={styles.centered}>
                    <Text style={styles.errorText}>Organisation konnte nicht gefunden werden.</Text>
                 </View>
            </View>
        );
    }

    // Determine logo source or placeholder
    const LogoComponent = () => {
        if (organizationProfile.logo_url) {
            return <Image source={{ uri: getTransformedImageUrl(organizationProfile.logo_url, 100, 80) }} style={styles.logoImage} />;
        } else {
            const initial = organizationProfile.name?.charAt(0).toUpperCase() || '?';
            return (
                <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoLetter}>{initial}</Text>
                </View>
            );
        }
    };

    return (
        <View style={styles.container}>
            <ScreenHeader 
                showBackButton={true} 
                navigation={navigation} 
                title={organizationProfile.name || 'Organisation'} 
                showBlockButton={!isMember && user} // Show block button only if logged in and NOT a member
                onBlockToggle={handleBlockToggle}
                isBlocked={isBlocked}
                blockLoading={blockLoading}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileHeader}>
                    <LogoComponent />
                    <Text style={styles.orgName}>{organizationProfile.name || 'Unbekannte Organisation'}</Text>
                    {/* Add Join/Leave or other buttons based on membership status if needed */}
                     {/* --- ADDED: Message Button --- */}
                    {!isOfflineMode && user && !isBlocked && (
                        <TouchableOpacity 
                            style={[styles.dmButton, loadingConversation && styles.dmButtonDisabled]} // Add disabled style
                            onPress={handleSendMessage}
                            disabled={loadingConversation}
                        >
                            {loadingConversation ? (
                                <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
                            ) : (
                                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                            )}
                            <Text style={styles.dmButtonText}>
                                {loadingConversation ? 'Starte...' : 'Nachricht schreiben'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {/* Show message if org is blocked */}
                    {!isOfflineMode && user && !isMember && isBlocked && (
                        <View style={styles.blockedMessageContainer}>
                            <Ionicons name="ban-outline" size={18} color="#ff3b30" />
                            <Text style={styles.blockedMessageText}>Du hast diese Organisation blockiert.</Text>
                        </View>
                    )}
                    {/* --- END ADDED --- */}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Über die Organisation</Text>
                    <Text style={styles.aboutMeText}>
                        {organizationProfile.about_me || 'Keine Beschreibung hinterlegt.'}
                    </Text>
                </View>

                {/* Tag Filter Section */}
                {renderTagFilters()}

                {/* Articles Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Artikel</Text>
                    {loadingArticles ? (
                        <ActivityIndicator color="#4285F4" style={styles.listLoader} />
                    ) : filteredArticles.length > 0 ? (
                        <FlatList 
                            data={filteredArticles} 
                            renderItem={renderArticle}
                            keyExtractor={item => item.id.toString()}
                            scrollEnabled={false}
                            contentContainerStyle={styles.listContentContainer}
                        />
                    ) : (
                        <Text style={styles.emptyText}>
                            {selectedTags.length > 0 ? 'Keine Artikel mit diesen Schlagwörtern.' : 'Keine Ankündigungen veröffentlicht.'}
                        </Text>
                    )}
                </View>

                {/* Events Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Veranstaltungen</Text>
                    {loadingEvents ? (
                        <ActivityIndicator color="#4285F4" style={styles.listLoader} />
                    ) : filteredEvents.length > 0 ? (
                        <FlatList 
                            data={filteredEvents} 
                            renderItem={renderEvent} 
                            keyExtractor={item => item.id.toString()}
                            scrollEnabled={false}
                            contentContainerStyle={styles.listContentContainer}
                        />
                    ) : (
                        <Text style={styles.emptyText}>
                            {selectedTags.length > 0 ? 'Keine Veranstaltungen mit diesen Schlagwörtern.' : 'Keine Veranstaltungen geplant.'}
                        </Text>
                    )}
                </View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f8', 
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        flex: 1,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    errorText: {
        marginTop: 10,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    backButtonInline: {
        marginTop: 15,
        paddingVertical: 8,
        paddingHorizontal: 15,
        backgroundColor: '#e7f0fe',
        borderRadius: 5,
    },
    backButtonText: {
        color: '#4285F4',
        fontWeight: 'bold',
        fontSize: 16,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#fff',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    logoImage: {
        width: 100,
        height: 100,
        borderRadius: 15, // Less rounded for org logos
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    logoPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 15,
        backgroundColor: '#208e5d', // Org color
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    logoLetter: {
        color: '#fff',
        fontSize: 40,
        fontWeight: 'bold',
    },
    orgName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15, // Increased margin to make space for button
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 5,
    },
    aboutMeText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    emptyText: { // Style for empty lists (members, articles, etc.)
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        paddingVertical: 20,
        fontStyle: 'italic',
    },
    // Add styles for member items, article/event cards if implementing those sections
    // --- ADDED: Styles for DM Button ---
    dmButton: {
        flexDirection: 'row',
        backgroundColor: '#34A853', // Org green color
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 10, // Add some space above the button
    },
    dmButtonDisabled: {
        backgroundColor: '#a5d6a7', // Lighter green when disabled
    },
    dmButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    buttonLoader: {
        marginRight: 8, // Space between loader and text
    },
    // --- END ADDED ---
    // --- ADDED: Styles for Article List ---
    listLoader: {
      marginVertical: 20, // Add some spacing for the loader
    },
    listContentContainer: {
       paddingHorizontal: 5, // Add slight horizontal padding if cards touch edges
    },
    // --- END ADDED ---
    // Blocked message styles
    blockedMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 15,
        backgroundColor: '#ffebee', // Light red background
        borderRadius: 5,
    },
    blockedMessageText: {
        marginLeft: 8,
        color: '#ff3b30',
        fontSize: 13,
    },
    // Tag Filter Styles
    tagFilterSection: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tagFilterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    tagFilterContainer: {
        flexDirection: 'row',
        paddingRight: 10,
    },
    tagFilterButton: {
        backgroundColor: '#f1f1f1',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    tagFilterButtonSelected: {
        backgroundColor: '#4285F4',
        borderColor: '#4285F4',
    },
    tagFilterText: {
        fontSize: 13,
        color: '#333',
    },
    tagFilterTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    clearFiltersButton: {
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    clearFiltersText: {
        fontSize: 13,
        color: '#ff3b30',
    },
    // Event Card Styles
    eventCard: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#eee',
    },
    eventImage: {
        width: '100%',
        height: 120,
    },
    eventInfo: {
        padding: 12,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
    },
    eventMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    eventDate: {
        fontSize: 13,
        color: '#666',
        marginLeft: 6,
    },
    eventLocation: {
        fontSize: 13,
        color: '#666',
        marginLeft: 6,
        flex: 1,
    },
    eventTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
    },
    eventTagChip: {
        backgroundColor: '#e7f0fe',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 10,
        marginRight: 6,
        marginTop: 4,
    },
    eventTagText: {
        fontSize: 11,
        color: '#4285F4',
    },
});

export default OrganizationProfileViewScreen; 