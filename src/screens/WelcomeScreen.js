import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

const imageRotations = ['-11deg', '8deg', '-6deg', '10deg', '-9deg', '7deg', '-5deg', '9deg'];

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const IMAGE_SIZE = screenWidth * 0.4;
const ANIMATION_DURATION = 40000;

const numRepeats = 4;
const horizontalMargin = 10;
const verticalMargin = 15;
const imageWidthWithMargin = IMAGE_SIZE + horizontalMargin * 2;
const imageHeightWithMargin = IMAGE_SIZE * 1.1 + verticalMargin * 2;
const totalWidth = welcomeImages.length * numRepeats * imageWidthWithMargin;
const scrollAmount = totalWidth / 2;
const effectiveAnimationDuration = ANIMATION_DURATION * (numRepeats / 1.5);

const WelcomeScreen = ({ navigation }) => {
  const { signIn, requestPasswordReset, completePasswordReset } = useAuth();
  const [step, setStep] = useState('welcome');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetStage, setResetStage] = useState('request');
  const [resetTarget, setResetTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scrollX.setValue(0);

    if (step === 'welcome') {
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -scrollAmount,
          duration: effectiveAnimationDuration,
          useNativeDriver: true,
          easing: (t) => t,
        })
      ).start();
    } else {
      scrollX.stopAnimation();
    }

    return () => scrollX.stopAnimation();
  }, [step, scrollX]);

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const clearResetForm = () => {
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetTarget('');
    setResetStage('request');
  };

  const handleLoginSubmit = async () => {
    if (!identifier.trim()) {
      setError('Bitte gib deinen Benutzernamen ein.');
      return;
    }

    if (!password) {
      setError('Bitte gib dein Passwort ein.');
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const result = await signIn(identifier, password);

      if (result.success) {
        return;
      }

      const errorMessage = result.error?.message || '';
      if (errorMessage === 'Invalid login credentials') {
        setError('Benutzername, E-Mail oder Passwort ist ungültig. Bitte überprüfe deine Eingaben.');
      } else if (errorMessage.toLowerCase().includes('rate limit')) {
        setError('Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es erneut.');
      } else {
        setError(errorMessage || 'Anmeldung fehlgeschlagen.');
      }
    } catch (err) {
      console.error('Unexpected error during login:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    if (!resetUsername.trim()) {
      setError('Bitte gib deinen Benutzernamen ein.');
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const result = await requestPasswordReset(resetUsername);

      if (!result.success) {
        setError(result.error?.message || 'Der Reset-Code konnte nicht angefordert werden.');
        return;
      }

      const normalizedUsername = resetUsername.trim().toLowerCase();
      const maskedTarget = result.data?.maskedTarget || 'deine hinterlegte Kontaktmöglichkeit';
      const methodLabel = result.data?.method === 'phone' ? 'SMS' : 'E-Mail';

      setResetUsername(normalizedUsername);
      setResetTarget(maskedTarget);
      setResetStage('confirm');
      setSuccessMessage(`Wir haben einen Reset-Code per ${methodLabel} an ${maskedTarget} gesendet.`);
    } catch (err) {
      console.error('Unexpected error during password reset request:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async () => {
    if (!resetCode.trim()) {
      setError('Bitte gib den Reset-Code ein.');
      return;
    }

    if (!resetNewPassword || resetNewPassword.length < 8) {
      setError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const result = await completePasswordReset(resetUsername, resetCode, resetNewPassword);

      if (!result.success) {
        setError(result.error?.message || 'Das Passwort konnte nicht zurückgesetzt werden.');
        return;
      }

      setIdentifier(resetUsername);
      setPassword('');
      clearResetForm();
      setStep('login');
      setSuccessMessage('Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.');
    } catch (err) {
      console.error('Unexpected error during password reset submit:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordBack = () => {
    clearMessages();

    if (resetStage === 'confirm') {
      setResetStage('request');
      setResetCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      return;
    }

    clearResetForm();
    setStep('welcome');
  };

  const renderAnimatedRows = () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.animatedImageContainer,
          {
            width: totalWidth,
            transform: [
              { translateX: scrollX },
              { translateY: -imageHeightWithMargin },
            ],
          },
        ]}
      >
        {[...Array(numRepeats)].flatMap((_, repeatIndex) =>
          welcomeImages.map((imgSrc, index) => (
            <Image
              key={`img-above-${repeatIndex}-${index}`}
              source={imgSrc}
              style={[
                styles.backgroundImage,
                { transform: [{ rotate: imageRotations[index % imageRotations.length] }] },
              ]}
            />
          ))
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.animatedImageContainer,
          {
            width: totalWidth,
            transform: [
              {
                translateX: scrollX.interpolate({
                  inputRange: [-scrollAmount, 0],
                  outputRange: [-scrollAmount - imageWidthWithMargin / 2, -(imageWidthWithMargin / 2)],
                }),
              },
            ],
          },
        ]}
      >
        {[...Array(numRepeats)].flatMap((_, repeatIndex) =>
          welcomeImages.map((imgSrc, index) => (
            <Image
              key={`img-center-${repeatIndex}-${index}`}
              source={imgSrc}
              style={[
                styles.backgroundImage,
                { transform: [{ rotate: imageRotations[(index + 2) % imageRotations.length] }] },
              ]}
            />
          ))
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.animatedImageContainer,
          {
            width: totalWidth,
            transform: [
              { translateX: scrollX },
              { translateY: imageHeightWithMargin },
            ],
          },
        ]}
      >
        {[...Array(numRepeats)].flatMap((_, repeatIndex) =>
          welcomeImages.map((imgSrc, index) => (
            <Image
              key={`img-below-${repeatIndex}-${index}`}
              source={imgSrc}
              style={[
                styles.backgroundImage,
                { transform: [{ rotate: imageRotations[(index + 4) % imageRotations.length] }] },
              ]}
            />
          ))
        )}
      </Animated.View>
    </View>
  );

  const renderWelcome = () => (
    <View style={styles.welcomeRootContainer}>
      {renderAnimatedRows()}
      <View style={styles.overlay} pointerEvents="none" />

      <View style={styles.contentContainer}>
        <Image
          source={require('../../assets/splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.welcomeTitle}>Willkommen bei MeinStrodehne</Text>
        <Text style={styles.welcomeText}>
          Dein Dorf in einer App. Bleib informiert, vernetzt und direkt im Gespräch.
        </Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              clearMessages();
              navigation.navigate('Register');
            }}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>Neu hier?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              clearMessages();
              setStep('login');
            }}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Login mit bestehendem Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => {
              clearMessages();
              clearResetForm();
              setResetUsername(identifier.trim().toLowerCase());
              setStep('forgotPassword');
            }}
            disabled={loading}
          >
            <Text style={styles.textButtonText}>Passwort vergessen?</Text>
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
        Melde dich mit deinem Benutzernamen an. Alte Accounts funktionieren auch noch mit E-Mail.
      </Text>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Benutzername</Text>
          <TextInput
            style={styles.textInput}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="deinname"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            Falls du dich früher mit E-Mail registriert hast, kannst du sie weiterhin hier eingeben.
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Passwort</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            clearMessages();
            setStep('welcome');
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, loading && styles.buttonDisabled]}
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
      <Text style={styles.preferencesTitle}>Passwort zurücksetzen</Text>
      <Text style={styles.preferencesText}>
        {resetStage === 'request'
          ? 'Gib deinen Benutzernamen ein. Wir senden dir einen Code an deine hinterlegte E-Mail-Adresse oder Telefonnummer.'
          : 'Gib den Code ein und vergebe ein neues Passwort.'}
      </Text>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Benutzername</Text>
          <TextInput
            style={[styles.textInput, resetStage === 'confirm' && styles.disabledInput]}
            value={resetUsername}
            onChangeText={setResetUsername}
            placeholder="deinname"
            autoCapitalize="none"
            autoCorrect={false}
            editable={resetStage === 'request'}
          />
        </View>

        {resetStage === 'confirm' ? (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Der Reset-Code wurde an {resetTarget || 'deine hinterlegte Kontaktmöglichkeit'} gesendet.
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Reset-Code</Text>
              <TextInput
                style={styles.textInput}
                value={resetCode}
                onChangeText={setResetCode}
                placeholder="123456"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Neues Passwort</Text>
              <TextInput
                style={styles.textInput}
                value={resetNewPassword}
                onChangeText={setResetNewPassword}
                placeholder="Mindestens 8 Zeichen"
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Passwort wiederholen</Text>
              <TextInput
                style={styles.textInput}
                value={resetConfirmPassword}
                onChangeText={setResetConfirmPassword}
                placeholder="Mindestens 8 Zeichen"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.inlineTextButton}
              onPress={handlePasswordResetRequest}
              disabled={loading}
            >
              <Text style={styles.textButtonText}>Code erneut senden</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Wir nutzen deine im Profil hinterlegte E-Mail-Adresse oder Telefonnummer. Die interne
              `@users.mylocalapp.de`-Adresse ist dafür nicht relevant.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleForgotPasswordBack}>
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, loading && styles.buttonDisabled]}
          onPress={resetStage === 'request' ? handlePasswordResetRequest : handlePasswordResetSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>
              {resetStage === 'request' ? 'Code senden' : 'Passwort speichern'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {step === 'welcome' ? (
        renderWelcome()
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            {step === 'login' ? renderLoginForm() : renderForgotPassword()}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
  textButton: {
    padding: 10,
    marginTop: 15,
    alignItems: 'center',
  },
  inlineTextButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  textButtonText: {
    color: '#3F51B5',
    fontSize: 14,
    textDecorationLine: 'underline',
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
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D7DEFF',
    color: '#222',
  },
  passwordContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D7DEFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#222',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  disabledInput: {
    backgroundColor: '#F3F5FD',
    color: '#68708D',
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    marginTop: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 5,
  },
  continueButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 180,
    alignItems: 'center',
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
    color: '#C62828',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: 'rgba(255, 235, 238, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  successText: {
    color: '#2E7D32',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: 'rgba(232, 245, 233, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  infoBox: {
    marginBottom: 18,
    padding: 15,
    backgroundColor: '#E8EAF6',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3F51B5',
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
});

export default WelcomeScreen;
