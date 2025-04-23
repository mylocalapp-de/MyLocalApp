import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Dimensions, Platform, ActivityIndicator, Alert, Image } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useNetwork } from '../context/NetworkContext';
import { loadOfflineData } from '../utils/storageUtils';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');
// Detect device size for proper styling
const isSmallScreen = width < 380 || height < 700;
//const isAndroidEmulator = (width === 720 && height === 1280) || (width === 1080 && height === 2400);

// Helper function to transform Supabase Storage URLs
const getTransformedImageUrl = (originalUrl, width = 100, quality = 80) => {
  if (!originalUrl || !originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl;
  }
  return `${originalUrl.replace('/object/public/', '/render/image/public/')}?width=${width}&quality=${quality}`;
};

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

// Helper function to format German date (defined outside component or at the top)
const format_date_german = (date_value) => {
    if (!date_value) return '';
    // Ensure date_value is a Date object
    const dateObj = date_value instanceof Date ? date_value : new Date(date_value);
    // Check if dateObj is valid
    if (isNaN(dateObj.getTime())) {
        return 'Ungültiges Datum';
    }
    // Use UTC methods to format date parts to avoid timezone shifts
    return `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}.`;
};

const CalendarScreen = ({ navigation }) => {
  const [calendarFilters, setCalendarFilters] = useState([{ name: 'Alle', is_highlighted: false }]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [visibleEvents, setVisibleEvents] = useState([]);
  const [allEventsData, setAllEventsData] = useState([]);
  const [currentMonthString, setCurrentMonthString] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Alle');
  
  const { user } = useAuth();
  const { isOrganizationActive, activeOrganizationId } = useOrganization();
  const { isOfflineMode, isConnected } = useNetwork();

  // Fetch or load data based on offline mode
  useEffect(() => {
    if (isOfflineMode) {
      loadDataFromStorage();
    } else {
      fetchEventData();
    }
  }, [isOfflineMode]);

  // Refresh events when screen comes into focus (if online)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isOfflineMode) return; // Don't refresh from network if offline
      // Add a small delay
      const focusTimeout = setTimeout(() => {
        console.log('CalendarScreen focused - Preparing to refresh events...');
        try {
          console.log('CalendarScreen Focus Listener: Current user state before fetch:', user ? `ID: ${user.id}` : 'null');
          fetchEventData();
        } catch (error) {
          console.error("CalendarScreen Focus Listener: Error executing fetchEventData:", error);
        }
      }, 100);
      return () => clearTimeout(focusTimeout);
    });
    return unsubscribe;
  }, [navigation, user, isOfflineMode]);

  // Function to load data from AsyncStorage
  const loadDataFromStorage = async () => {
    console.log("[CalendarScreen] Loading data from offline storage...");
    setIsLoading(true);
    setLoadingFilters(true);
    setError(null);

    try {
      // Load Events
      const offlineEvents = await loadOfflineData('events');
      if (offlineEvents) {
        setAllEventsData(offlineEvents);
        console.log(`[CalendarScreen] Loaded ${offlineEvents.length} events from storage.`);
      } else {
        setError('Keine Offline-Events gefunden. Bitte gehe online und speichere Daten.');
        setAllEventsData([]);
      }

      // Load Filters (Categories)
      // Note: Filters might not be saved yet if saveDataForOffline hasn't been updated/run
      // Let's assume they are saved under 'event_categories' key for consistency
      const offlineFilters = await loadOfflineData('event_categories'); // Assuming this key is used
      if (offlineFilters) {
          const fetchedFilters = offlineFilters.map(cat => ({
              name: cat.name,
              is_highlighted: cat.is_highlighted || false
          }));
          setCalendarFilters([{ name: 'Alle', is_highlighted: false }, ...fetchedFilters]);
          console.log(`[CalendarScreen] Loaded ${fetchedFilters.length} event filters from storage.`);
      } else {
          setCalendarFilters([{ name: 'Alle', is_highlighted: false }]); // Fallback
          console.log('[CalendarScreen] No offline event filters found, using default.');
      }

      // Set initial date range (no change needed, useMemo handles display)
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const mondayString = monday.toISOString().split('T')[0];
      const sundayString = sunday.toISOString().split('T')[0];
      setDateRange({ startDate: mondayString, endDate: sundayString });

    } catch (err) {
      console.error('[CalendarScreen] Error loading data from storage:', err);
      setError('Fehler beim Laden der Offline-Daten.');
      setAllEventsData([]);
      setCalendarFilters([{ name: 'Alle', is_highlighted: false }]);
    } finally {
      setIsLoading(false);
      setLoadingFilters(false);
    }
  };

  const fetchEventData = async () => {
    if (isOfflineMode) return; // Prevent fetching if offline

    setIsLoading(true);
    setLoadingFilters(true);
    setError(null);

    try {
      // Fetch event categories first
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('event_categories')
        .select('name, is_highlighted')
        .order('display_order', { ascending: true });

      if (categoriesError) {
        console.error('Error fetching event categories:', categoriesError);
        Alert.alert('Fehler', 'Fehler beim Laden der Event-Kategorien.');
        setCalendarFilters([{ name: 'Alle', is_highlighted: false }]); // Fallback
      } else {
        // Map to structure { name: string, is_highlighted: boolean }
        const fetchedFilters = categoriesData?.map(cat => ({
            name: cat.name,
            is_highlighted: cat.is_highlighted || false
        })) || [];
        setCalendarFilters([{ name: 'Alle', is_highlighted: false }, ...fetchedFilters]); // Prepend 'Alle' object
      }
      setLoadingFilters(false);

      // Fetch events including recurrence fields
      const { data, error } = await supabase
        .from('event_listings')
        .select('*');
      
      if (error) {
        console.error('Error fetching events:', error);
        setError('Could not load events. Please try again later.');
        setAllEventsData([]);
      } else {
        setAllEventsData(data || []);

        // Set initial date range (e.g., current week) - No change needed here
        // The initial display will be handled by useMemo based on currentMonthString
        const today = new Date();
        const currentDayOfWeek = today.getDay();
        const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const mondayString = monday.toISOString().split('T')[0];
        const sundayString = sunday.toISOString().split('T')[0];
        setDateRange({ startDate: mondayString, endDate: sundayString });
        // Initial marking will be handled by the useMemo below

        // Save categories for offline use (assuming key 'event_categories')
        await loadOfflineData('event_categories', categoriesData || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching events:', err);
      setError('An unexpected error occurred.');
      setAllEventsData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get dates for a specific month
  const getMonthBounds = (monthString) => {
    const year = parseInt(monthString.substring(0, 4), 10);
    const month = parseInt(monthString.substring(5, 7), 10) - 1; // 0-indexed month
    // Use UTC to avoid timezone issues when comparing dates
    const startOfMonth = new Date(Date.UTC(year, month, 1));
    // Get the end of the last day of the month in UTC
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    return { startOfMonth, endOfMonth };
  };

  // Expand recurring events and generate marked dates using useMemo
  const processedEvents = useMemo(() => {
    const { startOfMonth, endOfMonth } = getMonthBounds(currentMonthString);
    const instances = [];
    const marked = {};

    allEventsData.forEach(event => {
      // Ensure event.date is valid before proceeding
      if (!event.date || isNaN(new Date(event.date).getTime())) {
        console.warn(`Skipping event ID ${event.id} due to invalid date: ${event.date}`);
        return; // Skip this event
      }

      if (event.recurrence_rule) {
        try {
          // Ensure dtstart uses UTC for consistency with rule generation
          const dtstart = new Date(Date.parse(event.date + 'T00:00:00Z'));
          const options = { dtstart };

          const rule = rrulestr(event.recurrence_rule, options);

          // Ensure recurrence_end_date is treated as the end of that day UTC
          const recurrenceEndDate = event.recurrence_end_date
             ? new Date(Date.parse(event.recurrence_end_date + 'T23:59:59.999Z'))
             : null;

          // Generate instances within the current calendar view bounds (month)
          // Make sure the 'between' dates are also UTC
          const dates = rule.between(startOfMonth, endOfMonth, true);

          dates.forEach(instanceDate => {
            // instanceDate from rrule is already a Date object (should be UTC if dtstart was UTC)
            if (!recurrenceEndDate || instanceDate <= recurrenceEndDate) {
              // Format to YYYY-MM-DD string for keys and state
              const instanceDateString = instanceDate.toISOString().split('T')[0];
              instances.push({
                ...event,
                original_event_id: event.id,
                id: `${event.id}-${instanceDateString}`,
                date: instanceDateString, // This is the date of THIS instance
                // Use the instanceDate (Date object) directly for formatting
                formatted_date: format_date_german(instanceDate)
              });
              marked[instanceDateString] = {
                ...(marked[instanceDateString] || {}),
                marked: true,
                dotColor: '#4285F4'
              };
            }
          });
        } catch (e) {
          console.error(`Error parsing RRULE for event ${event.id}: ${event.recurrence_rule}`, e);
          // Fallback: include original event if it falls within the month
           const eventDate = new Date(Date.parse(event.date + 'T00:00:00Z'));
           if (eventDate >= startOfMonth && eventDate <= endOfMonth) {
               instances.push({ ...event, formatted_date: format_date_german(eventDate) }); // Add formatted date here too
               marked[event.date] = { ... (marked[event.date] || {}), marked: true, dotColor: '#4285F4' };
           }
        }
      } else {
        // Handle non-recurring events within the current view bounds
        const eventDate = new Date(Date.parse(event.date + 'T00:00:00Z'));
        if (eventDate >= startOfMonth && eventDate <= endOfMonth) {
            instances.push({ ...event, formatted_date: format_date_german(eventDate) }); // Add formatted date
            marked[event.date] = {
               ...(marked[event.date] || {}),
               marked: true,
               dotColor: '#4285F4'
            };
        }
      }
    });

    // Sort instances by date (and maybe time if available consistently)
    instances.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        // Optional: Add secondary sort by time if needed and available
        return 0;
    });


    return { instances, marked };
  }, [allEventsData, currentMonthString]); // Recalculate when data or month changes

  // Update visible events whenever the date range, filter, or processed events change
  useEffect(() => {
    updateVisibleEvents();
  }, [dateRange, activeFilter, processedEvents.instances]); // Depend on processed instances

  // Update marked dates whenever processed events change or selection occurs
  useEffect(() => {
     // Start with the base event markings from recurring/single events for the month
    let currentMarkedDates = { ...processedEvents.marked };

    // Apply period marking based on dateRange
    if (dateRange.startDate) {
        const start = dateRange.startDate;
        const end = dateRange.endDate || start; // Use start date if end date is not set

        // Ensure start and end dates are valid before proceeding
        if (start && !isNaN(new Date(start)) && end && !isNaN(new Date(end))) {
            // Mark start date
            currentMarkedDates[start] = {
                ...(currentMarkedDates[start] || {}),
                selected: true,
                startingDay: true,
                endingDay: start === end,
                color: '#4285F4',
                textColor: 'white',
                dotColor: currentMarkedDates[start]?.marked ? 'white' : undefined
            };

            // Mark dates in between (only if start != end)
            if (start !== end) {
                let currentDate = new Date(Date.parse(start + 'T00:00:00Z'));
                const finalEndDate = new Date(Date.parse(end + 'T00:00:00Z'));

                currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Move to the next day

                while (currentDate < finalEndDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    currentMarkedDates[dateStr] = {
                        ...(currentMarkedDates[dateStr] || {}),
                        selected: true,
                        color: '#80b3ff',
                        textColor: 'white',
                        dotColor: currentMarkedDates[dateStr]?.marked ? 'white' : undefined
                    };
                     currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                }

                // Mark end date
                currentMarkedDates[end] = {
                    ...(currentMarkedDates[end] || {}),
                    selected: true,
                    endingDay: true,
                    color: '#4285F4',
                    textColor: 'white',
                    dotColor: currentMarkedDates[end]?.marked ? 'white' : undefined
                };
            }
        } else {
           console.warn("Invalid date range for marking:", dateRange);
        }
    }

    setSelectedDates(currentMarkedDates);

  }, [processedEvents.marked, dateRange]); // Re-run when base marks or range changes

  const updateVisibleEvents = () => {
    // Filter the processed instances by date range
    let filteredEvents = getEventsInRange();

    // Then filter by category if needed
    if (activeFilter !== 'Alle') {
      filteredEvents = filteredEvents.filter(event => event.category === activeFilter);
    }

    setVisibleEvents(filteredEvents);
  };

  // onDayPress remains largely the same, but relies on the useEffect above for marking
   const onDayPress = (day) => {
       console.log('Selected day:', day.dateString);

       // Ensure day.dateString is valid before setting state
       if (!day.dateString || isNaN(new Date(day.dateString).getTime())) {
           console.warn("Invalid date pressed:", day.dateString);
           return;
       }


       if (dateRange.startDate && dateRange.endDate) {
           // Reset range, select new start date
           setDateRange({ startDate: day.dateString, endDate: '' });
       } else if (!dateRange.startDate) {
           // Set start date
           setDateRange({ startDate: day.dateString, endDate: '' });
       } else {
           // Set end date (or swap if end < start)
           const start = new Date(dateRange.startDate);
           const end = new Date(day.dateString);
           if (end < start) {
               setDateRange({ startDate: day.dateString, endDate: dateRange.startDate });
           } else {
               setDateRange({ ...dateRange, endDate: day.dateString });
           }
       }
   };

  // Helper to get events (now instances) in the selected range
  const getEventsInRange = () => {
    if (!dateRange.startDate) return [];

    const start = dateRange.startDate;
    const end = dateRange.endDate || start; // Use start if end is not set

    // Ensure dates are valid before filtering
    if (!start || isNaN(new Date(start)) || !end || isNaN(new Date(end))) {
        console.warn("Invalid date range for filtering:", {start, end});
        return [];
    }

    return processedEvents.instances.filter(eventInstance => {
      const eventDate = eventInstance.date;
      // Ensure instance date is valid
      if (!eventDate || isNaN(new Date(eventDate))) return false;
      return eventDate >= start && eventDate <= end;
    });
  };

  // formatDateRange remains the same
  const formatDateRange = () => {
    if (!dateRange.startDate) return '';

    const startDate = new Date(dateRange.startDate);
    const formattedStart = `${String(startDate.getDate()).padStart(2, '0')}.${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    if (!dateRange.endDate) return `Alle Events am ${formattedStart}`;

    const endDate = new Date(dateRange.endDate);
    const formattedEnd = `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}`;

    return `Alle Events vom ${formattedStart} bis ${formattedEnd}`;
  };

  // renderEvent needs to use the instance date and potentially original ID for navigation
  const renderEvent = ({ item }) => {
    // item.formatted_date is now pre-calculated in processedEvents useMemo
    const formattedDate = item.formatted_date || format_date_german(item.date);

    // Attendee count still comes from the main event definition
    let attendeeCount = 0;
    if (item.attendees && item.attendees.attending) {
        attendeeCount = parseInt(item.attendees.attending) || 0;
    }

    return (
      <TouchableOpacity
        style={styles.eventCard}
        // Navigate using the ORIGINAL event ID if it exists, otherwise the item's own ID
        onPress={() => navigation.navigate('EventDetail', { eventId: item.original_event_id || item.id })}
      >
        <View style={styles.eventContainer}>
          {item.image_url ? (
             <Image source={{ uri: getTransformedImageUrl(item.image_url) }} style={styles.eventImage} />
          ) : (
            <View style={styles.eventImagePlaceholder} />
          )}
          <View style={styles.eventContent}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={24} color="#333" />
            </View>
            <Text style={styles.eventDateTime}>Am {formattedDate} {item.time}</Text>
             <View style={styles.eventFooter}>
               <Text style={styles.eventLocation}>Uhr am {item.location}</Text>
               <Text
                  style={item.is_organization_event ? styles.organizationOrganizer : styles.eventOrganizer}
               >
                  {item.organizer_name}
               </Text>
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
    // Add check for offline mode
    if (isOfflineMode) {
        Alert.alert("Offline", "Eventerstellung ist offline nicht verfügbar.");
        return;
    }
    if (user && isOrganizationActive) {
      navigation.navigate('CreateEvent', {
          organizationId: activeOrganizationId // Pass the active org ID
      });
    } else if (user && !isOrganizationActive) {
      // Optionally allow personal event creation or show a message
      Alert.alert('Hinweis', 'Eventerstellung ist derzeit nur für Organisationen aktiviert.');
    } else {
      Alert.alert('Anmeldung erforderlich', 'Bitte melde dich an, um ein Event zu erstellen.');
    }
  };

  // Update month string when calendar month changes
  const onMonthChange = (month) => {
    console.log('Month changed:', month.dateString);
    setCurrentMonthString(month.dateString.slice(0, 7)); // Update YYYY-MM
  };

  // Show loading if filters are still loading
  if (loadingFilters) {
     return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Lade Filter...</Text>
      </SafeAreaView>
    );
  }

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
            current={currentMonthString + '-01'}
            onMonthChange={onMonthChange}
            key={currentMonthString}
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
      
      {/* Disable Add button when offline */}
      {isOrganizationActive && user && !isOfflineMode && (
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
  eventImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
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
  eventOrganizer: { // Style for individual organizer
    fontSize: 12,
    color: '#4285F4',
    fontWeight: 'bold',
    flexShrink: 1, // Prevent long names from pushing out other elements
    textAlign: 'right',
  },
  organizationOrganizer: { // Style for organization organizer
    fontSize: 12,
    color: '#208e5d', // Use the same green as in HomeScreen
    fontWeight: 'bold',
    flexShrink: 1,
    textAlign: 'right',
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