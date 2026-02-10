import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const welcomeImages = [
  require('../../assets/welcomescreen/birgit-photo-50.png'),
  require('../../assets/welcomescreen/birgit-photo-43.png'),
  require('../../assets/welcomescreen/birgit-photo-39.png'),
  require('../../assets/welcomescreen/birgit-photo-37.png'),
  require('../../assets/welcomescreen/birgit-photo-33.png'),
  require('../../assets/welcomescreen/birgit-photo-31.png'),
  require('../../assets/welcomescreen/birgit-photo-28.png'),
  require('../../assets/welcomescreen/birgit-photo-27.png'),
];

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const IMAGE_SIZE = screenWidth * 0.4;
const ANIMATION_DURATION = 40000;

const numRepeats = 4; // Render image set multiple times for density and wrapping
const horizontalMargin = 10;
const verticalMargin = 15; // Increased vertical margin slightly
const imageWidthWithMargin = IMAGE_SIZE + horizontalMargin * 2;
const imageHeightWithMargin = IMAGE_SIZE * 1.1 + verticalMargin * 2;
const totalWidth = welcomeImages.length * numRepeats * imageWidthWithMargin;
const scrollAmount = totalWidth / 2; // Scroll half the total width for looping
const effectiveAnimationDuration = ANIMATION_DURATION * (numRepeats / 1.5); // Adjust duration factor as needed for speed

const WelcomeScreen = ({ navigation }) => {
  const { signIn } = useAuth();
  const [step, setStep] = useState('welcome'); // 'welcome', 'login', 'forgotPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scrollX.setValue(0); // Reset on step change or mount

    if (step === 'welcome') {
        Animated.loop(
            Animated.timing(scrollX, {
                toValue: -scrollAmount, // Scroll half the total calculated width
                duration: effectiveAnimationDuration, // Use adjusted duration
                useNativeDriver: true,
                easing: t => t, // Linear easing
            })
        ).start();
    } else {
        scrollX.stopAnimation(); // Stop animation if navigating away
    }

    return () => scrollX.stopAnimation(); // Cleanup on unmount/step change
  }, [step, scrollX]);

  const handlePasswordReset = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      
      const response = await fetch('https://admin.mylocalapp.de/api/password-reset/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Url': supabaseUrl
        },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('Wenn die E-Mail existiert, wurde ein neues Passwort gesendet.');
        // Optional: Clear email field? No, maybe keep it if they need to check.
      } else {
        // Handle specific API errors if needed, otherwise show generic
        setError(data.message || 'Fehler beim Zurücksetzen des Passworts.');
      }
    } catch (err) {
      console.error('Error requesting password reset:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein');
      return;
    }
    
    if (!password) {
      setError('Bitte gib ein Passwort ein');
      return;
    }
    
    if (password.length < 6) { 
      setError('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // console.log('Attempting to sign in with:', email);
      const result = await signIn(email, password);
      
      if (result.success) {
        // console.log('Login successful, AppNavigator will handle navigation via AuthContext state.');
      } else {
        console.error('Login failed:', result.error);
        const errorMessage = result.error?.message;
        
        if (errorMessage === 'Invalid login credentials') {
            setError('E-Mail oder Passwort ist ungültig. Bitte überprüfe deine Eingaben.');
        } else if (errorMessage?.includes('Email not confirmed')) {
            setError('Bitte bestätige deine E-Mail-Adresse, bevor du dich anmeldest. Überprüfe dein Postfach.');
        } else if (errorMessage?.includes('rate limit')) {
             setError('Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es erneut.');
        } else {
             setError(`Anmeldung fehlgeschlagen: ${errorMessage || 'Unbekannter Fehler'}`);
        }
      }
    } catch (err) {
      console.error('Unexpected error during login:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <View style={styles.welcomeRootContainer}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Row 1 (Above center) */}
        <Animated.View
          style={[
            styles.animatedImageContainer,
            { 
              width: totalWidth, 
              transform: [
                { translateX: scrollX }, 
                { translateY: -imageHeightWithMargin } // Position above center
              ] 
            }
          ]}
        >
          {[...Array(numRepeats)].flatMap((_, repeatIndex) =>
            welcomeImages.map((imgSrc, index) => (
              <Image
                key={`img-above-${repeatIndex}-${index}`} // Unique key
                source={imgSrc}
                style={[
                    styles.backgroundImage,
                    { transform: [{ rotate: `${Math.random() * 25 - 12.5}deg` }] }
                ]}
              />
            ))
          )}
        </Animated.View>

        {/* Row 2 (Center - Original position, offset horizontally) */}
        <Animated.View
          style={[
            styles.animatedImageContainer,
            { 
              width: totalWidth, 
              transform: [
                // Interpolate scrollX to add a constant horizontal offset
                { translateX: scrollX.interpolate({ 
                    inputRange: [-scrollAmount, 0], 
                    outputRange: [-scrollAmount - (imageWidthWithMargin / 2), -(imageWidthWithMargin / 2)] 
                  }) 
                }
              ] 
            }
          ]}
        >
          {[...Array(numRepeats)].flatMap((_, repeatIndex) =>
            welcomeImages.map((imgSrc, index) => (
              <Image
                key={`img-center-${repeatIndex}-${index}`} // Unique key
                source={imgSrc}
                style={[
                    styles.backgroundImage,
                    { transform: [{ rotate: `${Math.random() * 25 - 12.5}deg` }] }
                ]}
              />
            ))
          )}
        </Animated.View>

        {/* Row 3 (Below center) */}
        <Animated.View
          style={[
            styles.animatedImageContainer,
            { 
              width: totalWidth, 
              transform: [
                { translateX: scrollX }, 
                { translateY: imageHeightWithMargin } // Position below center
              ] 
            }
          ]}
        >
          {[...Array(numRepeats)].flatMap((_, repeatIndex) =>
            welcomeImages.map((imgSrc, index) => (
              <Image
                key={`img-below-${repeatIndex}-${index}`} // Unique key
                source={imgSrc}
                style={[
                    styles.backgroundImage,
                    { transform: [{ rotate: `${Math.random() * 25 - 12.5}deg` }] }
                ]}
              />
            ))
          )}
        </Animated.View>
      </View>

      <View style={styles.overlay} pointerEvents="none" />

      <View style={styles.contentContainer}>
        <Image
          source={require('../../assets/splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.welcomeTitle}>Willkommen bei MeinStrodehne</Text>
        <Text style={styles.welcomeText}>
          Dein Dorf in einer App - Bleib informiert und verbunden.
        </Text>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Onboarding')}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>Neu hier?</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => setStep('login')}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Login mit existierendem Account</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.textButton, { marginTop: 15 }]}
            onPress={() => setStep('forgotPassword')}
            disabled={loading}
          >
            <Text style={styles.textButtonText}>Passwort wiederherstellen</Text>
          </TouchableOpacity>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
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

  const renderForgotPassword = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.preferencesTitle}>Passwort wiederherstellen</Text>
      <Text style={styles.preferencesText}>
        Bitte gib deine E-Mail-Adresse ein, um dein Passwort zurückzusetzen.
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
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        
        <View style={styles.infoBox}>
             <Text style={styles.infoText}>
                Wenn du deine E-Mail-Adresse nicht mehr weißt oder dich ohne E-Mail registriert hast, schreibe bitte eine E-Mail an info@mylocalapp.de oder erstelle einen neuen Account.
             </Text>
        </View>
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            setStep('welcome');
            setError('');
            setSuccessMessage('');
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
          onPress={handlePasswordReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>Zurücksetzen</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {step === 'welcome' ? (
         renderWelcome() 
      ) : step === 'login' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {renderLoginForm()}
        </ScrollView>
      ) : step === 'forgotPassword' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            {renderForgotPassword()}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  welcomeRootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedImageContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    left: 0,
    height: screenHeight,
    alignItems: 'center',
  },
  backgroundImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE * 1.1,
    marginHorizontal: 10,
    borderRadius: 15,
    opacity: 0.2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(232, 234, 246, 0.33)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  welcomeText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonsContainer: {
    width: '90%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3F51B5',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#3F51B5',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3F51B5',
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
    opacity: 0.6,
    backgroundColor: '#9FA8DA',
  },
  errorText: {
    color: '#D32F2F',
    marginTop: 15,
    textAlign: 'center',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  successText: {
    color: '#388E3C', // Green for success
    marginTop: 15,
    textAlign: 'center',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  textButton: {
    padding: 10,
    alignItems: 'center',
  },
  textButtonText: {
    color: '#3F51B5',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  infoBox: {
      marginTop: 20,
      padding: 15,
      backgroundColor: '#E8EAF6', // Light indigo background
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: '#3F51B5',
  },
  infoText: {
      fontSize: 13,
      color: '#333',
      lineHeight: 18,
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