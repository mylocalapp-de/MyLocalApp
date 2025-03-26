import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  Image,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const WelcomeScreen = ({ navigation }) => {
  const { createLocalAccount, signIn } = useAuth();
  const [step, setStep] = useState('welcome'); // 'welcome', 'preferences', 'login'
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { id: 'kultur', name: 'Kultur', icon: 'theater-outline' },
    { id: 'sport', name: 'Sport', icon: 'football-outline' },
    { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
    { id: 'politik', name: 'Politik', icon: 'megaphone-outline' },
  ];

  const togglePreference = (id) => {
    if (selectedPreferences.includes(id)) {
      setSelectedPreferences(selectedPreferences.filter(item => item !== id));
    } else {
      setSelectedPreferences([...selectedPreferences, id]);
    }
  };

  const handleCreateLocalAccount = async () => {
    if (selectedPreferences.length === 0) {
      setError('Bitte wähle mindestens eine Präferenz aus.');
      return;
    }

    setLoading(true);
    setError('');

    const { success, error } = await createLocalAccount(selectedPreferences);
    
    setLoading(false);
    
    if (success) {
      // Navigate to main app
      navigation.replace('MainApp');
    } else {
      setError('Es gab ein Problem. Bitte versuche es erneut.');
      console.error(error);
    }
  };

  const handleLogin = async () => {
    // For now this just navigates to the login form
    setStep('login');
  };

  const renderWelcome = () => (
    <View style={styles.contentContainer}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.welcomeTitle}>Willkommen bei MyLocalApp</Text>
      <Text style={styles.welcomeText}>
        Dein Dorf in einer App - Bleib informiert und verbunden.
      </Text>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => setStep('preferences')}
        >
          <Text style={styles.primaryButtonText}>Neu hier?</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleLogin}
        >
          <Text style={styles.secondaryButtonText}>Login mit existierendem Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPreferences = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.preferencesTitle}>Deine Interessen</Text>
      <Text style={styles.preferencesText}>
        Wähle Themen aus, die dich interessieren. Du kannst diese jederzeit in deinem Profil ändern.
      </Text>
      
      <View style={styles.categoriesContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryItem,
              selectedPreferences.includes(category.id) && styles.categoryItemSelected
            ]}
            onPress={() => togglePreference(category.id)}
          >
            <Ionicons 
              name={category.icon} 
              size={24} 
              color={selectedPreferences.includes(category.id) ? '#fff' : '#4285F4'} 
            />
            <Text 
              style={[
                styles.categoryText,
                selectedPreferences.includes(category.id) && styles.categoryTextSelected
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setStep('welcome')}
        >
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.continueButton,
            loading && styles.buttonDisabled
          ]}
          onPress={handleCreateLocalAccount}
          disabled={loading}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Lädt...' : 'Fertig'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLoginForm = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.preferencesTitle}>Anmelden</Text>
      <Text style={styles.preferencesText}>
        Melde dich mit deinem bestehenden Account an.
      </Text>
      
      {/* In a real implementation, you would add TextInput components here for email/password */}
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setStep('welcome')}
        >
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={() => navigation.replace('MainApp')}
        >
          <Text style={styles.continueButtonText}>Anmelden</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {step === 'welcome' && renderWelcome()}
        {step === 'preferences' && renderPreferences()}
        {step === 'login' && renderLoginForm()}
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
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  preferencesTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  preferencesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    width: '48%',
  },
  categoryItemSelected: {
    backgroundColor: '#4285F4',
  },
  categoryText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  categoryTextSelected: {
    color: '#fff',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 5,
  },
  continueButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    padding: 15,
    paddingHorizontal: 25,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default WelcomeScreen; 