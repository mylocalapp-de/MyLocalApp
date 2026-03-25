import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/common/ScreenHeader'; // Reuse if applicable
import { Ionicons } from '@expo/vector-icons';
import {
  getOrganizationsWithMembers,
  getPublicUsers,
  searchUsersByDisplayName,
  findOrCreateUserDmConversation,
  findOrCreateOrgDmConversation,
} from '../services/dmService';
import { fetchProfileAvatars } from '../services/profileService';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl; // Return original if not a valid Supabase Storage URL or already transformed
  }
  // Prevent double transformation
  if (originalUrl.includes('/render/image/public/')) {
      return originalUrl;
  }
  // Replace the path segment and add transform parameters
  return originalUrl.replace('/object/public/', '/render/image/public/') + '?width=100&height=100&resize=cover&quality=60'; // Smaller size for list avatar
};

const NewDirectMessageScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { isOfflineMode } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [orgError, setOrgError] = useState(null);
  const [publicUsers, setPublicUsers] = useState([]);
  const [loadingPublicUsers, setLoadingPublicUsers] = useState(true);
  const [publicUsersError, setPublicUsersError] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState(null);

  useEffect(() => {
    const fetchOrganizations = async () => {
      if (isOfflineMode || !user) {
        setOrganizations([]);
        setLoadingOrganizations(false);
        setOrgError(isOfflineMode ? "Organisationen offline nicht verfügbar." : "Bitte anmelden.");
        return;
      }

      setLoadingOrganizations(true);
      setOrgError(null);
      try {
        const { data, error } = await getOrganizationsWithMembers();
        if (error) {
          console.error('Error fetching organizations with members:', error);
          setOrgError('Organisationen konnten nicht geladen werden.');
          setOrganizations([]);
        } else {
          // console.log('Fetched organizations:', data);
          // tag items so the DM starter knows the entity type
          const withType = (data || []).map((o) => ({ ...o, entityType: 'org' }));
          setOrganizations(withType);
        }
      } catch (err) {
        console.error('Unexpected error fetching organizations:', err);
        setOrgError('Ein unerwarteter Fehler ist aufgetreten.');
        setOrganizations([]);
      } finally {
        setLoadingOrganizations(false);
      }
    };

    const fetchPublicUsers = async () => {
      if (isOfflineMode || !user) {
        setPublicUsers([]);
        setLoadingPublicUsers(false);
        setPublicUsersError(isOfflineMode ? "Benutzerliste offline nicht verfügbar." : "Bitte anmelden.");
        return;
      }

      setLoadingPublicUsers(true);
      setPublicUsersError(null);
      try {
        const { data, error } = await getPublicUsers(user.id);
        if (error) {
          console.error('Error fetching public users:', error);
          setPublicUsersError('Benutzer konnten nicht geladen werden.');
          setPublicUsers([]);
        } else {
          const withType = (data || []).map((u) => ({ ...u, entityType: 'user' }));
          setPublicUsers(withType);
        }
      } catch (err) {
        console.error('Unexpected error fetching public users:', err);
        setPublicUsersError('Ein unerwarteter Fehler ist aufgetreten.');
        setPublicUsers([]);
      } finally {
        setLoadingPublicUsers(false);
      }
    };

    fetchOrganizations();
    fetchPublicUsers();

    setSearchResults([]);
    setSearchError(null);
    setSearchQuery('');

  }, [isOfflineMode, user]);

  const fetchAvatarsForSearchResults = async (results) => {
      if (!results || results.length === 0) {
          return results; // No results to fetch for
      }

      const userIdsToFetch = results.map(user => user.id);
      // console.log(`[NewDM] Fetching avatars for ${userIdsToFetch.length} search results.`);

      try {
          const { data: profilesData, error: profilesError } = await fetchProfileAvatars(userIdsToFetch);

          if (profilesError) {
              console.error('[NewDM] Error fetching profiles for avatars:', profilesError);
              return results; // Return original results on error
          }

          const avatarMap = profilesData.reduce((map, profile) => {
              map[profile.id] = profile.avatar_url;
              return map;
          }, {});

          // Update the results with fetched avatar URLs
          return results.map(user => ({
              ...user,
              avatar_url: avatarMap[user.id] || null // Add avatar_url or null
          }));

      } catch (fetchErr) {
          console.error('[NewDM] Unexpected error in fetchAvatarsForSearchResults:', fetchErr);
          return results; // Return original results on unexpected error
      }
  };

  const searchUsers = async (query) => {
    if (!query || query.trim().length < 3) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    if (!user) {
      setSearchError("Bitte melde dich an, um Benutzer zu suchen.");
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
     if (isOfflineMode) {
      setSearchError("Benutzersuche ist offline nicht verfügbar.");
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    // console.log(`Searching for users with display name like: %${query}%`);

    try {
      const { data, error: rpcError } = await searchUsersByDisplayName(query.trim());

      if (rpcError) {
        console.error('Error searching users via RPC:', rpcError);
        setSearchError('Benutzer konnten nicht gesucht werden.');
        setSearchResults([]);
      } else if (data) {
        // console.log('Search results from RPC:', data);
        // --- Fetch avatars after getting results ---
        const resultsWithAvatars = await fetchAvatarsForSearchResults(data);
        // ensure entity type is user
        const withType = (resultsWithAvatars || []).map((u) => ({ ...u, entityType: 'user' }));
        setSearchResults(withType);
        // --- End Fetch avatars ---
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Unexpected error searching users:', err);
      setSearchError('Ein unerwarteter Fehler ist aufgetreten.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const startDirectMessage = async (target) => {
      if (loadingConversation) return;
      setSelectedTargetId(target.id);
      setLoadingConversation(true);
      const isOrg = target?.entityType === 'org';
      const rpcName = isOrg ? 'find_or_create_org_dm_conversation' : 'find_or_create_user_dm_conversation';
      const params = isOrg ? { p_organization_id: target.id } : { p_other_user_id: target.id };

      try {
          // console.log(`Calling RPC ${rpcName} with params:`, params);
          const { data: conversationId, error: rpcError } = isOrg
              ? await findOrCreateOrgDmConversation(target.id)
              : await findOrCreateUserDmConversation(target.id);

          if (rpcError || !conversationId) {
              console.error(`Error finding/creating ${isOrg ? 'Org' : 'User'} DM conversation:`, rpcError);
              Alert.alert('Fehler', 'Konversation konnte nicht gestartet werden: ' + (rpcError?.message || 'Unbekannter RPC Fehler'));
              setLoadingConversation(false);
              setSelectedTargetId(null);
              return;
          }

          // console.log(`Navigating to DM Detail - Conversation ID: ${conversationId}, Target Name: ${target.name || target.display_name}, Is Org: ${isOrg}`);

          navigation.replace('DirectMessageDetail', {
              conversationId: conversationId,
              recipientId: isOrg ? null : target.id,
              organizationId: isOrg ? target.id : null,
              recipientName: target.name || target.display_name,
              isOrgConversation: isOrg,
          });

      } catch (err) {
          console.error(`Error handling ${isOrg ? 'organization' : 'user'} press:`, err);
          Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
      } finally {
          setLoadingConversation(false);
          setSelectedTargetId(null);
      }
  };

  const renderUserAvatar = (item) => {
    const transformedUrl = item.avatar_url ? getTransformedImageUrl(item.avatar_url) : null;
    if (transformedUrl) {
      return <Image source={{ uri: transformedUrl }} style={styles.avatarPlaceholder} />;
    }
    return (
      <View style={[styles.avatarPlaceholder, styles.userAvatar]}>
        <Text style={styles.avatarLetter}>
          {item.display_name?.charAt(0).toUpperCase() || 'U'}
        </Text>
      </View>
    );
  };

  const renderOrgAvatar = (item) => {
      const transformedUrl = item.logo_url ? getTransformedImageUrl(item.logo_url) : null;
      if (transformedUrl) {
        return <Image source={{ uri: transformedUrl }} style={styles.avatarPlaceholder} />;
      }
      return (
        <View style={[styles.avatarPlaceholder, styles.orgAvatar]}>
          <Ionicons name="business-outline" size={18} color="#fff" />
        </View>
      );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => startDirectMessage(item)}
      disabled={loadingConversation}
    >
      {renderUserAvatar(item)}
      <View style={styles.listItemInfo}>
        <Text style={styles.listItemName}>{item.display_name || 'Unbekannter Benutzer'}</Text>
      </View>
      {loadingConversation && selectedTargetId === item.id && (
           <ActivityIndicator size="small" color="#4285F4" style={styles.itemLoadingIndicator}/>
      )}
    </TouchableOpacity>
  );

  const renderOrganizationItem = ({ item }) => (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => startDirectMessage(item)}
        disabled={loadingConversation}
      >
        {renderOrgAvatar(item)}
        <View style={styles.listItemInfo}>
          <Text style={styles.listItemName}>{item.name}</Text>
        </View>
        {loadingConversation && selectedTargetId === item.id && (
             <ActivityIndicator size="small" color="#4285F4" style={styles.itemLoadingIndicator}/>
        )}
      </TouchableOpacity>
    );

  const renderContent = () => {
     if (!user) {
        return (
             <View style={styles.centerContainer}>
                <Ionicons name="lock-closed-outline" size={40} color="#888" />
                <Text style={styles.infoText}>{"Bitte melde dich an, um Nachrichten zu senden."}</Text>
                 <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.buttonText}>Zum Profil</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (isOfflineMode) {
         return (
            <View style={styles.centerContainer}>
                <Ionicons name="cloud-offline-outline" size={40} color="#888" />
                <Text style={styles.infoText}>{"Nachrichten sind offline nicht verfügbar."}</Text>
            </View>
        );
    }

    return (
      <ScrollView
         style={styles.contentContainer}
         keyboardShouldPersistTaps="handled"
         showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Benutzer suchen</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nach Name suchen (min. 3 Zeichen)..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchUsers(text);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setSearchError(null); }} style={styles.clearIconContainer}>
                  <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
          )}
        </View>

        {isSearching && (
          <View style={styles.listLoadingContainer}>
            <ActivityIndicator size="small" color="#4285F4" />
            <Text style={styles.loadingText}>Suche Benutzer...</Text>
          </View>
        )}

        {!isSearching && searchError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={24} color="#ff3b30" />
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {!isSearching && !searchError && searchQuery.length >= 3 && searchResults.length === 0 && (
           <View style={styles.emptyListContainer}>
             <Text style={styles.emptyText}>Keine Benutzer für "{searchQuery}" gefunden.</Text>
           </View>
        )}

        {!isSearching && !searchError && searchResults.length > 0 && (
          <FlatList
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={item => `user-${item.id}`}
            scrollEnabled={false}
          />
        )}

        <Text style={styles.sectionTitle}>Organisationen direkt anschreiben</Text>
        {loadingOrganizations && (
            <View style={styles.listLoadingContainer}>
                <ActivityIndicator size="small" color="#4285F4" />
                <Text style={styles.loadingText}>Lade Organisationen...</Text>
            </View>
        )}
        {!loadingOrganizations && orgError && (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={24} color="#ff3b30" />
                <Text style={styles.errorText}>{orgError}</Text>
            </View>
        )}
        {!loadingOrganizations && !orgError && organizations.length === 0 && (
            <View style={styles.emptyListContainer}>
                <Text style={styles.emptyText}>Keine Organisationen gefunden.</Text>
            </View>
        )}
        {!loadingOrganizations && !orgError && organizations.length > 0 && (
             <FlatList
                data={organizations}
                renderItem={renderOrganizationItem}
                keyExtractor={item => `org-${item.id}`}
                scrollEnabled={false}
             />
        )}

        <Text style={styles.sectionTitle}>Direktnachricht an Personen</Text>
        {loadingPublicUsers && (
            <View style={styles.listLoadingContainer}>
                <ActivityIndicator size="small" color="#4285F4" />
                <Text style={styles.loadingText}>Lade Benutzer...</Text>
            </View>
        )}
        {!loadingPublicUsers && publicUsersError && (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={24} color="#ff3b30" />
                <Text style={styles.errorText}>{publicUsersError}</Text>
            </View>
        )}
        {!loadingPublicUsers && !publicUsersError && publicUsers.length === 0 && (
            <View style={styles.emptyListContainer}>
                <Text style={styles.emptyText}>Noch keine Benutzer in der Liste.</Text>
            </View>
        )}
        {!loadingPublicUsers && !publicUsersError && publicUsers.length > 0 && (
            <FlatList
               data={publicUsers}
               renderItem={renderUserItem}
               keyExtractor={item => `public-user-${item.id}`}
               scrollEnabled={false}
            />
        )}

      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Neue Nachricht" showBackButton={true} navigation={navigation}/>
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentContainer: {
     flex: 1,
     paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearIconContainer: {
     paddingLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 5,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatar: {
    backgroundColor: '#4285F4',
  },
  orgAvatar: {
    backgroundColor: '#34A853',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listItemInfo: {
      flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
   listItemDetail: {
    fontSize: 13,
    color: '#777',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listLoadingContainer: {
      paddingVertical: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
  },
  errorContainer: {
      paddingVertical: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 15,
  },
   errorText: {
    marginLeft: 10,
    color: '#ff3b30',
    textAlign: 'center',
  },
  infoText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
   button: {
    backgroundColor: '#4285F4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 15,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyListContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  emptyText: {
    marginTop: 5,
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  itemLoadingIndicator: {
    marginLeft: 'auto',
    paddingRight: 10,
  },
});

export default NewDirectMessageScreen; 