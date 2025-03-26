import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import ScreenHeader from '../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

const CalendarScreen = () => {
  // Placeholder filters for calendar screen
  const calendarFilters = ['Alle', 'Sport', 'Vereine', 'Gemeindeamt', 'Kultur'];
  
  // Current date for calendar display
  const [currentMonth, setCurrentMonth] = useState('März'); // Placeholder
  const [selectedDay, setSelectedDay] = useState(15); // Just an example
  
  // Sample calendar days (March 2023)
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  
  // Sample events
  const events = [
    {
      id: 1,
      title: 'Titel vom Event',
      time: 'Um 18:00',
      date: '01.03.2023',
      location: 'Dorfplatz',
      category: 'Kultur'
    },
    {
      id: 2,
      title: 'Titel vom Event',
      time: 'Um 12:00',
      date: '15.03.2023',
      location: 'Sportplatz',
      category: 'Sport'
    }
  ];

  const renderDay = (day) => {
    const isSelected = day === selectedDay;
    const isToday = day === 15; // Just an example
    
    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayButton,
          isSelected && styles.selectedDay,
          isToday && styles.today
        ]}
        onPress={() => setSelectedDay(day)}
      >
        <Text
          style={[
            styles.dayText,
            (isSelected || isToday) && styles.selectedDayText
          ]}
        >
          {day}
        </Text>
      </TouchableOpacity>
    );
  };

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
        <View style={styles.monthSelector}>
          <TouchableOpacity>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.monthText}>{currentMonth}</Text>
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.weekDaysContainer}>
          {weekDays.map(day => (
            <Text key={day} style={styles.weekDayText}>{day}</Text>
          ))}
        </View>
        
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.daysContainer}
          contentContainerStyle={styles.daysContentContainer}
        >
          {days.map(day => renderDay(day))}
        </ScrollView>
      </View>

      <View style={styles.eventsHeader}>
        <Text style={styles.eventsHeaderText}>
          Alle Events vom 01.03 bis 06.03
        </Text>
      </View>
      
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={item => item.id.toString()}
        style={styles.eventsList}
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
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
    marginBottom: 5,
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  weekDayText: {
    fontSize: 12,
    color: '#888',
    width: 35,
    textAlign: 'center',
  },
  daysContainer: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  daysContentContainer: {
    paddingHorizontal: 5,
  },
  dayButton: {
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    margin: 2,
  },
  selectedDay: {
    backgroundColor: '#4285F4',
  },
  today: {
    backgroundColor: '#34A853',
  },
  dayText: {
    fontSize: 14,
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
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