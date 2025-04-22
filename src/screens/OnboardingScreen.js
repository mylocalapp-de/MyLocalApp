import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const OnboardingScreen = ({ navigation }) => {
  const { createTemporaryAccount, loading: authLoading } = useAuth(); // Get the new function and loading state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(''); // Optional email
  const [isLoading, setIsLoading] = useState(false); // Local loading state for this screen
  const [error, setError] = useState('');

  const handleCompleteOnboarding = async () => {
    if (!displayName.trim()) {
      setError('Bitte gib einen Anzeigenamen ein.');
      return;
    }
    // Optional: Basic email format validation if email is provided
    if (email.trim() && !email.includes('@')) {
       setError('Bitte gib eine gültige E-Mail-Adresse ein oder lasse das Feld leer.');
       return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log(`Onboarding: Attempting temporary account creation. Name: ${displayName}, Email: ${email || '(none)'}`);
      // Call the new function from AuthContext
      const result = await createTemporaryAccount(displayName.trim(), email.trim() || null); 

      if (result.success) {
        console.log('Onboarding: Temporary account created successfully via AuthContext.');
        // Navigation is now handled by AppNavigator reacting to the auth state change (user becoming non-null)
      } else {
        console.error('Onboarding: Failed to create temporary account:', result.error);
        setError(result.error?.message || 'Account konnte nicht erstellt werden. Versuche es erneut.');
      }
    } catch (err) {
      console.error('Onboarding: Unexpected error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const combinedLoading = isLoading || authLoading;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TouchableOpacity style={styles.backNavButton} onPress={() => navigation.goBack()}>
           <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Willkommen bei MeinHavelaue!</Text>

        <Text style={styles.description}>
          Entdecke deine Gemeinde neu! Mit MeinHavelaue bleibst du informiert und kannst <Text style={styles.boldText}>aktiv teilnehmen</Text>:
        </Text>
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#3F51B5" style={styles.featureIcon} />
            <Text style={styles.featureText}>Kommentare schreiben & diskutieren</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="people-outline" size={20} color="#3F51B5" style={styles.featureIcon} />
            <Text style={styles.featureText}>Mit Nachbarn & Gruppen chatten</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="newspaper-outline" size={20} color="#3F51B5" style={styles.featureIcon} />
            <Text style={styles.featureText}>Einträge am Schwarzen Brett erstellen</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="calendar-outline" size={20} color="#3F51B5" style={styles.featureIcon} />
            <Text style={styles.featureText}>Veranstaltungen finden & teilen</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Dein Anzeigename</Text>
        <Text style={styles.descriptionSmall}> 
           Damit andere dich erkennen, gib bitte einen Namen an (öffentlich sichtbar):
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Dein Name oder Spitzname"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.sectionTitle}>Account sichern (Optional)</Text>
        <Text style={styles.descriptionSmall}>
          Möchtest du deinen Account auf <Text style={styles.boldText}>mehreren Geräten</Text> nutzen oder später <Text style={styles.boldText}>wiederherstellen</Text>? Dann gib deine E-Mail-Adresse an:
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="deine@email.de (optional)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity 
          style={[styles.completeButton, combinedLoading && styles.buttonDisabled]}
          onPress={handleCompleteOnboarding}
          disabled={combinedLoading}
        >
          {combinedLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.completeButtonText}>Loslegen & Entdecken</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingVertical: 40,
  },
  backNavButton: {
    position: 'absolute',
    top: 20,
    left: 15,
    padding: 10, 
    zIndex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A237E', 
    textAlign: 'center',
    marginBottom: 25,
    marginTop: 30,
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left', 
    marginBottom: 15,
    lineHeight: 24,
  },
  descriptionSmall: {
    fontSize: 15,
    color: '#555',
    textAlign: 'left', 
    marginBottom: 15,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: 'bold',
  },
  featureList: {
    marginBottom: 30,
    marginTop: 5,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A237E',
    marginTop: 15,
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  errorText: {
    color: '#D32F2F',
    marginTop: -10, 
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  completeButton: {
    backgroundColor: '#3F51B5', 
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9FA8DA',
  },
});

export default OnboardingScreen; 