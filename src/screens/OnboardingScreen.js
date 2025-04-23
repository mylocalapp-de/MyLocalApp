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
  const { createTemporaryAccount, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1); // 1: Welcome, 2: Name, 3: Email & Submit
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Local loading for final submission
  const [error, setError] = useState('');

  const validateEmail = (text) => {
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  const handleNextToName = () => {
    setError(''); // Clear previous errors
    setCurrentStep(2);
  };

  const handleNextToEmail = () => {
    if (!displayName.trim()) {
      setError('Bitte gib einen Anzeigenamen ein.');
      return;
    }
    setError(''); // Clear previous errors
    setCurrentStep(3);
  };

  const handleInternalGoBack = () => {
    setError(''); // Clear errors when going back
    // This function now only handles going back between onboarding steps
    setCurrentStep(currentStep - 1);
  };

  const handleCompleteOnboarding = async () => {
    setError(''); // Clear previous errors
    if (!displayName.trim()) {
      // Should be caught earlier, but double-check
      setError('Der Anzeigename fehlt.');
      setCurrentStep(2); // Go back to name step
      return;
    }
    if (!email.trim()) {
      setError('Bitte gib deine E-Mail-Adresse ein.');
      return;
    }
    if (!validateEmail(email.trim())) {
       setError('Bitte gib eine gültige E-Mail-Adresse ein.');
       return;
    }

    setIsLoading(true);

    try {
      console.log(`Onboarding Final Step: Attempting temporary account creation. Name: ${displayName}, Email: ${email}`);
      // Email is now mandatory, trim() is sufficient. No null check needed.
      const result = await createTemporaryAccount(displayName.trim(), email.trim()); 

      if (result.success) {
        console.log('Onboarding: Temporary account created successfully via AuthContext.');
        // Navigation is handled by AppNavigator reacting to the auth state change
      } else {
        console.error('Onboarding: Failed to create temporary account:', result.error);
        setError(result.error?.message || 'Account konnte nicht erstellt werden. Versuche es erneut.');
      }
    } catch (err) {
      console.error('Onboarding: Unexpected error during final submission:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const combinedLoading = isLoading || authLoading; // Loading for the final step button

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Welcome & Features
        return (
          <>
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
                <Text style={styles.featureText}>Veranstaltungen finden & teilnehmen</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleNextToName}>
              <Text style={styles.actionButtonText}>Weiter</Text>
            </TouchableOpacity>
          </>
        );
      case 2: // Display Name
        return (
          <>
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
                onSubmitEditing={handleNextToEmail} // Allow submitting with keyboard 'done'
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.actionButton} onPress={handleNextToEmail}>
              <Text style={styles.actionButtonText}>Weiter</Text>
            </TouchableOpacity>
          </>
        );
      case 3: // Email & Submit
        return (
          <>
            <Text style={styles.sectionTitle}>Account sichern</Text>
            <Text style={styles.descriptionSmall}>
              Wir benötigen deine E-Mail-Adresse, damit du deinen Account auf <Text style={styles.boldText}>mehreren Geräten</Text> nutzen oder später <Text style={styles.boldText}>wiederherstellen</Text> kannst.
            </Text>
            <Text style={[styles.descriptionSmall, styles.infoText]}>
               <Ionicons name="information-circle-outline" size={16} color="#555" /> Keine Sorge, es wird <Text style={styles.boldText}>keine Bestätigungs-E-Mail</Text> verschickt.
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="deine@email.de"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleCompleteOnboarding} // Allow submitting with keyboard 'done'
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity 
              style={[styles.actionButton, combinedLoading && styles.buttonDisabled]}
              onPress={handleCompleteOnboarding}
              disabled={combinedLoading}
            >
              {combinedLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Loslegen & Entdecken</Text>
              )}
            </TouchableOpacity>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Always show back button, adjust onPress based on step */} 
        <TouchableOpacity 
          style={styles.backNavButton} 
          onPress={currentStep === 1 ? () => navigation.goBack() : handleInternalGoBack}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
         
        {renderStepContent()}

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
    justifyContent: 'center', // Center content vertically for steps
  },
  backNavButton: {
    position: 'absolute',
    top: 20, // Adjust as needed for SafeAreaView padding
    left: 15,
    padding: 10, 
    zIndex: 10, // Ensure it's above other content
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A237E', 
    textAlign: 'center',
    marginBottom: 25,
    // Removed marginTop: 30, as centering handles spacing
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
  infoText: {
    fontStyle: 'italic',
    color: '#666',
    marginTop: -5, // Adjust spacing
    marginBottom: 20,
    alignItems: 'center', // Align icon and text
    flexDirection: 'row', // Needed for icon alignment (though text wraps)
  },
  boldText: {
    fontWeight: 'bold',
  },
  featureList: {
    marginBottom: 30,
    marginTop: 10, // Added margin top
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
    flex: 1, // Allow text to wrap
  },
  sectionTitle: {
    fontSize: 22, // Slightly larger for step titles
    fontWeight: '600',
    color: '#1A237E',
    textAlign: 'center',
    marginTop: 15, // Adjusted margin
    marginBottom: 15, // Adjusted margin
  },
  inputContainer: {
    marginBottom: 20,
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
    // marginTop: -10, // Removed negative margin
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '500', // Slightly less bold
  },
  actionButton: { // Renamed from completeButton for general use
    backgroundColor: '#3F51B5', 
    borderRadius: 8,
    paddingVertical: 16, // Consistent padding
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 20, // Space above button
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  actionButtonText: { // Renamed from completeButtonText
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
    backgroundColor: '#9FA8DA', // Keep disabled style specific
  },
});

export default OnboardingScreen; 