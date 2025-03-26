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
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { user, displayName } = useAuth();
  
  // State for event data
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for comments and reactions
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingReaction, setAddingReaction] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  
  // State for attendance
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState(null); // 'attending', 'maybe', 'declined', or null
  const [changingAttendance, setChangingAttendance] = useState(false);
  
  // Load event, comments, reactions, and attendance on component mount
  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  // Fetch the full event data from Supabase
  const fetchEventData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the event
      const { data: eventData, error: eventError } = await supabase
        .from('event_listings')
        .select('*')
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
      
      // Fetch comments
      fetchComments();
      
      // Fetch reactions
      fetchReactions();
      
      // Fetch attendees and check user's attendance status
      fetchAttendees();
      
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
  
  // Fetch attendees for the event and check user's attendance status
  const fetchAttendees = async () => {
    try {
      setLoadingAttendees(true);
      
      // Get all attendees for this event
      const { data, error } = await supabase
        .from('event_attendees_with_users')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching attendees:', error);
        return;
      }
      
      setAttendees(data || []);
      
      // Check if user is already attending
      if (user) {
        const userAttendance = data?.find(attendee => attendee.user_id === user.id);
        if (userAttendance) {
          setAttendanceStatus(userAttendance.status);
        } else {
          setAttendanceStatus(null);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching attendees:', err);
    } finally {
      setLoadingAttendees(false);
    }
  };
  
  // Add or update attendance status
  const updateAttendance = async (status) => {
    if (!user) {
      Alert.alert(
        'Permanenten Account erstellen',
        'Bitte erstelle einen permanenten Account, um an diesem Event teilzunehmen.',
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
      setChangingAttendance(true);
      
      let operation;
      
      // Check if user already has an attendance record
      if (attendanceStatus) {
        // User is already in the attendance list, update their status
        if (attendanceStatus === status) {
          // If clicking the same status, remove the attendance record
          const { error: deleteError } = await supabase
            .from('event_attendees')
            .delete()
            .eq('event_id', eventId)
            .eq('user_id', user.id);
          
          if (deleteError) {
            console.error('Error removing attendance:', deleteError);
            Alert.alert('Fehler', 'Status konnte nicht aktualisiert werden.');
            return;
          }
          
          setAttendanceStatus(null);
          operation = 'removed';
        } else {
          // Update to new status
          const { error: updateError } = await supabase
            .from('event_attendees')
            .update({ status })
            .eq('event_id', eventId)
            .eq('user_id', user.id);
          
          if (updateError) {
            console.error('Error updating attendance:', updateError);
            Alert.alert('Fehler', 'Status konnte nicht aktualisiert werden.');
            return;
          }
          
          setAttendanceStatus(status);
          operation = 'updated';
        }
      } else {
        // Add new attendance record
        const { error: insertError } = await supabase
          .from('event_attendees')
          .insert({
            event_id: eventId,
            user_id: user.id,
            status
          });
        
        if (insertError) {
          console.error('Error adding attendance:', insertError);
          Alert.alert('Fehler', 'Teilnahme konnte nicht gespeichert werden.');
          return;
        }
        
        setAttendanceStatus(status);
        operation = 'added';
      }
      
      // Refresh attendees list
      fetchAttendees();
      
      // Also refresh the event to update attendee count
      fetchEventData();
      
      // Show success message
      const messages = {
        attending: 'Du nimmst an diesem Event teil!',
        maybe: 'Du hast Interesse an diesem Event bekundet.',
        declined: 'Du hast abgesagt.',
        removed: 'Deine Teilnahme wurde zurückgezogen.'
      };
      
      const message = operation === 'removed' 
        ? messages.removed 
        : messages[status];
      
      Alert.alert('Status aktualisiert', message);
      
    } catch (err) {
      console.error('Unexpected error updating attendance:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setChangingAttendance(false);
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
  
  const renderAttendanceButtons = () => {
    const isAttending = attendanceStatus === 'attending';
    const isMaybe = attendanceStatus === 'maybe';
    const isDeclined = attendanceStatus === 'declined';
    
    return (
      <View style={styles.attendanceButtonsContainer}>
        <TouchableOpacity 
          style={[
            styles.attendanceButton, 
            isAttending && styles.activeAttendanceButton,
            changingAttendance && styles.disabledButton
          ]}
          onPress={() => updateAttendance('attending')}
          disabled={changingAttendance}
        >
          <Ionicons 
            name={isAttending ? "checkmark-circle" : "checkmark-circle-outline"} 
            size={20} 
            color={isAttending ? "#fff" : "#4285F4"} 
          />
          <Text style={[
            styles.attendanceButtonText,
            isAttending && styles.activeAttendanceButtonText
          ]}>Teilnehmen</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.attendanceButton, 
            isMaybe && styles.activeAttendanceButton,
            changingAttendance && styles.disabledButton
          ]}
          onPress={() => updateAttendance('maybe')}
          disabled={changingAttendance}
        >
          <Ionicons 
            name={isMaybe ? "help-circle" : "help-circle-outline"} 
            size={20} 
            color={isMaybe ? "#fff" : "#4285F4"} 
          />
          <Text style={[
            styles.attendanceButtonText,
            isMaybe && styles.activeAttendanceButtonText
          ]}>Vielleicht</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.attendanceButton, 
            isDeclined && styles.activeDeclinedButton,
            changingAttendance && styles.disabledButton
          ]}
          onPress={() => updateAttendance('declined')}
          disabled={changingAttendance}
        >
          <Ionicons 
            name={isDeclined ? "close-circle" : "close-circle-outline"} 
            size={20} 
            color={isDeclined ? "#fff" : "#4285F4"} 
          />
          <Text style={[
            styles.attendanceButtonText,
            isDeclined && styles.activeAttendanceButtonText
          ]}>Absagen</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const renderAttendeeSummary = () => {
    if (!event || !event.attendees) return null;
    
    const attending = event.attendees.attending || 0;
    const maybe = event.attendees.maybe || 0;
    const declined = event.attendees.declined || 0;
    
    return (
      <View style={styles.attendeeSummaryContainer}>
        <Text style={styles.attendeeSummaryTitle}>Teilnehmer</Text>
        <View style={styles.attendeeSummaryRow}>
          <View style={styles.attendeeSummaryItem}>
            <Ionicons name="checkmark-circle" size={18} color="#34A853" />
            <Text style={styles.attendeeSummaryCount}>{attending}</Text>
            <Text style={styles.attendeeSummaryLabel}>Zusagen</Text>
          </View>
          
          <View style={styles.attendeeSummaryItem}>
            <Ionicons name="help-circle" size={18} color="#FBBC05" />
            <Text style={styles.attendeeSummaryCount}>{maybe}</Text>
            <Text style={styles.attendeeSummaryLabel}>Vielleicht</Text>
          </View>
          
          <View style={styles.attendeeSummaryItem}>
            <Ionicons name="close-circle" size={18} color="#EA4335" />
            <Text style={styles.attendeeSummaryCount}>{declined}</Text>
            <Text style={styles.attendeeSummaryLabel}>Absagen</Text>
          </View>
        </View>
      </View>
    );
  };
  
  const renderComment = ({ item }) => {
    return (
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{item.user_name}</Text>
          <Text style={styles.commentTime}>{item.time}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#4285F4" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerType}>{event.category}</Text>
        </View>
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
            <Text style={styles.eventMetaText}>{event.formatted_date}</Text>
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
        
        {renderAttendanceButtons()}
        
        {renderAttendeeSummary()}
        
        <Text style={styles.descriptionTitle}>Beschreibung</Text>
        <Text style={styles.eventDescription}>{event.description}</Text>
        
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
              renderItem={renderComment}
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
    </SafeAreaView>
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
  backButtonText: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    flex: 1,
  },
  headerType: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
    marginBottom: 20,
    marginTop: 5,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
  },
  activeAttendanceButton: {
    backgroundColor: '#4285F4',
  },
  activeDeclinedButton: {
    backgroundColor: '#EA4335',
  },
  disabledButton: {
    opacity: 0.5,
  },
  attendanceButtonText: {
    fontSize: 13,
    color: '#4285F4',
    marginLeft: 4,
  },
  activeAttendanceButtonText: {
    color: '#fff',
  },
  attendeeSummaryContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  attendeeSummaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#444',
  },
  attendeeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attendeeSummaryItem: {
    alignItems: 'center',
  },
  attendeeSummaryCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  attendeeSummaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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