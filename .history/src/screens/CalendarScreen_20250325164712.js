import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

const CalendarScreen = () => {
  const calendarFilters = ['Alle', 'Sport', 'Vereine', 'Gemeindeamt', 'Kultur'];
  const [selectedDates, setSelectedDates] = useState({});
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [visibleEvents, setVisibleEvents] = useState([]);
  
  // Sample events (in real app, this would come from your backend)
  const events = [
    {
      id: 1,
      title: 'Titel vom Event',
      time: 'Um 18:00',
      date: '2024-03-01',
      location: 'Dorfplatz',
      category: 'Kultur'
    },
    {
      id: 2,
      title: 'Titel vom Event',
      time: 'Um 12:00',
      date: '2024-03-02',
      location: 'Sportplatz',
      category: 'Sport'
    },
    {
      id: 3,
      title: 'Feuerwehr Party',
      time: 'Um 20:00',
      date: '2024-03-03',
      location: 'XXX',
      category: 'Vereine'
    },
    {
      id: 4,
      title: 'Titel vom Event',
      time: 'Um 12:00',
      date: '2024-03-06',
      location: 'Sportplatz',
      category: 'Sport'
    }
  ];

  // Initialize event markers
  useEffect(() => {
    // Create initial marked dates for events
    const initialMarkedDates = {};
    events.forEach(event => {
      initialMarkedDates[event.date] = {
        marked: true,
        dotColor: '#4285F4'
      };
    });
    setSelectedDates(initialMarkedDates);
    
    // Pre-select the date range from the mockup (01.03 to 06.03)
    const mockupStartDate = '2024-03-01';
    const mockupEndDate = '2024-03-06';
    setDateRange({ startDate: mockupStartDate, endDate: mockupEndDate });
    createDateRange(mockupStartDate, mockupEndDate);
  }, []);

  // Update visible events whenever the date range changes
  useEffect(() => {
    updateVisibleEvents();
  }, [dateRange]);

  const updateVisibleEvents = () => {
    const filteredEvents = getEventsInRange();
    console.log('Filtered events:', filteredEvents);
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
      color: '#4285F4',
      textColor: 'white',
      dotColor: range[start]?.marked ? 'white' : undefined
    };
    
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
    
    return (
      <TouchableOpacity style={styles.eventCard}>
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
            <Text style={styles.eventLocation}>Uhr am {item.location}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader filters={calendarFilters} />
      
      <View style={styles.calendarContainer}>
        <Calendar
          markingType={'period'}
          onDayPress={onDayPress}
          markedDates={selectedDates}
          enableSwipeMonths={true}
          current={'2024-03-01'}
          style={{
            height: 300,
          }}
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
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
            'stylesheet.calendar.header': {
              header: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingLeft: 10,
                paddingRight: 10,
                marginTop: 6,
                marginBottom: 6,
                alignItems: 'center'
              },
              monthText: {
                fontSize: 16,
                fontWeight: 'bold'
              },
              week: {
                marginTop: 4,
                marginBottom: 4,
                flexDirection: 'row',
                justifyContent: 'space-around'
              }
            },
            'stylesheet.day.period': {
              base: {
                width: 34,
                height: 34,
                alignItems: 'center'
              }
            }
          }}
        />
      </View>

      {dateRange.startDate && (
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsHeaderText}>
            {formatDateRange()}
          </Text>
        </View>
      )}
      
      <FlatList
        data={visibleEvents}
        renderItem={renderEvent}
        keyExtractor={item => item.id.toString()}
        style={styles.eventsList}
        ListEmptyComponent={
          dateRange.startDate ? (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>Keine Events in diesem Zeitraum</Text>
            </View>
          ) : null
        }
      />
      
      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  eventsHeader: {
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  eventsHeaderText: {
    fontSize: 14,
    color: '#666',
  },
  eventsList: {
    flex: 1,
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
});

export default CalendarScreen; 