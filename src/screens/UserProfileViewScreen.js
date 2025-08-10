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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
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
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const [error, setError] = useState(null);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);

    useEffect(() => {
        if (!userId) {
            setError('Benutzer nicht gefunden.');
            setLoadingProfile(false);
            return;
        }
        
        console.log(`[UserProfileViewScreen] Checking profile ownership:`);
        console.log(`  - Current User ID (from context): ${user?.id}`);
        console.log(`  - Viewed User ID (from params):   ${userId}`);
        const ownProfileCheck = user?.id === userId;
        console.log(`  - Is Own Profile? ${ownProfileCheck}`);

        setIsOwnProfile(ownProfileCheck);

        // Check if the viewed user is blocked by the current user
        if (currentUserProfile && currentUserProfile.blocked && !ownProfileCheck) {
            const blockedCheck = currentUserProfile.blocked.includes(userId);
            setIsBlocked(blockedCheck);
            console.log(`  - Is Viewed User Blocked? ${blockedCheck}`);
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
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, about_me')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;
            if (!profileData) throw new Error('Profil nicht gefunden.');

            setViewedProfile(profileData);
            fetchUserArticles(profileData.id); // Fetch articles after profile is loaded

        } catch (err) {
            console.error("Error fetching user profile:", err);
            setError(err.message || "Profil konnte nicht geladen werden.");
            setLoadingProfile(false);
        }
    };

    const fetchUserArticles = async (profileUserId) => {
        setLoadingArticles(true);
        try {
            const { data: articlesData, error: articlesError } = await supabase
                .from('article_listings') // Use the view for efficiency
                .select('*')
                .eq('author_id', profileUserId)
                .eq('is_organization_post', false) // Only personal articles
                .order('published_at', { ascending: false });

            if (articlesError) throw articlesError;
            setUserArticles(articlesData || []);

        } catch (err) {
            console.error("Error fetching user articles:", err);
            // Don't set main error, maybe just log or show a message in the articles section
        } finally {
            setLoadingArticles(false);
            setLoadingProfile(false); // Profile loading includes article loading now
        }
    };

    const handleSendMessage = async () => {
        if (!viewedProfile || !user || isBlocked) return; // Need both users, don't allow messaging blocked user

        try {
            // Call the RPC directly instead of using a context function
            console.log(`Calling RPC find_or_create_user_dm_conversation for other user: ${viewedProfile.id}`);
            const { data: conversationId, error: rpcError } = await supabase.rpc(
                'find_or_create_user_dm_conversation',
                { p_other_user_id: viewedProfile.id } 
            );

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
            console.log(`[UserProfileViewScreen] Unblocking user ${targetUserId}`);
        } else {
            // Block: Add the user ID
            updatedBlockedList = [...currentlyBlocked, targetUserId];
            console.log(`[UserProfileViewScreen] Blocking user ${targetUserId}`);
        }

        try {
            const { data, error: updateError } = await supabase
                .from('profiles')
                .update({ blocked: updatedBlockedList })
                .eq('id', user.id)
                .select('blocked') // Select the updated blocked array
                .single();

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
            onPress={() => navigation.navigate('ArticleDetail', { articleId: item.id })} 
        />
    );

    if (loadingProfile) {
        return (
             <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Profil wird geladen...</Text>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
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
            </SafeAreaView>
        );
    }

    if (!viewedProfile) {
         return (
            <SafeAreaView style={styles.container}>
                 <ScreenHeader showBackButton={true} navigation={navigation} title="Fehler" />
                 <View style={styles.centered}>
                    <Text style={styles.errorText}>Profil konnte nicht gefunden werden.</Text>
                 </View>
            </SafeAreaView>
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
        <SafeAreaView style={styles.container}>
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

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Artikel von {viewedProfile.display_name || 'diesem Benutzer'}</Text>
                    {loadingArticles ? (
                        <ActivityIndicator color="#4285F4" style={{ marginTop: 20 }} />
                    ) : userArticles.length > 0 ? (
                        <FlatList
                            data={userArticles}
                            renderItem={renderArticle}
                            keyExtractor={item => item.id.toString()}
                            scrollEnabled={false} // Disable scrolling within FlatList inside ScrollView
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    ) : (
                        <Text style={styles.noArticlesText}>Dieser Benutzer hat noch keine Artikel veröffentlicht.</Text>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
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
        color: '#ff3b30', // Red text
        fontSize: 13,
    },
});

export default UserProfileViewScreen; 