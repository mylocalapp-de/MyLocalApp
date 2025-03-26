import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const categories = [
  { id: 'kultur', name: 'Kultur', icon: 'color-palette-outline' },
  { id: 'sport', name: 'Sport', icon: 'football-outline' },
  { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
  { id: 'politik', name: 'Politik', icon: 'business-outline' },
];

const OnboardingScreen = ({ navigation }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { setPreferences, user } = useAuth();

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleComplete = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert('Keine Auswahl', 'Bitte wähle mindestens eine Kategorie aus');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await setPreferences(selectedCategories);
      
      if (error) {
        Alert.alert('Fehler', error.message || 'Fehler beim Speichern der Präferenzen');
      } else {
        // Onboarding completed, navigate to main app
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    } catch (error) {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Deine Interessen</Text>
          <Text style={styles.subtitle}>
            Wähle die Kategorien aus, die dich besonders interessieren
          </Text>
        </View>

        <View style={styles.categoriesContainer}>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryCard,
                selectedCategories.includes(category.id) && styles.selectedCard,
              ]}
              onPress={() => toggleCategory(category.id)}
            >
              <Ionicons
                name={category.icon}
                size={32}
                color={selectedCategories.includes(category.id) ? '#fff' : '#4285F4'}
                style={styles.categoryIcon}
              />
              <Text
                style={[
                  styles.categoryName,
                  selectedCategories.includes(category.id) && styles.selectedText,
                ]}
              >
                {category.name}
              </Text>
              {selectedCategories.includes(category.id) && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.completeButton, isLoading && styles.disabledButton]}
          onPress={handleComplete}
          disabled={isLoading}
        >
          <Text style={styles.completeButtonText}>
            {isLoading ? 'Wird gespeichert...' : 'Fertig'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4285F4',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f1f1f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  selectedCard: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  categoryIcon: {
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedText: {
    color: '#fff',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  completeButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#A0B9E0',
  },
});

export default OnboardingScreen; 