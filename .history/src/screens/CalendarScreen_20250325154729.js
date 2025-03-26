import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import CalendarStrip from 'react-native-calendar-strip';
import SearchBar from '../components/SearchBar';
import FilterButtons from '../components/FilterButtons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CalendarScreen = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const filters = ['Alle', 'Sport', 'Kultur', 'Vereine', 'Gemeinde'];

  const events = [
    {
      title: 'Gemeindeversammlung',
      time: '19:00',
      location: 'Rathaus',
      category: 'Gemeinde',
      icon: 'account-group',
    },
    {
      title: 'Fußballtraining',
      time: '17:30',
      location: 'Sportplatz',
      category: 'Sport',
      icon: 'soccer',
    },
    {
      title: 'Chorprobe',
      time: '20:00',
      location: 'Gemeindehaus',
      category: 'Kultur',
      icon: 'music',
    },
  ];

  return (
    <View style={styles.container}>
      <SearchBar placeholder="Veranstaltungen suchen..." />
      <FilterButtons filters={filters} />
      <CalendarStrip
        style={styles.calendar}
        calendarHeaderStyle={styles.calendarHeader}
        dateNumberStyle={styles.dateNumber}
        dateNameStyle={styles.dateName}
        highlightDateNumberStyle={styles.highlightDateNumber}
        highlightDateNameStyle={styles.highlightDateName}
        calendarColor={'#fff'}
        onDateSelected={setSelectedDate}
      />
      <ScrollView style={styles.content}>
        {events.map((event, index) => (
          <View key={index} style={styles.eventCard}>
            <View style={styles.eventTime}>
              <Text style={styles.timeText}>{event.time}</Text>
            </View>
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Icon name={event.icon} size={24} color="#007AFF" />
              </View>
              <Text style={styles.eventLocation}>{event.location}</Text>
              <Text style={styles.eventCategory}>{event.category}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  calendar: {
    height: 100,
    paddingTop: 8,
    paddingBottom: 8,
  },
  calendarHeader: {
    color: '#000',
    fontSize: 16,
  },
  dateNumber: {
    color: '#000',
  },
  dateName: {
    color: '#666',
  },
  highlightDateNumber: {
    color: '#007AFF',
  },
  highlightDateName: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  eventTime: {
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventCategory: {
    fontSize: 12,
    color: '#007AFF',
  },
});

export default CalendarScreen; 