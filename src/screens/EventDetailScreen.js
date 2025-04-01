import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ActionSheetIOS
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Menu, Provider } from 'react-native-paper';

const { height } = Dimensions.get('window');
const androidPaddingTop = height * 0.05; // 3% of screen height for better scaling

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { user, displayName } = useAuth();
  
  // State for event data
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organizerName, setOrganizerName] = useState('Organisator');
  const [isOrganizer, setIsOrganizer] = useState(false);
  
  // State for comments and reactions
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingReaction, setAddingReaction] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  
  // State for attendance
  const [attendees, setAttendees] = useState({ attending: 0, maybe: 0, declined: 0 });
  const [userStatus, setUserStatus] = useState(null); // 'attending', 'maybe', 'declined', or null
  const [attendeesList, setAttendeesList] = useState([]); // For displaying names/avatars
  const [loadingAttendeesList, setLoadingAttendeesList] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // State for options menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Show and hide menu for Android
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);
  
  // Load event, comments, reactions, and attendance on component mount
  useEffect(() => {
    fetchEventData();
    fetchUserAttendanceStatus();
    fetchAttendeesList();
  }, [eventId, user]);

  // Fetch the full event data from Supabase
  const fetchEventData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the event with organizer info
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          profiles:organizer_id (
            display_name
          )
        `)
        .eq('id', eventId)
        .single();
      
      if (eventError) {
        console.error('Error fetching event:', eventError);
        setError('Could not load event. Please try again later.');
        return;
      }
      
      if (!eventData) {
        setError('Event not found.');
        return;
      }
      
      // Set the event
      setEvent(eventData);
      
      // Set organizer name
      // Use the joined profiles table for the display name
      if (eventData.profiles && eventData.profiles.display_name) {
        setOrganizerName(eventData.profiles.display_name);
      } else {
        // Fallback if profile is somehow missing or name is null
        setOrganizerName('Organisator'); 
      }
      
      // Check if current user is the organizer
      if (user && eventData.organizer_id === user.id) {
        setIsOrganizer(true);
      }
      
      // Fetch comments
      fetchComments();
      
      // Fetch reactions
      fetchReactions();
      
      // Fetch attendee counts
      fetchAttendeeCounts();
      
    } catch (err) {
      console.error('Unexpected error fetching event:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch comments for the event
  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      
      const { data, error } = await supabase
        .from('event_comments_with_users')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }
      
      setComments(data || []);
    } catch (err) {
      console.error('Unexpected error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };
  
  // Fetch reaction counts for the event
  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_event_reactions', { event_uuid: eventId });
      
      if (error) {
        console.error('Error fetching reactions:', error);
        return;
      }
      
      setReactions(data || {});
    } catch (err) {
      console.error('Unexpected error fetching reactions:', err);
    }
  };
  
  // Fetch attendee counts
  const fetchAttendeeCounts = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_event_attendees', { event_uuid: eventId });

      if (error) {
        console.error('Error fetching attendee counts:', error);
        return;
      }
      setAttendees(data || { attending: 0, maybe: 0, declined: 0 });
    } catch (err) {
      console.error('Unexpected error fetching counts:', err);
    }
  };
  
  // Fetch the current user's attendance status
  const fetchUserAttendanceStatus = async () => {
    if (!user) {
      setUserStatus(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user status:', error);
      } else {
        setUserStatus(data?.status || null);
      }
    } catch (err) {
      console.error('Unexpected error fetching user status:', err);
    }
  };
  
  // Fetch the list of attendees (names and avatars)
  const fetchAttendeesList = async () => {
    try {
      setLoadingAttendeesList(true);
      const { data, error } = await supabase
        .from('event_attendees_with_users') // Use the view with user info
        .select('user_id, user_name, status') // Removed avatar_url from select
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching attendees list:', error);
      } else {
        setAttendeesList(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching attendees list:', err);
    } finally {
      setLoadingAttendeesList(false);
    }
  };
  
  // Handle user changing their attendance status
  const handleSetAttendance = async (status) => {
    if (!user) {
      Alert.alert('Anmeldung erforderlich', 'Bitte melde dich an, um teilzunehmen.');
      return;
    }
    if (updatingStatus) return;

    try {
      setUpdatingStatus(true);
      const currentStatus = userStatus;
      const newStatus = currentStatus === status ? null : status; // Toggle off if same status clicked

      // Update UI immediately for responsiveness
      setUserStatus(newStatus);

      if (newStatus === null && currentStatus) {
        // Delete the attendance record
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else if (newStatus) {
        // Upsert the attendance record (insert or update)
        const { error } = await supabase
          .from('event_attendees')
          .upsert({ event_id: eventId, user_id: user.id, status: newStatus }, { onConflict: 'event_id, user_id' });
        if (error) throw error;
      }

      // Refresh counts and attendee list after successful update
      fetchAttendeeCounts();
      fetchAttendeesList();

    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('Fehler', 'Teilnahmestatus konnte nicht aktualisiert werden.');
      // Revert UI on error
      setUserStatus(userStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!user || !isOrganizer) {
      Alert.alert('Fehler', 'Du bist nicht berechtigt, dieses Event zu löschen.');
      return;
    }

    Alert.alert(
      'Event löschen',
      'Möchtest du dieses Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);

              // Use RPC to delete the event, passing the organizer ID
              const { data, error } = await supabase
                .rpc('delete_event', {
                  p_event_id: eventId,
                  p_organizer_id: user.id
                });

              if (error || data === false) {
                console.error('Error deleting event with RPC:', error);
                Alert.alert('Fehler', 'Event konnte nicht gelöscht werden.');
                return;
              }

              Alert.alert(
                'Erfolg',
                'Dein Event wurde erfolgreich gelöscht.',
                [{ text: 'OK', onPress: () => navigation.navigate('CalendarList') }]
              );
            } catch (err) {
              console.error('Unexpected error deleting event:', err);
              Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
            } finally {
              setIsDeleting(false);
              closeMenu();
            }
          }
        }
      ]
    );
  };

  // Handle event editing
  const handleEditEvent = () => {
    if (!user || !isOrganizer) {
      Alert.alert('Fehler', 'Du bist nicht berechtigt, dieses Event zu bearbeiten.');
      return;
    }

    navigation.navigate('EditEvent', { eventId });
    closeMenu();
  };

  // Show options menu based on platform
  const showOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Abbrechen', 'Event bearbeiten', 'Event löschen'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
          userInterfaceStyle: 'light'
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditEvent();
          } else if (buttonIndex === 2) {
            handleDeleteEvent();
          }
        }
      );
    } else {
      openMenu(); // Show Android menu
    }
  };
  
  // Add a comment
  const addComment = async () => {
    if (!comment.trim()) return;
    
    if (!user) {
      Alert.alert(
        'Permanenten Account erstellen',
        'Bitte erstelle einen permanenten Account, um einen Kommentar zu hinterlassen.',
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Zum Profil', 
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      return;
    }
    
    try {
      setAddingComment(true);
      
      const { data, error } = await supabase
        .from('event_comments')
        .insert({
          event_id: eventId,
          user_id: user.id,
          text: comment
        });
      
      if (error) {
        console.error('Error adding comment:', error);
        Alert.alert('Fehler', 'Kommentar konnte nicht gespeichert werden.');
        return;
      }
      
      // Refresh comments
      fetchComments();
      
      // Clear comment input
      setComment('');
    } catch (err) {
      console.error('Unexpected error adding comment:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setAddingComment(false);
    }
  };
  
  // Add a reaction
  const addReaction = async (emoji) => {
    if (!user) {
      Alert.alert(
        'Permanenten Account erstellen',
        'Bitte erstelle einen permanenten Account, um zu reagieren.',
        [
          { text: 'OK', style: 'cancel' },
          { 
            text: 'Zum Profil', 
            onPress: () => navigation.navigate('Profile')
          }
        ]
      );
      setShowEmojiPicker(false);
      return;
    }
    
    try {
      setAddingReaction(true);
      
      // First check if user already reacted with this emoji
      const { data: existingReaction, error: checkError } = await supabase
        .from('event_reactions')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking reaction:', checkError);
        return;
      }
      
      if (existingReaction) {
        // User already reacted with this emoji, so remove the reaction
        const { error: deleteError } = await supabase
          .from('event_reactions')
          .delete()
          .eq('id', existingReaction.id);
          
        if (deleteError) {
          console.error('Error removing reaction:', deleteError);
          return;
        }
      } else {
        // Add new reaction
        const { error: insertError } = await supabase
          .from('event_reactions')
          .insert({
            event_id: eventId,
            user_id: user.id,
            emoji: emoji
          });
          
        if (insertError) {
          console.error('Error adding reaction:', insertError);
          return;
        }
      }
      
      // Refresh reactions
      fetchReactions();
      
      // Hide emoji picker
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Unexpected error with reaction:', err);
    } finally {
      setAddingReaction(false);
    }
  };
  
  const emojiOptions = ['👍', '❤️', '😮', '👏', '🤔', '😢'];
  
  const renderReactions = () => {
    if (!reactions || Object.keys(reactions).length === 0) {
      return null;
    }
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactions).map(([emoji, count]) => (
          <TouchableOpacity 
            key={emoji} 
            style={styles.reactionBubble}
            onPress={() => addReaction(emoji)}
          >
            <Text>{emoji} {count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderEmojiPicker = () => {
    if (!showEmojiPicker) return null;
    
    return (
      <View style={styles.emojiPickerContainer}>
        {addingReaction ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          emojiOptions.map(emoji => (
            <TouchableOpacity 
              key={emoji} 
              style={styles.emojiOption}
              onPress={() => addReaction(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Event wird geladen...</Text>
      </SafeAreaView>
    );
  }
  
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#ff3b30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.backButtonTextOnly} // Use text-only style for back button here
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <Provider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#4285F4" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
             <Text style={styles.headerTitle}>{event.title}</Text>
          </View>
          {isOrganizer && (
            <Menu
              visible={menuVisible}
              onDismiss={closeMenu}
              anchor={
                <TouchableOpacity
                  style={styles.optionsButton}
                  onPress={showOptions}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                </TouchableOpacity>
              }
            >
              <Menu.Item
                onPress={handleEditEvent}
                icon="pencil"
                title="Event bearbeiten"
              />
              <Menu.Item
                onPress={handleDeleteEvent}
                icon="delete"
                title="Event löschen"
                titleStyle={{ color: '#ff3b30' }}
              />
            </Menu>
          )}
        </View>
        
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.eventMeta}>
            <View style={styles.eventMetaItem}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.eventMetaText}>
                {event.date ? new Date(event.date).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Datum unbekannt'}
              </Text>
            </View>
            <View style={styles.eventMetaItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.eventMetaText}>{event.time}</Text>
            </View>
            <View style={styles.eventMetaItem}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.eventMetaText}>{event.location}</Text>
            </View>
          </View>
          
          <Text style={styles.descriptionTitle}>Beschreibung</Text>
          <Text style={styles.eventDescription}>{event.description}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Nimmst du teil?</Text>
          <View style={styles.attendanceButtonsContainer}>
            <TouchableOpacity
              style={[styles.attendanceButton, userStatus === 'attending' && styles.attendingSelected]}
              onPress={() => handleSetAttendance('attending')}
              disabled={updatingStatus}
            >
              <Ionicons name={userStatus === 'attending' ? "checkmark-circle" : "checkmark-circle-outline"} size={20} color={userStatus === 'attending' ? '#fff' : '#4CAF50'} />
              <Text style={[styles.attendanceButtonText, userStatus === 'attending' && styles.selectedText]}>Ja ({attendees.attending || 0})</Text>
              {updatingStatus && userStatus === 'attending' && <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader}/>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attendanceButton, userStatus === 'maybe' && styles.maybeSelected]}
              onPress={() => handleSetAttendance('maybe')}
              disabled={updatingStatus}
            >
              <Ionicons name={userStatus === 'maybe' ? "help-circle" : "help-circle-outline"} size={20} color={userStatus === 'maybe' ? '#fff' : '#FFC107'} />
              <Text style={[styles.attendanceButtonText, userStatus === 'maybe' && styles.selectedText]}>Vielleicht ({attendees.maybe || 0})</Text>
               {updatingStatus && userStatus === 'maybe' && <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader}/>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attendanceButton, userStatus === 'declined' && styles.declinedSelected]}
              onPress={() => handleSetAttendance('declined')}
               disabled={updatingStatus}
            >
              <Ionicons name={userStatus === 'declined' ? "close-circle" : "close-circle-outline"} size={20} color={userStatus === 'declined' ? '#fff' : '#F44336'} />
              <Text style={[styles.attendanceButtonText, userStatus === 'declined' && styles.selectedText]}>Nein ({attendees.declined || 0})</Text>
              {updatingStatus && userStatus === 'declined' && <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader}/>}
            </TouchableOpacity>
          </View>
          
          <View style={styles.divider} />
          
          {renderReactions()}
          
          <View style={styles.actionBar}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Ionicons name="happy-outline" size={20} color="#4285F4" />
              <Text style={styles.actionText}>Reaktion</Text>
            </TouchableOpacity>
            
            {renderEmojiPicker()}
          </View>
          
          <View style={styles.commentsSection}>
            <Text style={styles.commentsHeader}>Kommentare ({comments.length})</Text>
            
            {loadingComments ? (
              <ActivityIndicator size="small" color="#4285F4" style={styles.commentsLoading} />
            ) : (
              <FlatList
                data={comments}
                renderItem={({ item }) => {
                  // Format comment time
                  const commentDate = new Date(item.created_at);
                  const formattedTime = `${commentDate.getHours().toString().padStart(2, '0')}:${commentDate.getMinutes().toString().padStart(2, '0')}`;
                  const formattedDate = `${commentDate.getDate().toString().padStart(2, '0')}.${(commentDate.getMonth() + 1).toString().padStart(2, '0')}.${commentDate.getFullYear()}`;
                  
                  // Get user name from profiles relation
                  const userName = item.profiles?.display_name || 'Unbekannt';

                  return (
                    <View style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUser}>{userName}</Text> 
                        <Text style={styles.commentTime}>{`${formattedDate} ${formattedTime}`}</Text>
                      </View>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  );
                }}
                keyExtractor={item => item.id.toString()}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={styles.emptyCommentsText}>
                    Noch keine Kommentare. Sei der Erste, der einen Kommentar hinterlässt!
                  </Text>
                }
              />
            )}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.attendeesSection}>
            <Text style={styles.sectionTitle}>Teilnehmerliste ({attendeesList.length})</Text>
            {loadingAttendeesList ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : attendeesList.length > 0 ? (
              attendeesList.map(item => {
                // Get user name from the view directly
                const attendeeName = item.user_name; // Corrected: Use user_name from the view
                
                return (
                  <View key={item.user_id} style={styles.attendeeItem}>
                    <Image
                      source={require('../../assets/avatar_placeholder.png')} // Always use placeholder
                      style={styles.attendeeAvatar}
                    />
                    <Text style={styles.attendeeName}>{attendeeName}</Text>
                    <View style={[styles.statusBadge, styles[`statusBadge_${item.status}`]]}>
                      <Text style={styles.statusBadgeText}>{item.status === 'attending' ? 'Nimmt teil' : item.status === 'maybe' ? 'Vielleicht' : 'Abgelehnt'}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noAttendeesText}>Noch keine Teilnehmer registriert.</Text>
            )}
          </View>
        </ScrollView>
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 90}
          style={styles.inputContainer}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Schreibe einen Kommentar..."
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                (comment.trim() === '' || addingComment) && styles.sendButtonDisabled
              ]} 
              onPress={addComment}
              disabled={comment.trim() === '' || addingComment}
            >
              {addingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color={comment.trim() === '' ? "#ccc" : "#fff"} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        
        {isDeleting && (
          <View style={styles.deleteOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.deleteText}>Event wird gelöscht...</Text>
          </View>
        )}
      </SafeAreaView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
  },
  errorText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonTextOnly: { // Style for the back button in error view
    padding: 10,
  },
  backButtonText: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? androidPaddingTop : 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    justifyContent: 'space-between', // Space items out
  },
  backButton: {
    padding: 5, // Add padding for easier tap
    marginRight: 10,
  },
  headerTitleContainer: {
      flex: 1, // Allow title to take available space
      alignItems: 'center', // Center title horizontally
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  optionsButton: {
    padding: 8,
    marginLeft: 10, // Add some space from title
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 8,
  },
  eventMetaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    color: '#333',
  },
  eventDescription: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },
  attendanceButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  attendanceButton: {
    flex: 1, // Make buttons take equal width
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 4,
    backgroundColor: '#f9f9f9',
  },
  attendanceButtonText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
    color: '#555',
  },
  attendingSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  maybeSelected: {
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
  },
  declinedSelected: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonLoader: {
      marginLeft: 5,
  },
  attendeesSection: {
      marginTop: 10,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attendeeAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginRight: 10,
    backgroundColor: '#eee', // Placeholder background
  },
  attendeeName: {
    fontSize: 14,
    color: '#333',
    flex: 1, // Take remaining space
  },
  statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
  },
  statusBadge_attending: {
      backgroundColor: '#e8f5e9', // Light green
  },
   statusBadge_maybe: {
      backgroundColor: '#fff8e1', // Light yellow
  },
   statusBadge_declined: {
      backgroundColor: '#ffebee', // Light red
  },
  statusBadgeText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#555' // Consider adjusting text color based on badge background
  },
  noAttendeesText: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    padding: 15,
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  reactionBubble: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  actionText: {
    fontSize: 14,
    color: '#4285F4',
    marginLeft: 5,
  },
  emojiPickerContainer: {
    position: 'absolute',
    top: -50,
    left: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  emojiOption: {
    padding: 8,
    marginHorizontal: 5,
  },
  emojiText: {
    fontSize: 20,
  },
  commentsSection: {
    marginTop: 10,
  },
  commentsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
  },
  commentsLoading: {
    marginVertical: 20,
  },
  emptyCommentsText: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  commentItem: {
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444',
  },
  commentTime: {
    fontSize: 12,
    color: '#888',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f1f1f1',
  },
});

export default EventDetailScreen; 