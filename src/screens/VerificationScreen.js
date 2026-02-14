import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { markProfileVerified } from '../services/profileService';
import { useAppConfig } from '../context/AppConfigContext';

const API_BASE = 'https://admin.mylocalapp.de/api/verification';

const getSupabaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (fromEnv) return fromEnv;
  return Constants?.expoConfig?.extra?.supabaseUrl;
};

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

const normalizePhoneToE164 = (inputRaw, selectedDialCode) => {
  if (!inputRaw) return '';
  const raw = (inputRaw || '').replace(/[^0-9+]/g, '');
  if (raw.startsWith('+')) {
    // Already international, keep plus and digits only
    return '+' + raw.replace(/[^0-9]/g, '');
  }
  // Convert 00 prefix to +
  if (raw.startsWith('00')) {
    return '+' + raw.slice(2).replace(/[^0-9]/g, '');
  }
  // Local: strip leading zeros
  const withoutLeadingZeros = raw.replace(/^0+/, '');
  if (!withoutLeadingZeros) return '';
  return `+${selectedDialCode}${withoutLeadingZeros}`;
};

const VerificationScreen = () => {
  const { loadUserProfile, user, signOut } = useAuth();
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const [mode, setMode] = useState('phone'); // 'phone' | 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default DE

  const supabaseUrl = getSupabaseUrl();

  // Skip verification if disabled via remote config/env
  useEffect(() => {
    const disableVerifyEnv = process.env.EXPO_PUBLIC_DISABLE_VERIFY;
    const disableVerifyFromEnvOrConfig = (val) => val === true || val === 'true' || val === '1';
    const disabled = appConfigLoading
      ? disableVerifyFromEnvOrConfig(disableVerifyEnv) || disableVerifyFromEnvOrConfig(Constants?.expoConfig?.extra?.disableVerify)
      : disableVerifyFromEnvOrConfig(appConfig.EXPO_PUBLIC_DISABLE_VERIFY);
    if (disabled) {
      // If disabled, and we are on this screen, simply do nothing special.
      // AppNavigator already skips routing to this screen; this is a safety no-op.
    }
  }, [appConfig, appConfigLoading]);

  const sendVerification = async () => {
    try {
      setIsSending(true);
      let body;
      if (mode === 'phone') {
        const formatted = normalizePhoneToE164(phone.trim(), selectedCountry.dialCode);
        if (!formatted || !formatted.startsWith('+')) {
          Alert.alert('Fehler', 'Bitte gib eine gültige Telefonnummer ein.');
          return;
        }
        body = { phone: formatted };
      } else {
        body = { email: email.trim() };
      }
      if ((mode === 'phone' && !body.phone) || (mode === 'email' && !body.email)) {
        Alert.alert('Fehler', 'Bitte gib eine gültige Telefonnummer oder E‑Mail ein.');
        return;
      }
      const res = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Url': supabaseUrl || '',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Senden fehlgeschlagen');
      }
      Alert.alert('Gesendet', 'Der Code wurde gesendet. Bitte prüfe dein Gerät/Posteingang.');
    } catch (e) {
      console.error('[Verification] send error:', e);
      Alert.alert('Fehler', e.message || 'Der Code konnte nicht gesendet werden.');
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    try {
      setIsVerifying(true);
      const trimmedCode = code.trim();
      if (!trimmedCode) {
        Alert.alert('Fehler', 'Bitte gib den Bestätigungscode ein.');
        return;
      }
      let body;
      if (mode === 'phone') {
        const formatted = normalizePhoneToE164(phone.trim(), selectedCountry.dialCode);
        if (!formatted || !formatted.startsWith('+')) {
          Alert.alert('Fehler', 'Bitte gib eine gültige Telefonnummer ein.');
          return;
        }
        body = { phone: formatted, code: trimmedCode };
      } else {
        body = { email: email.trim(), code: trimmedCode };
      }
      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Url': supabaseUrl || '',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Verifizierung fehlgeschlagen');
      }
      // After successful verification, explicitly set is_verified=true in profile
      if (user?.id) {
        try {
          const { error: updateError } = await markProfileVerified(user.id);
          if (updateError) {
            console.warn('[Verification] profile update failed, will refetch profile:', updateError);
          }
          await loadUserProfile(user.id);
        } catch (innerErr) {
          console.warn('[Verification] unexpected error while updating profile:', innerErr);
          // Fallback: attempt to reload profile after a brief delay
          await new Promise(r => setTimeout(r, 600));
          await loadUserProfile(user.id);
        }
      }
      Alert.alert('Erfolg', 'Dein Account wurde verifiziert.');
    } catch (e) {
      console.error('[Verification] verify error:', e);
      Alert.alert('Fehler', e.message || 'Der Code konnte nicht verifiziert werden.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await signOut();
      if (!result?.success) {
        Alert.alert('Fehler', result?.error?.message || 'Abmeldung fehlgeschlagen.');
      }
      // Navigation will switch to Welcome via auth state
    } catch (e) {
      console.error('[Verification] logout error:', e);
      Alert.alert('Fehler', 'Abmeldung fehlgeschlagen.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verifizierung</Text>
        <Text style={styles.subtitle}>Bitte verifiziere deinen Account per SMS oder E‑Mail, um fortzufahren. Wir speichern deine Telefonnummer und E‑Mail nicht.</Text>

        <View style={styles.modeSwitch}>
          <TouchableOpacity style={[styles.modeButton, mode === 'phone' && styles.modeButtonActive]} onPress={() => setMode('phone')}>
            <Ionicons name="call-outline" size={16} color={mode === 'phone' ? '#fff' : '#333'} />
            <Text style={[styles.modeButtonText, mode === 'phone' && styles.modeButtonTextActive]}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, mode === 'email' && styles.modeButtonActive]} onPress={() => setMode('email')}>
            <Ionicons name="mail-outline" size={16} color={mode === 'email' ? '#fff' : '#333'} />
            <Text style={[styles.modeButtonText, mode === 'email' && styles.modeButtonTextActive]}>E‑Mail</Text>
          </TouchableOpacity>
        </View>

        {mode === 'phone' ? (
          <View style={styles.phoneRow}>
            <View style={[styles.countrySelector, countryOpen && styles.countrySelectorOpen]}>
              <TouchableOpacity onPress={() => setCountryOpen(v => !v)} style={styles.countryButton}>
                <Text style={styles.countryButtonText}>+{selectedCountry.dialCode}</Text>
                <Ionicons name={countryOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#333" />
              </TouchableOpacity>
              {countryOpen && (
                <View style={styles.dropdown}>
                  {COUNTRIES.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCountry(c);
                        setCountryOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>+{c.dialCode}  {c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder={`Telefon (z.B. 01771234567)`}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
            />
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="E‑Mail (z.B. user@example.com)"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        )}

        <TouchableOpacity style={[styles.primaryButton, (isSending) && styles.buttonDisabled]} onPress={sendVerification} disabled={isSending}>
          {isSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Code senden</Text>}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Bestätigungscode"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />

        <TouchableOpacity style={[styles.primaryButton, (isVerifying) && styles.buttonDisabled]} onPress={verifyCode} disabled={isVerifying}>
          {isVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verifizieren</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#666" />
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>
      </View>
      {countryOpen && (
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setCountryOpen(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A237E',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  modeButtonActive: {
    backgroundColor: '#3F51B5',
  },
  modeButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  countrySelector: {
    width: 120,
    marginRight: 8,
    position: 'relative',
  },
  countrySelectorOpen: {
    zIndex: 1001,
  },
  countryButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 2000,
    elevation: 20,
    maxHeight: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  dropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1500,
  },
  primaryButton: {
    backgroundColor: '#3F51B5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logoutButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: '#666',
    fontWeight: '600',
  },
});

export default VerificationScreen;

