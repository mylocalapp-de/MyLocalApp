import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Dimensions, Platform, ActivityIndicator, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');
// Detect device size for proper styling
const isSmallScreen = width < 380 || height < 700;
//const isAndroidEmulator = (width === 720 && height === 1280) || (width === 1080 && height === 2400);

// Configure German locale for calendar
LocaleConfig.locales['de'] = {
  monthNames: [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember'
  ],
  monthNamesShort: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Jun.', 'Jul.', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  dayNames: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  dayNamesShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  today: 'Heute'
};
LocaleConfig.defaultLocale = 'de';

const CalendarScreen = ({ navigation }) => {
  const calendarFilters = ['Alle', 'Sport', 'Vereine', 'Gemeindeamt', 'Kultur'];
  const [selectedDates, setSelectedDates] = useState({});
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [visibleEvents, setVisibleEvents] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Alle');
  
  // Get user from AuthContext
  const { user } = useAuth();
  
  // Fetch events from Supabase
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch events from the event_listings view
      const { data, error } = await supabase
        .from('event_listings')
        .select('*');
      
      if (error) {
        console.error('Error fetching events:', error);
        setError('Could not load events. Please try again later.');
      } else {
        // Process and format the event data
        const formattedEvents = data.map(event => ({
          id: event.id,
          title: event.title,
          time: event.time,
          date: event.date,
          location: event.location,
          category: event.category,
          description: event.description,
          attendees: event.attendees || {}, // Attendee data from the view
          formatted_date: event.formatted_date
        }));
        
        setEvents(formattedEvents);
        
        // Create initial marked dates for events
        const initialMarkedDates = {};
        formattedEvents.forEach(event => {
          initialMarkedDates[event.date] = {
            marked: true,
            dotColor: '#4285F4'
          };
        });
        setSelectedDates(initialMarkedDates);
        
        // Pre-select a date range if events are available
        if (formattedEvents.length > 0) {
          // Sort events by date to find the earliest one
          const sortedEvents = [...formattedEvents].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
          );
          
          const earliestEventDate = sortedEvents[0].date;
          // Get the date 5 days later for the range
          const laterDate = new Date(earliestEventDate);
          laterDate.setDate(laterDate.getDate() + 5);
          const laterDateString = laterDate.toISOString().split('T')[0];
          
          setDateRange({ startDate: earliestEventDate, endDate: laterDateString });
          createDateRange(earliestEventDate, laterDateString);
        } else {
          // If no events, select current date as default
          const today = new Date().toISOString().split('T')[0];
          setDateRange({ startDate: today, endDate: '' });
          
          // Set marked dates with just today highlighted
          const newSelectedDates = { ...initialMarkedDates };
          newSelectedDates[today] = {
            ...(newSelectedDates[today] || {}),
            selected: true,
            startingDay: true,
            color: '#4285F4',
            textColor: 'white',
            dotColor: newSelectedDates[today]?.marked ? 'white' : undefined
          };
          
          setSelectedDates(newSelectedDates);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching events:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update visible events whenever the date range or filter changes
  useEffect(() => {
    updateVisibleEvents();
  }, [dateRange, activeFilter, events]);

  const updateVisibleEvents = () => {
    // First filter by date range
    let filteredEvents = getEventsInRange();
    
    // Then filter by category if needed
    if (activeFilter !== 'Alle') {
      filteredEvents = filteredEvents.filter(event => event.category === activeFilter);
    }
    
    setVisibleEvents(filteredEvents);
  };

  const onDayPress = (day) => {
    console.log('Selected day:', day.dateString);
    
    // If we already have both start and end date, reset and set new start date
    if (dateRange.startDate && dateRange.endDate) {
      setDateRange({ startDate: day.dateString, endDate: '' });
      
      // Set marked dates with just the start date highlighted
      const newSelectedDates = {};
      
      // Keep the event markers
      events.forEach(event => {
        newSelectedDates[event.date] = {
          marked: true,
          dotColor: '#4285F4'
        };
      });
      
      // Add selection for the clicked date
      newSelectedDates[day.dateString] = {
        ...(newSelectedDates[day.dateString] || {}),
        selected: true,
        startingDay: true,
        color: '#4285F4',
        textColor: 'white',
        dotColor: newSelectedDates[day.dateString]?.marked ? 'white' : undefined
      };
      
      setSelectedDates(newSelectedDates);
      return;
    }
    
    // If we don't have a start date yet, set it
    if (!dateRange.startDate) {
      setDateRange({ startDate: day.dateString, endDate: '' });
      
      // Set marked dates with just the start date highlighted
      const newSelectedDates = {};
      
      // Keep the event markers
      events.forEach(event => {
        newSelectedDates[event.date] = {
          marked: true,
          dotColor: '#4285F4'
        };
      });
      
      // Add selection for the clicked date
      newSelectedDates[day.dateString] = {
        ...(newSelectedDates[day.dateString] || {}),
        selected: true,
        startingDay: true,
        color: '#4285F4',
        textColor: 'white',
        dotColor: newSelectedDates[day.dateString]?.marked ? 'white' : undefined
      };
      
      setSelectedDates(newSelectedDates);
      return;
    }
    
    // If we have a start date but no end date
    if (dateRange.startDate && !dateRange.endDate) {
      // Ensure end date is after start date
      const start = new Date(dateRange.startDate);
      const end = new Date(day.dateString);
      
      // If trying to select a date before the start date, swap them
      if (end < start) {
        const newEndDate = dateRange.startDate;
        const newStartDate = day.dateString;
        setDateRange({ startDate: newStartDate, endDate: newEndDate });
        
        // Create a range
        createDateRange(newStartDate, newEndDate);
      } else {
        setDateRange({ ...dateRange, endDate: day.dateString });
        
        // Create a range
        createDateRange(dateRange.startDate, day.dateString);
      }
    }
  };
  
  // Helper function to create a range of dates
  const createDateRange = (start, end) => {
    const range = {};
    
    // First, mark all event dates
    events.forEach(event => {
      range[event.date] = {
        marked: true,
        dotColor: '#4285F4'
      };
    });
    
    // Mark start date
    range[start] = {
      ...(range[start] || {}),
      selected: true,
      startingDay: true,
      endingDay: start === end,
      color: '#4285F4',
      textColor: 'white',
      dotColor: range[start]?.marked ? 'white' : undefined
    };
    
    // Only add dates in between if there's actually a range
    if (start !== end) {
      // Mark all dates in between
      let date = new Date(start);
      date.setDate(date.getDate() + 1);
      
      const endDate = new Date(end);
      while (date < endDate) {
        const dateStr = date.toISOString().split('T')[0];
        range[dateStr] = {
          ...(range[dateStr] || {}),
          selected: true,
          color: '#80b3ff', // lighter blue
          textColor: 'white',
          dotColor: range[dateStr]?.marked ? 'white' : undefined
        };
        date.setDate(date.getDate() + 1);
      }
      
      // Mark end date
      range[end] = {
        ...(range[end] || {}),
        selected: true,
        endingDay: true,
        color: '#4285F4',
        textColor: 'white',
        dotColor: range[end]?.marked ? 'white' : undefined
      };
    }
    
    setSelectedDates(range);
  };

  // Get events in the selected date range
  const getEventsInRange = () => {
    if (!dateRange.startDate) return [];
    
    if (!dateRange.endDate) {
      // If only one date is selected
      return events.filter(event => event.date === dateRange.startDate);
    }
    
    // If a date range is selected
    return events.filter(event => {
      const eventDate = event.date;
      return eventDate >= dateRange.startDate && eventDate <= dateRange.endDate;
    });
  };

  const formatDateRange = () => {
    if (!dateRange.startDate) return '';
    
    const startDate = new Date(dateRange.startDate);
    const formattedStart = `${String(startDate.getDate()).padStart(2, '0')}.${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    
    if (!dateRange.endDate) return `Alle Events am ${formattedStart}`;
    
    const endDate = new Date(dateRange.endDate);
    const formattedEnd = `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}`;
    
    return `Alle Events vom ${formattedStart} bis ${formattedEnd}`;
  };

  const renderEvent = ({ item }) => {
    const eventDate = new Date(item.date);
    const formattedDate = `${String(eventDate.getDate()).padStart(2, '0')}.${String(eventDate.getMonth() + 1).padStart(2, '0')}.`;
    
    // Get attendee count if available
    let attendeeCount = 0;
    if (item.attendees && item.attendees.attending) {
      attendeeCount = parseInt(item.attendees.attending) || 0;
    }
    
    return (
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      >
        <View style={styles.eventContainer}>
          <View style={styles.eventImagePlaceholder}>
            {/* This is a placeholder for an event image/icon */}
          </View>
          <View style={styles.eventContent}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={24} color="#333" />
            </View>
            <Text style={styles.eventDateTime}>Am {formattedDate} {item.time}</Text>
            <View style={styles.eventFooter}>
              <Text style={styles.eventLocation}>Uhr am {item.location}</Text>
              {attendeeCount > 0 && (
                <View style={styles.attendeesInfo}>
                  <Ionicons name="people" size={14} color="#666" />
                  <Text style={styles.attendeesCount}>{attendeeCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Smart calendar height calculation based on device
  const getCalendarHeight = () => {
    if (isSmallScreen) {
      return 290; // iPhone SE and similar small screens
    } else {
      // Default for regular screens
      return Math.min(330, height * 0.35); 
    }
  };

  const calendarHeight = getCalendarHeight();

  // Handle navigation to create event screen
  const handleCreateEvent = () => {
    if (user) {
      navigation.navigate('CreateEvent');
    } else {
      // Optionally prompt user to log in or show an alert
      Alert.alert('Anmeldung erforderlich', 'Bitte melde dich an, um ein Event zu erstellen.');
      // navigation.navigate('Profile'); // Or navigate to login/profile
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Events werden geladen...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader filters={calendarFilters} onFilterChange={setActiveFilter} />
      
      <View style={styles.content}>
        <View style={styles.calendarSection}>
          <Calendar
            markingType={'period'}
            onDayPress={onDayPress}
            markedDates={selectedDates}
            enableSwipeMonths={true}
            current={dateRange.startDate || new Date().toISOString().split('T')[0]}
            hideExtraDays={false}
            style={styles.calendar}
            height={calendarHeight}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#666',
              selectedDayBackgroundColor: '#4285F4',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#4285F4',
              dayTextColor: '#333',
              textDisabledColor: '#d9e1e8',
              dotColor: '#4285F4',
              selectedDotColor: '#ffffff',
              arrowColor: '#333',
              monthTextColor: '#333',
              textDayFontSize: isSmallScreen ? 11 : 14,
              textMonthFontSize: isSmallScreen ? 14 : 16,
              textDayHeaderFontSize: isSmallScreen ? 10 : 12,
              weekVerticalMargin: 0,
              'stylesheet.calendar.header': {
                header: {
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingLeft: 10,
                  paddingRight: 10,
                  marginTop: 4,
                  marginBottom: 0,
                  alignItems: 'center'
                },
                monthText: {
                  fontSize: isSmallScreen ? 14 : 16,
                  fontWeight: 'bold'
                },
                week: {
                  marginTop: 0,
                  marginBottom: 0,
                  flexDirection: 'row',
                  justifyContent: 'space-around'
                }
              },
              'stylesheet.day.period': {
                base: {
                  width: isSmallScreen ? 25 : 32,
                  height: isSmallScreen ? 22 : 28,
                  alignItems: 'center',
                  overflow: 'hidden'
                },
                fillers: {
                  position: 'absolute',
                  height: '100%',
                  flexDirection: 'row',
                  left: 0,
                  right: 0
                },
                leftFiller: {
                  height: '100%',
                  flex: 1
                },
                rightFiller: {
                  height: '100%',
                  flex: 1
                }
              },
              'stylesheet.day.basic': {
                base: {
                  width: isSmallScreen ? 25 : 32,
                  height: isSmallScreen ? 22 : 28,
                  alignItems: 'center'
                },
                text: {
                  marginTop: isSmallScreen ? 0 : 2,
                  fontSize: isSmallScreen ? 11 : 14
                },
                dot: {
                  width: 4,
                  height: 4,
                  marginTop: -2,
                  borderRadius: 2
                }
              },
              'stylesheet.calendar.main': {
                container: {
                  paddingBottom: 0,
                },
                week: {
                  marginTop: 0,
                  marginBottom: 0,
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  height: isSmallScreen ? 25 : 32
                },
                dayContainer: {
                  flex: 1,
                  alignItems: 'center'
                }
              }
            }}
          />

          {dateRange.startDate && (
            <View style={styles.eventsHeader}>
              <Text style={styles.eventsHeaderText}>
                {formatDateRange()}
              </Text>
            </View>
          )}
        </View>
        
        <FlatList
          data={visibleEvents}
          renderItem={renderEvent}
          keyExtractor={item => item.id.toString()}
          style={styles.eventsList}
          contentContainerStyle={styles.eventsListContent}
          ListEmptyComponent={
            dateRange.startDate ? (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>Keine Events in diesem Zeitraum</Text>
              </View>
            ) : null
          }
        />
      </View>
      
      {user && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleCreateEvent}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  calendarSection: {
    backgroundColor: '#fff',
  },
  calendar: {
    width: '100%',
    backgroundColor: '#fff',
  },
  eventsHeader: {
    padding: 4,
    paddingHorizontal: 15,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#ddd',
    borderBottomColor: '#ddd',
  },
  eventsHeaderText: {
    fontSize: 14,
    color: '#666',
  },
  eventsList: {
    flex: 1,
  },
  eventsListContent: {
    paddingTop: 0,
  },
  noEventsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noEventsText: {
    color: '#666',
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 15,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  eventDateTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 14,
    color: '#888',
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeesCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
});

export default CalendarScreen; 