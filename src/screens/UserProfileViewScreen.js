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
  fetchUserProfileView,
  fetchUserArticleListings,
  fetchUserPersonalEvents,
  updateProfileBlocked,
} from '../services/profileService';
import { findOrCreateUserDmConversation } from '../services/dmService';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import ScreenHeader from '../components/common/ScreenHeader'; // Assuming this path is correct
import ArticleCard from '../components/ArticleCard'; // <<< CORRECT THIS LINE

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.03;

const UserProfileViewScreen = ({ route, navigation }) => {
    const { userId } = route.params;
    const { user, profile: currentUserProfile, updateProfile } = useAuth(); // Get current user, profile, and update function
    const { isOfflineMode } = useNetwork();

    const [viewedProfile, setViewedProfile] = useState(null);
    const [userArticles, setUserArticles] = useState([]);
    const [userEvents, setUserEvents] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [error, setError] = useState(null);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    
    // Tag filtering state
    const [selectedTags, setSelectedTags] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    useEffect(() => {
        if (!userId) {
            setError('Benutzer nicht gefunden.');
            setLoadingProfile(false);
            return;
        }
        
        // console.log(`[UserProfileViewScreen] Checking profile ownership:`);
        // console.log(`  - Current User ID (from context): ${user?.id}`);
        // console.log(`  - Viewed User ID (from params):   ${userId}`);
        const ownProfileCheck = user?.id === userId;
        // console.log(`  - Is Own Profile? ${ownProfileCheck}`);

        setIsOwnProfile(ownProfileCheck);

        // Check if the viewed user is blocked by the current user
        if (currentUserProfile && currentUserProfile.blocked && !ownProfileCheck) {
            const blockedCheck = currentUserProfile.blocked.includes(userId);
            setIsBlocked(blockedCheck);
            // console.log(`  - Is Viewed User Blocked? ${blockedCheck}`);
        }

        if (isOfflineMode) {
            setError("Profilansicht ist offline nicht verfügbar.");
            setLoadingProfile(false);
        } else {
            fetchProfileData();
        }
    }, [userId, user, currentUserProfile, isOfflineMode]);

    const fetchProfileData = async () => {
        setLoadingProfile(true);
        setError(null);
        try {
            const { data: profileData, error: profileError } = await fetchUserProfileView(userId);

            if (profileError) throw profileError;
            if (!profileData) throw new Error('Profil nicht gefunden.');

            setViewedProfile(profileData);
            fetchUserArticles(profileData.id);
            fetchUserEvents(profileData.id);

        } catch (err) {
            console.error("Error fetching user profile:", err);
            setError(err.message || "Profil konnte nicht geladen werden.");
            setLoadingProfile(false);
        }
    };

    const fetchUserArticles = async (profileUserId) => {
        setLoadingArticles(true);
        try {
            const { data: articlesData, error: articlesError } = await fetchUserArticleListings(profileUserId);

            if (articlesError) throw articlesError;
            const articles = articlesData || [];
            setUserArticles(articles);
            updateAvailableTags(articles, userEvents);

        } catch (err) {
            console.error("Error fetching user articles:", err);
        } finally {
            setLoadingArticles(false);
            setLoadingProfile(false);
        }
    };

    const fetchUserEvents = async (profileUserId) => {
        setLoadingEvents(true);
        try {
            const { data: eventsData, error: eventsError } = await fetchUserPersonalEvents(profileUserId);

            if (eventsError) throw eventsError;

            const formattedEvents = (eventsData || []).map(event => ({
                ...event,
                formattedDate: event.date ? new Date(event.date).toLocaleDateString('de-DE') : 'Datum unbekannt'
            }));

            setUserEvents(formattedEvents);
            updateAvailableTags(userArticles, formattedEvents);

        } catch (err) {
            console.error("Error fetching user events:", err);
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
        ? userArticles 
        : userArticles.filter(article => 
            article.tags && article.tags.some(tag => selectedTags.includes(tag))
        );

    // Filter events by selected tags
    const filteredEvents = selectedTags.length === 0 
        ? userEvents 
        : userEvents.filter(event => 
            event.tags && event.tags.some(tag => selectedTags.includes(tag))
        );

    const handleSendMessage = async () => {
        if (!viewedProfile || !user || isBlocked) return; // Need both users, don't allow messaging blocked user

        try {
            // Call the RPC directly instead of using a context function
            // console.log(`Calling RPC find_or_create_user_dm_conversation for other user: ${viewedProfile.id}`);
            const { data: conversationId, error: rpcError } = await findOrCreateUserDmConversation(viewedProfile.id);

            if (rpcError || !conversationId) {
                console.error('Error finding/creating User DM conversation:', rpcError);
                Alert.alert('Fehler', 'Konversation konnte nicht gestartet werden: ' + (rpcError?.message || 'Unbekannter RPC Fehler'));
                return; // Stop execution if RPC fails
            }

            // Navigate if RPC call is successful
            navigation.navigate('DirectMessageDetail', {
                conversationId: conversationId,
                recipientId: viewedProfile.id,
                recipientName: viewedProfile.display_name,
                isOrgConversation: false, // Explicitly user-to-user
                organizationId: null // No org involved
            });
        } catch (error) {
            console.error("Error starting DM conversation:", error);
            Alert.alert('Fehler', error.message || 'Ein Fehler ist beim Starten des Chats aufgetreten.');
        }
    };

    // --- Block/Unblock Logic ---
    const handleBlockToggle = async () => {
        if (!user || !currentUserProfile || !viewedProfile || isOwnProfile || blockLoading) return;

        setBlockLoading(true);
        const currentlyBlocked = currentUserProfile.blocked || [];
        const targetUserId = viewedProfile.id;
        let updatedBlockedList;

        if (isBlocked) {
            // Unblock: Remove the user ID
            updatedBlockedList = currentlyBlocked.filter(id => id !== targetUserId);
            // console.log(`[UserProfileViewScreen] Unblocking user ${targetUserId}`);
        } else {
            // Block: Add the user ID
            updatedBlockedList = [...currentlyBlocked, targetUserId];
            // console.log(`[UserProfileViewScreen] Blocking user ${targetUserId}`);
        }

        try {
            const { data, error: updateError } = await updateProfileBlocked(user.id, updatedBlockedList);

            if (updateError) throw updateError;

            // Update local state and context
            setIsBlocked(!isBlocked);
            updateProfile({ ...currentUserProfile, blocked: data.blocked }); // Update context

            Alert.alert(
                isBlocked ? 'Benutzer entsperrt' : 'Benutzer blockiert',
                `${viewedProfile.display_name} wurde ${isBlocked ? 'entsperrt' : 'blockiert'}. Du wirst keine Direktnachrichten von diesem Benutzer mehr sehen.`
            );
        } catch (err) {
            console.error('Error updating block status:', err);
            Alert.alert('Fehler', `Konnte Blockierstatus nicht ändern: ${err.message}`);
        } finally {
            setBlockLoading(false);
        }
    };
    // --- End Block/Unblock Logic ---

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

    if (loadingProfile) {
        return (
             <View style={[styles.container, styles.centered]}>
                <ScreenHeader showBackButton={true} navigation={navigation} title="Profil" />
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Profil wird geladen...</Text>
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

    if (!viewedProfile) {
         return (
            <View style={styles.container}>
                 <ScreenHeader showBackButton={true} navigation={navigation} title="Fehler" />
                 <View style={styles.centered}>
                    <Text style={styles.errorText}>Profil konnte nicht gefunden werden.</Text>
                 </View>
            </View>
        );
    }

    // Determine avatar source or placeholder
    const AvatarComponent = () => {
        if (viewedProfile.avatar_url) {
            return <Image source={{ uri: viewedProfile.avatar_url }} style={styles.avatarImage} />;
        } else {
            const initial = viewedProfile.display_name?.charAt(0).toUpperCase() || '?';
            return (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{initial}</Text>
                </View>
            );
        }
    };

    return (
        <View style={styles.container}>
            <ScreenHeader 
                showBackButton={true} 
                navigation={navigation} 
                // Use display name if available, otherwise a placeholder
                title={viewedProfile.display_name || 'Benutzerprofil'} 
                showBlockButton={!isOwnProfile} // Show block button only if not own profile
                onBlockToggle={handleBlockToggle}
                isBlocked={isBlocked}
                blockLoading={blockLoading}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileHeader}>
                    <AvatarComponent />
                    <Text style={styles.displayName}>{viewedProfile.display_name || 'Unbekannter Benutzer'}</Text>
                    {!isOwnProfile && !isBlocked && (
                        <TouchableOpacity 
                            style={styles.dmButton}
                            onPress={handleSendMessage}
                        >
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                            <Text style={styles.dmButtonText}>Nachricht schreiben</Text>
                        </TouchableOpacity>
                    )}
                    {/* Show message if user is blocked */}
                    {!isOwnProfile && isBlocked && (
                        <View style={styles.blockedMessageContainer}>
                            <Ionicons name="ban-outline" size={18} color="#ff3b30" />
                            <Text style={styles.blockedMessageText}>Du hast diesen Benutzer blockiert.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Über Mich</Text>
                    <Text style={styles.aboutMeText}>
                        {viewedProfile.about_me || 'Keine Beschreibung hinterlegt.'}
                    </Text>
                </View>

                {/* Tag Filter Section */}
                {renderTagFilters()}

                {/* Articles Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Artikel von {viewedProfile.display_name || 'diesem Benutzer'}</Text>
                    {loadingArticles ? (
                        <ActivityIndicator color="#4285F4" style={{ marginTop: 20 }} />
                    ) : filteredArticles.length > 0 ? (
                        <FlatList
                            data={filteredArticles}
                            renderItem={renderArticle}
                            keyExtractor={item => item.id.toString()}
                            scrollEnabled={false}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    ) : (
                        <Text style={styles.noArticlesText}>
                            {selectedTags.length > 0 ? 'Keine Artikel mit diesen Schlagwörtern.' : 'Dieser Benutzer hat noch keine Artikel veröffentlicht.'}
                        </Text>
                    )}
                </View>

                {/* Events Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Veranstaltungen von {viewedProfile.display_name || 'diesem Benutzer'}</Text>
                    {loadingEvents ? (
                        <ActivityIndicator color="#4285F4" style={{ marginTop: 20 }} />
                    ) : filteredEvents.length > 0 ? (
                        <FlatList
                            data={filteredEvents}
                            renderItem={renderEvent}
                            keyExtractor={item => item.id.toString()}
                            scrollEnabled={false}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    ) : (
                        <Text style={styles.noArticlesText}>
                            {selectedTags.length > 0 ? 'Keine Veranstaltungen mit diesen Schlagwörtern.' : 'Dieser Benutzer hat noch keine Veranstaltungen erstellt.'}
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
        backgroundColor: '#f0f4f8', // Use a slightly off-white background
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
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
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 10,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 40,
        fontWeight: 'bold',
    },
    displayName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    dmButton: {
        flexDirection: 'row',
        backgroundColor: '#4285F4',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center',
    },
    dmButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
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
        fontStyle: 'italic',
    },
    noArticlesText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        paddingVertical: 20,
        fontStyle: 'italic',
    },
    separator: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 10,
    },
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

export default UserProfileViewScreen; 