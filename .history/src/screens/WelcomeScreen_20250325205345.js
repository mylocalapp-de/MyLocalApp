import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const WelcomeScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleNewUser = () => {
    setShowSignupForm(true);
    setShowLoginForm(false);
  };

  const handleExistingUser = () => {
    setShowLoginForm(true);
    setShowSignupForm(false);
  };
  
  const handleBack = () => {
    setShowLoginForm(false);
    setShowSignupForm(false);
    setEmail('');
    setPassword('');
  };

  const handleSignUp = async () => {
    if (!email) {
      Alert.alert('Fehler', 'Bitte gib deine E-Mail-Adresse ein');
      return;
    }
    
    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Fehler', 'Bitte gib eine gültige E-Mail-Adresse ein');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Attempting signup with email:', email);
      const { data, error } = await signUp(email);
      
      if (error) {
        console.error('Signup error in WelcomeScreen:', error);
        Alert.alert('Fehler bei der Registrierung', error.message);
      } else {
        console.log('Signup successful, navigating to onboarding');
        // Navigate to onboarding
        navigation.navigate('Onboarding', { 
          userId: data?.user?.id,
          tempEmail: email 
        });
      }
    } catch (error) {
      console.error('Unexpected error during signup:', error);
      Alert.alert('Ein Fehler ist aufgetreten', error.message || 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte gib deine E-Mail-Adresse und dein Passwort ein');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Attempting signin with email:', email);
      const { data, error } = await signIn(email, password);
      
      if (error) {
        console.error('Signin error:', error);
        Alert.alert('Login fehlgeschlagen', error.message);
      }
    } catch (error) {
      console.error('Unexpected error during signin:', error);
      Alert.alert('Ein Fehler ist aufgetreten', error.message || 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Willkommen</Text>
            <Text style={styles.subtitle}>
              Entdecke dein lokales Dorfleben mit MyLocalApp
            </Text>

            {!showLoginForm && !showSignupForm ? (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleNewUser}
                >
                  <Text style={styles.primaryButtonText}>Neu hier?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleExistingUser}
                >
                  <Text style={styles.secondaryButtonText}>
                    Login mit existierendem Account
                  </Text>
                </TouchableOpacity>
              </View>
            ) : showLoginForm ? (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Anmelden</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="E-Mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="Passwort"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.disabledButton]}
                  onPress={handleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Anmelden</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={handleBack}
                >
                  <Text style={styles.textButtonText}>Zurück</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Registrieren</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="E-Mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                
                <Text style={styles.formMessage}>
                  Ein Passwort kannst du später in deinem Profil festlegen.
                </Text>
                
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.disabledButton]}
                  onPress={handleSignUp}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Weiter</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={handleBack}
                >
                  <Text style={styles.textButtonText}>Zurück</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#4285F4',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#4285F4',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  secondaryButtonText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formContainer: {
    width: '100%',
    marginTop: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    width: '100%',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
    fontSize: 16,
  },
  formMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  textButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  textButtonText: {
    color: '#4285F4',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#A0B9E0',
  },
});

export default WelcomeScreen; 