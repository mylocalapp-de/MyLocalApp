import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator
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
    { id: 'kultur', name: 'Kultur', icon: 'film-outline' },
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

    try {
      console.log('Creating local account with preferences:', selectedPreferences);
      const { success, error } = await createLocalAccount(selectedPreferences);
      
      if (success) {
        console.log('Local account created successfully, navigating to MainApp');
        // Let AuthContext handle navigation by updating hasCompletedOnboarding
        // No need to explicitly navigate here
      } else {
        console.error('Error creating local account:', error);
        setError('Es gab ein Problem. Bitte versuche es erneut.');
      }
    } catch (err) {
      console.error('Unexpected error in handleCreateLocalAccount:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async () => {
    // Validation
    if (!email.trim()) {
      setError('Bitte gib eine E-Mail-Adresse ein');
      return;
    }
    
    if (!password) {
      setError('Bitte gib ein Passwort ein');
      return;
    }
    
    // Check password length
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('Attempting to sign in with:', email);
      const result = await signIn(email, password);
      
      if (!result.success) {
        console.error('Login failed:', result.error);
        
        // Handle specific error codes
        switch (result.error?.code) {
          case 'invalid_credentials':
            setError('Falsche E-Mail oder Passwort');
            break;
          case 'user_fetch_error':
            setError('Benutzer konnte nicht geladen werden');
            break;
          case 'signin_error':
            setError('Anmeldung fehlgeschlagen');
            break;
          default:
            setError(result.error?.message || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
            break;
        }
      }
      // If successful, AuthContext will handle navigation
      
    } catch (err) {
      console.error('Unexpected error during login:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
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
          onPress={() => setStep('login')}
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
      
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>E-Mail</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="deine@email.de"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Passwort</Text>
          <TextInput
            style={styles.textInput}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </View>
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            setStep('welcome');
            setError('');
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.continueButton,
            loading && styles.buttonDisabled
          ]}
          onPress={handleLoginSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>Anmelden</Text>
          )}
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
    color: '#ff3b30',
    marginTop: 10,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});

export default WelcomeScreen; 