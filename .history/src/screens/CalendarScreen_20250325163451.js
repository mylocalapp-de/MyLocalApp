import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

const CalendarScreen = () => {
  const calendarFilters = ['Alle', 'Sport', 'Vereine', 'Gemeindeamt', 'Kultur'];
  const [selectedDate, setSelectedDate] = useState('');
  
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
      date: '2024-03-15',
      location: 'Sportplatz',
      category: 'Sport'
    }
  ];

  // Create marked dates object for the calendar
  const markedDates = events.reduce((acc, event) => {
    acc[event.date] = { marked: true, dotColor: '#4285F4' };
    if (event.date === selectedDate) {
      acc[event.date] = {
        ...acc[event.date],
        selected: true,
        selectedColor: '#4285F4',
      };
    }
    return acc;
  }, {});

  // Filter events for selected date
  const selectedDateEvents = events.filter(event => event.date === selectedDate);

  const renderEvent = ({ item }) => (
    <TouchableOpacity style={styles.eventCard}>
      <View style={styles.eventContainer}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </View>
        <View style={styles.eventDetails}>
          <Text style={styles.eventTime}>{item.time}</Text>
          <Text style={styles.eventLocation}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader filters={calendarFilters} />
      
      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          enableSwipeMonths={true}
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
            arrowColor: '#4285F4',
            monthTextColor: '#333',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12
          }}
        />
      </View>

      {selectedDate && (
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsHeaderText}>
            Events am {new Date(selectedDate).toLocaleDateString('de-DE')}
          </Text>
        </View>
      )}
      
      <FlatList
        data={selectedDateEvents}
        renderItem={renderEvent}
        keyExtractor={item => item.id.toString()}
        style={styles.eventsList}
        ListEmptyComponent={
          selectedDate ? (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>Keine Events an diesem Tag</Text>
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
    paddingBottom: 10,
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
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  eventDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
  eventLocation: {
    fontSize: 14,
    color: '#888',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
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
});

export default CalendarScreen; 