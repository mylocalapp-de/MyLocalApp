import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailability } from '../services/profileService';

const VERIFICATION_API_BASE = 'https://admin.mylocalapp.de/api/verification';
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

const COUNTRIES = [
  { code: 'DE', name: 'Deutschland', dialCode: '49' },
  { code: 'AT', name: 'Österreich', dialCode: '43' },
  { code: 'CH', name: 'Schweiz', dialCode: '41' },
  { code: 'GB', name: 'Vereinigtes Königreich', dialCode: '44' },
  { code: 'US', name: 'USA', dialCode: '1' },
  { code: 'FR', name: 'Frankreich', dialCode: '33' },
  { code: 'IT', name: 'Italien', dialCode: '39' },
  { code: 'ES', name: 'Spanien', dialCode: '34' },
  { code: 'NL', name: 'Niederlande', dialCode: '31' },
];

const normalizeUsername = (value = '') => value.trim().toLowerCase();

const validateUsername = (value = '') => {
  const normalized = normalizeUsername(value);

  if (!normalized) {
    return 'Bitte gib einen Benutzernamen ein.';
  }

  if (!USERNAME_REGEX.test(normalized)) {
    return 'Der Benutzername muss 3 bis 30 Zeichen lang sein und darf nur Kleinbuchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich enthalten.';
  }

  return '';
};

const validateEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const normalizePhoneToE164 = (inputRaw, selectedDialCode) => {
  if (!inputRaw) {
    return '';
  }

  const raw = (inputRaw || '').replace(/[^0-9+]/g, '');
  if (raw.startsWith('+')) {
    return `+${raw.replace(/[^0-9]/g, '')}`;
  }

  if (raw.startsWith('00')) {
    return `+${raw.slice(2).replace(/[^0-9]/g, '')}`;
  }

  const withoutLeadingZeros = raw.replace(/^0+/, '');
  if (!withoutLeadingZeros) {
    return '';
  }

  return `+${selectedDialCode}${withoutLeadingZeros}`;
};

const getSupabaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (fromEnv) {
    return fromEnv;
  }
  return Constants?.expoConfig?.extra?.supabaseUrl ?? '';
};

const buildApiHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Supabase-Url': getSupabaseUrl(),
});

const buildVerificationPayload = (method, target) => ({
  type: method,
  target,
  ...(method === 'email' ? { email: target } : { phone: target }),
});

const parseApiResponse = async (response) => {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

const RegisterScreen = ({ navigation }) => {
  const { signUpWithUsername } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [lastCheckedUsername, setLastCheckedUsername] = useState('');
  const [verifyMethod, setVerifyMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [sentTarget, setSentTarget] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (resendCountdown <= 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [resendCountdown]);

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const handleUsernameChange = (value) => {
    const normalizedValue = value.toLowerCase().replace(/\s+/g, '');
    setUsername(normalizedValue);
    if (normalizeUsername(normalizedValue) !== lastCheckedUsername) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      setLastCheckedUsername('');
    }
  };

  const checkUsername = async (candidate = username) => {
    const normalized = normalizeUsername(candidate);
    const validationMessage = validateUsername(normalized);

    if (validationMessage) {
      setUsernameStatus('invalid');
      setUsernameMessage(validationMessage);
      return false;
    }

    if (normalized === lastCheckedUsername && usernameStatus === 'available') {
      return true;
    }

    setUsernameStatus('checking');
    setUsernameMessage('Prüfe Verfügbarkeit...');

    try {
      const result = await checkUsernameAvailability(normalized);

      if (result.error) {
        setUsernameStatus('error');
        setUsernameMessage(result.error.message || 'Der Benutzername konnte nicht geprüft werden.');
        return false;
      }

      if (!result.available) {
        setUsernameStatus('taken');
        setUsernameMessage('Dieser Benutzername ist bereits vergeben.');
        return false;
      }

      setLastCheckedUsername(normalized);
      setUsernameStatus('available');
      setUsernameMessage('Dieser Benutzername ist verfügbar.');
      return true;
    } catch {
      setUsernameStatus('error');
      setUsernameMessage('Der Benutzername konnte nicht geprüft werden.');
      return false;
    }
  };

  const getVerificationTarget = () => {
    if (verifyMethod === 'email') {
      const normalizedEmail = email.trim().toLowerCase();

      if (!validateEmail(normalizedEmail)) {
        return { success: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
      }

      return { success: true, value: normalizedEmail };
    }

    const normalizedPhone = normalizePhoneToE164(phone.trim(), selectedCountry.dialCode);
    if (!normalizedPhone || !normalizedPhone.startsWith('+') || normalizedPhone.length < 8) {
      return { success: false, error: 'Bitte gib eine gültige Telefonnummer ein.' };
    }

    return { success: true, value: normalizedPhone };
  };

  const handleNextToVerification = async () => {
    clearMessages();

    const usernameValidationMessage = validateUsername(username);
    if (usernameValidationMessage) {
      setUsernameStatus('invalid');
      setUsernameMessage(usernameValidationMessage);
      return;
    }

    if (!password) {
      setError('Bitte vergib ein Passwort.');
      return;
    }

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    const usernameAvailable = await checkUsername(username);
    if (!usernameAvailable) {
      return;
    }

    setCurrentStep(2);
  };

  const sendVerificationCode = async ({ advanceToOtpStep = true } = {}) => {
    clearMessages();
    setCountryOpen(false);

    const targetResult = getVerificationTarget();
    if (!targetResult.success) {
      setError(targetResult.error);
      return false;
    }

    setIsSendingCode(true);

    try {
      const response = await fetch(`${VERIFICATION_API_BASE}/send`, {
        method: 'POST',
        headers: buildApiHeaders(),
        body: JSON.stringify(buildVerificationPayload(verifyMethod, targetResult.value)),
      });
      const result = await parseApiResponse(response);

      if (!response.ok || result?.success === false) {
        setError(result?.message || 'Der Bestätigungscode konnte nicht gesendet werden.');
        return false;
      }

      setSentTarget(targetResult.value);
      setOtpCode('');
      setResendCountdown(30);
      setSuccessMessage(
        verifyMethod === 'phone'
          ? `Wir haben einen SMS-Code an ${targetResult.value} gesendet.`
          : `Wir haben einen Code an ${targetResult.value} gesendet.`
      );

      if (advanceToOtpStep) {
        setCurrentStep(3);
      }

      return true;
    } catch {
      setError('Der Bestätigungscode konnte nicht gesendet werden.');
      return false;
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleCreateAccount = async () => {
    clearMessages();

    const targetResult = getVerificationTarget();
    if (!targetResult.success) {
      setCurrentStep(2);
      setError(targetResult.error);
      return;
    }

    if (!otpCode.trim()) {
      setError('Bitte gib den Bestätigungscode ein.');
      return;
    }

    if (!acceptedTerms) {
      setError('Bitte akzeptiere die AGB und Datenschutzbestimmungen.');
      return;
    }

    setIsCreatingAccount(true);

    try {
      const result = await signUpWithUsername(username, password, verifyMethod, {
        value: targetResult.value,
        code: otpCode.trim(),
        showInList: true,
      });

      if (!result.success) {
        setError(result.error?.message || 'Registrierung fehlgeschlagen.');
        return;
      }
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleBack = () => {
    clearMessages();
    setCountryOpen(false);

    if (currentStep === 1) {
      navigation.goBack();
      return;
    }

    if (currentStep === 3) {
      setOtpCode('');
    }

    setCurrentStep((prev) => prev - 1);
  };

  const renderUsernameMessage = () => {
    if (!usernameMessage) {
      return null;
    }

    const isPositive = usernameStatus === 'available';
    const isChecking = usernameStatus === 'checking';

    return (
      <View style={styles.usernameStatusRow}>
        {isChecking ? (
          <ActivityIndicator size="small" color="#3F51B5" />
        ) : (
          <Ionicons
            name={isPositive ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={isPositive ? '#2E7D32' : '#C62828'}
          />
        )}
        <Text style={[styles.usernameStatusText, isPositive ? styles.usernameStatusSuccess : styles.usernameStatusError]}>
          {usernameMessage}
        </Text>
      </View>
    );
  };

  const renderProgress = () => (
    <View style={styles.progressRow}>
      {[1, 2, 3].map((stepNumber) => {
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <View
            key={stepNumber}
            style={[
              styles.progressStep,
              isActive && styles.progressStepActive,
              isCompleted && styles.progressStepCompleted,
            ]}
          >
            <Text
              style={[
                styles.progressStepText,
                (isActive || isCompleted) && styles.progressStepTextActive,
              ]}
            >
              {stepNumber}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderStepOne = () => (
    <>
      <Text style={styles.title}>Registrieren</Text>
      <Text style={styles.description}>
        Wähle einen Benutzernamen, unter dem dich die Strodehner kennen. Mit diesem Namen meldest du dich später in der App an.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Benutzername</Text>
        <TextInput
          style={styles.textInput}
          value={username}
          onChangeText={handleUsernameChange}
          onBlur={() => {
            if (username.trim()) {
              void checkUsername(username);
            }
          }}
          placeholder="z.B. hans.mueller"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
        />
        <Text style={styles.helperText}>Groß- und Kleinschreibung egal – Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich. Keine Leerzeichen.</Text>
        {renderUsernameMessage()}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Passwort</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Mindestens 8 Zeichen"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Passwort wiederholen</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Mindestens 8 Zeichen"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderStepTwo = () => (
    <>
      <Text style={styles.title}>Verifizierung wählen</Text>
      <Text style={styles.description}>
        Hinterlege eine E-Mail-Adresse oder Telefonnummer. Darüber senden wir dir jetzt den Code
        und später bei Bedarf auch einen Passwort-Reset.
      </Text>

      <View style={styles.modeSwitch}>
        <TouchableOpacity
          style={[styles.modeButton, verifyMethod === 'email' && styles.modeButtonActive]}
          onPress={() => {
            clearMessages();
            setVerifyMethod('email');
          }}
        >
          <Ionicons name="mail-outline" size={16} color={verifyMethod === 'email' ? '#fff' : '#333'} />
          <Text style={[styles.modeButtonText, verifyMethod === 'email' && styles.modeButtonTextActive]}>
            E-Mail
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, verifyMethod === 'phone' && styles.modeButtonActive]}
          onPress={() => {
            clearMessages();
            setVerifyMethod('phone');
          }}
        >
          <Ionicons name="call-outline" size={16} color={verifyMethod === 'phone' ? '#fff' : '#333'} />
          <Text style={[styles.modeButtonText, verifyMethod === 'phone' && styles.modeButtonTextActive]}>
            Telefon
          </Text>
        </TouchableOpacity>
      </View>

      {verifyMethod === 'email' ? (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>E-Mail-Adresse</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="name@beispiel.de"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Telefonnummer</Text>
          <View style={styles.phoneRow}>
            <View style={[styles.countrySelector, countryOpen && styles.countrySelectorOpen]}>
              <TouchableOpacity style={styles.countryButton} onPress={() => setCountryOpen((prev) => !prev)}>
                <Text style={styles.countryButtonText}>+{selectedCountry.dialCode}</Text>
                <Ionicons name={countryOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#333" />
              </TouchableOpacity>

              {countryOpen ? (
                <View style={styles.dropdown}>
                  {COUNTRIES.map((country) => (
                    <TouchableOpacity
                      key={country.code}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCountry(country);
                        setCountryOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>+{country.dialCode} {country.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <TextInput
              style={[styles.textInput, styles.phoneInput]}
              value={phone}
              onChangeText={setPhone}
              placeholder="0170 1234567"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="tel"
            />
          </View>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Diese Angabe ist dein Verifizierungs- und Wiederherstellungskanal. Sie ist nicht dein
          Login-Name.
        </Text>
      </View>
    </>
  );

  const renderStepThree = () => (
    <>
      <Text style={styles.title}>Code bestätigen</Text>
      <Text style={styles.description}>
        Gib den Code ein, den wir an {sentTarget || 'deine Kontaktmöglichkeit'} gesendet haben.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Benutzername: <Text style={styles.boldText}>{normalizeUsername(username)}</Text>
        </Text>
        <Text style={styles.infoText}>
          Verifizierung: <Text style={styles.boldText}>{verifyMethod === 'phone' ? 'Telefon' : 'E-Mail'}</Text>
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Bestätigungscode</Text>
        <TextInput
          style={styles.textInput}
          value={otpCode}
          onChangeText={setOtpCode}
          placeholder={verifyMethod === 'email' ? 'ABC123' : '123456'}
          keyboardType={verifyMethod === 'email' ? 'default' : 'number-pad'}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[styles.inlineTextButton, resendCountdown > 0 && styles.inlineTextButtonDisabled]}
        onPress={() => {
          if (resendCountdown === 0) {
            void sendVerificationCode({ advanceToOtpStep: false });
          }
        }}
        disabled={isSendingCode || resendCountdown > 0}
      >
        {isSendingCode ? (
          <ActivityIndicator size="small" color="#3F51B5" />
        ) : (
          <Text style={styles.inlineTextButtonText}>
            {resendCountdown > 0 ? `Code erneut senden in ${resendCountdown}s` : 'Code erneut senden'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.termsContainer}>
        <Switch value={acceptedTerms} onValueChange={setAcceptedTerms} />
        <Text style={styles.termsText}>
          Ich akzeptiere die <Text style={styles.linkText} onPress={() => Linking.openURL('https://mylocalapp.de/agb')}>AGB</Text> und die{' '}
          <Text style={styles.linkText} onPress={() => Linking.openURL('https://mylocalapp.de/datenschutz')}>Datenschutzbestimmungen</Text>.
        </Text>
      </View>


    </>
  );

  const isPrimaryLoading = isSendingCode || isCreatingAccount || usernameStatus === 'checking';

  const scrollRef = useRef(null);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backNavButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        {renderProgress()}

        <View style={styles.card}>
          {currentStep === 1 ? renderStepOne() : null}
          {currentStep === 2 ? renderStepTwo() : null}
          {currentStep === 3 ? renderStepThree() : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.actionButton, isPrimaryLoading && styles.buttonDisabled]}
            onPress={
              currentStep === 1
                ? handleNextToVerification
                : currentStep === 2
                  ? () => {
                      void sendVerificationCode();
                    }
                  : handleCreateAccount
            }
            disabled={isPrimaryLoading}
          >
            {isPrimaryLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionButtonText}>
                {currentStep === 1 ? 'Weiter' : currentStep === 2 ? 'Code senden' : 'Account erstellen'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => navigation.navigate('Welcome')}
            disabled={isPrimaryLoading}
          >
            <Text style={styles.textButtonText}>Bereits registriert? Anmelden</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {countryOpen ? (
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setCountryOpen(false)}
        />
      ) : null}
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
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  backNavButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingRight: 10,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  progressStep: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8EAF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  progressStepActive: {
    backgroundColor: '#3F51B5',
  },
  progressStepCompleted: {
    backgroundColor: '#9FA8DA',
  },
  progressStepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5C6480',
  },
  progressStepTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A237E',
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D7DEFF',
    color: '#222',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
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
    paddingVertical: 12,
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  usernameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  usernameStatusText: {
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  usernameStatusSuccess: {
    color: '#2E7D32',
  },
  usernameStatusError: {
    color: '#C62828',
  },
  modeSwitch: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D7DEFF',
    backgroundColor: '#F7F8FD',
    marginHorizontal: 4,
  },
  modeButtonActive: {
    backgroundColor: '#3F51B5',
    borderColor: '#3F51B5',
  },
  modeButtonText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  countrySelector: {
    width: 120,
    marginRight: 10,
    position: 'relative',
  },
  countrySelectorOpen: {
    zIndex: 1001,
  },
  countryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D7DEFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7DEFF',
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 2000,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1FF',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
  },
  infoBox: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  boldText: {
    fontWeight: '700',
  },
  inlineTextButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 18,
  },
  inlineTextButtonDisabled: {
    opacity: 0.7,
  },
  inlineTextButtonText: {
    fontSize: 14,
    color: '#3F51B5',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  termsText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  linkText: {
    color: '#3F51B5',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: 'rgba(255, 235, 238, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  successText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: 'rgba(232, 245, 233, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#3F51B5',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  textButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  textButtonText: {
    fontSize: 14,
    color: '#3F51B5',
    textDecorationLine: 'underline',
  },
  dropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
  },
});

export default RegisterScreen;
