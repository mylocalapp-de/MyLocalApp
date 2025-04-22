import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Keyboard, 
  TouchableWithoutFeedback, 
  ScrollView,
  Modal // Added Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext'; // To switch context after success
import { supabase } from '../lib/supabase'; // Import supabase client
import Purchases, { PurchasesOffering, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants'; // Import Constants
import { Platform } from 'react-native'; // Import Platform

// TODO: Configure Purchases SDK with your API key, typically in App.js
// Purchases.configure({ apiKey: "YOUR_REVENUECAT_API_KEY" });
// Purchases.setLogLevel(LOG_LEVEL.DEBUG); // Optional: For debugging

const OrganizationSetupScreen = ({ navigation }) => {
  const [mode, setMode] = useState('select'); // 'select', 'create', 'join', 'voucher'
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [voucherCode, setVoucherCode] = useState(''); // State for voucher input
  const [isLoading, setIsLoading] = useState(false);
  const [isVoucherLoading, setIsVoucherLoading] = useState(false); // Loading state for voucher check
  const [error, setError] = useState('');
  const [voucherError, setVoucherError] = useState(''); // Specific error for voucher modal
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  
  const { createOrganization, joinOrganizationByInviteCode } = useAuth();
  const { switchOrganizationContext } = useOrganization();
  const { user } = useAuth(); // Get current user ID

  // --- RevenueCat State ---
  const [offerings, setOfferings] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isFetchingOfferings, setIsFetchingOfferings] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null); // Use null consistently

  // --- Configure RevenueCat SDK --- 
  useEffect(() => {
    // Get the keys from app.config.js extra field
    const revenueCatApiKeyAndroid = Constants.expoConfig?.extra?.revenueCatApiKeyAndroid;
    const revenueCatApiKeyIos = Constants.expoConfig?.extra?.revenueCatApiKeyIos;
    
    const apiKey = Platform.OS === 'ios' ? revenueCatApiKeyIos : revenueCatApiKeyAndroid;
    
    // --- Add logging to verify the loaded API key ---
    console.log(`[RevenueCat Config] Platform: ${Platform.OS}, API Key loaded: ${apiKey ? '******' + apiKey.substring(apiKey.length - 5) : 'NOT FOUND'}`);
    // --- End logging ---

    if (apiKey) {
      Purchases.configure({ apiKey });
      console.log('RevenueCat SDK configured in OrganizationSetupScreen.');
      // Optional: Set log level for debugging - uncomment if needed
      // Purchases.setLogLevel(LOG_LEVEL.DEBUG); 
    } else {
      console.error('RevenueCat API key not found for this platform. Please check environment variables, app.config.js, and EAS secrets.');
      // Display an error to the user as purchases won't work
      setPurchaseError("Kauf-Funktion nicht verfügbar. API-Schlüssel fehlt.");
    }
  }, []); // Empty dependency array ensures this runs only once when the component mounts

  // --- Fetch RevenueCat Offerings ---
  useEffect(() => {
    const getOfferings = async () => {
      if (mode === 'create' && !voucherCode) { // Fetch only when needed and not using voucher
          setIsFetchingOfferings(true);
          setPurchaseError(null); // Clear previous purchase errors
          try {
              const fetchedOfferings = await Purchases.getOfferings();
              if (fetchedOfferings.current !== null && fetchedOfferings.current.availablePackages.length > 0) {
                  setOfferings(fetchedOfferings.current);
                  // --- Explicitly select the target package ---
                  const targetPackageId = '$rc_weekly'; // Match the Identifier from RevenueCat Offering Package
                  const targetPackage = fetchedOfferings.current.availablePackages.find(
                      pkg => pkg.identifier === targetPackageId
                  );

                  if (targetPackage) {
                      setSelectedPackage(targetPackage);
                  } else {
                      setPurchaseError("Das benötigte Abo-Paket wurde nicht gefunden.");
                      console.error(`Could not find package with ID: ${targetPackageId} in current offering.`);
                      setSelectedPackage(null); // Ensure no package is selected
                  }
                  // --- End explicit selection ---
              } else {
                  setPurchaseError("Keine Kaufoptionen verfügbar.");
                  setSelectedPackage(null); // Ensure no package is selected
              }
          } catch (e) {
              // --- Enhanced Error Logging ---
              console.error("Error fetching RevenueCat offerings. Details:", JSON.stringify(e, null, 2));
              // Log specific properties if they exist (common ones)
              if (e.code) console.error("RevenueCat Error Code:", e.code);
              if (e.message) console.error("RevenueCat Error Message:", e.message);
              if (e.underlyingErrorMessage) console.error("RevenueCat Underlying Error:", e.underlyingErrorMessage);
              // --- End Enhanced Error Logging ---

              setPurchaseError("Fehler beim Laden der Kaufoptionen.");
              Alert.alert("Fehler", "Kaufoptionen konnten nicht geladen werden. Bitte versuche es später erneut.");
          } finally {
              setIsFetchingOfferings(false);
          }
      } else {
          // Clear offerings if not in create mode or if using voucher
          setOfferings(null);
          setSelectedPackage(null);
      }
    };

    getOfferings();
  }, [mode, voucherCode]); // Re-fetch if mode changes or voucherCode is set/cleared

  const handleCreateWithVoucher = async () => {
    if (!orgName.trim() || orgName.trim().length < 3) {
      setError('Organisationsname muss mind. 3 Zeichen lang sein.');
      return;
    }
    
    Keyboard.dismiss();
    setIsLoading(true);
    setError('');
    
    // Important: Mark the voucher as used in the database BEFORE creating the org
    try {
      const { error: updateError } = await supabase
        .from('organization_vouchers')
        .update({ 
          is_used: true, 
          used_at: new Date().toISOString(),
          user_id: user?.id // Record who used it
        })
        .eq('code', voucherCode)
        .is('is_used', false); // Only update if not already used

      if (updateError) {
        console.error("Error marking voucher as used:", updateError);
        setError('Fehler beim Einlösen des Gutscheins. Versuche es erneut.');
        setIsLoading(false);
        setVoucherCode(''); // Clear voucher code on failure
        setMode('select'); // Go back to selection
        return;
      }

      // If voucher update was successful, proceed with organization creation
      const result = await createOrganization(orgName.trim());
    
      setIsLoading(false);
      
      if (result.success) {
        Alert.alert('Erfolg', `Organisation "${result.data.name}" wurde erstellt!`);
        // Optionally switch context immediately
        // await switchOrganizationContext(result.data.id); 
        navigation.goBack(); // Go back to profile screen after creation
      } else {
        // If org creation fails *after* voucher use, it's tricky. 
        // Log this state. Might need manual DB correction or a rollback mechanism.
        console.error(`CRITICAL: Voucher ${voucherCode} marked used, but org creation failed for user ${user?.id}:`, result.error);
        setError(String(result.error?.message || 'Organisation konnte nicht erstellt werden, obwohl der Gutschein verwendet wurde. Bitte kontaktiere den Support.'));
      }

    } catch (err) {
        console.error("Unexpected error during voucher creation flow:", err);
        setError('Ein unerwarteter Fehler ist aufgetreten.');
        setIsLoading(false);
    } finally {
        // Clear voucher state regardless of success/failure after attempt
        // setVoucherCode(''); // Maybe keep it visible if org creation failed? Let's clear it for now.
    }
  };

  // --- Handle Paid Organization Creation ---
  const handlePurchaseAndCreate = async () => {
    if (!orgName.trim() || orgName.trim().length < 3) {
        setError('Organisationsname muss mind. 3 Zeichen lang sein.');
        return;
    }
    if (!selectedPackage) {
        setError('Kaufpaket nicht ausgewählt oder verfügbar.');
        Alert.alert("Fehler", "Es konnte kein gültiges Kaufpaket gefunden werden. Bitte versuche es später erneut.");
        return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setError('');
    setPurchaseError(null);

    try {
        // 1. Initiate purchase
        const purchaseResult = await Purchases.purchasePackage(selectedPackage);

        // --- Add check for valid result before destructuring ---
        if (!purchaseResult || typeof purchaseResult !== 'object') {
            console.error("Invalid response from purchasePackage:", purchaseResult);
            throw new Error("Ungültige Antwort vom Kaufvorgang."); 
        }
        // --- End Add check ---

        const { customerInfo, productIdentifier } = purchaseResult;

        // --- Add check for customerInfo before accessing entitlements ---
        if (!customerInfo || typeof customerInfo !== 'object') {
             console.error("customerInfo is missing or invalid after purchase:", customerInfo);
             throw new Error("Benutzerinformationen nach Kauf ungültig.");
        }
        // --- End Add check ---

        // 2. Verify purchase entitlement
        // RevenueCat automatically grants entitlement access based on customerInfo
        // Check if the user has the required entitlement (e.g., 'organization_admin')
        // TODO: Define your entitlement identifier in RevenueCat dashboard
        const requiredEntitlement = 'organization_admin'; // Replace with your actual entitlement ID

        // Ensure entitlements.active exists and is an object before checking the specific entitlement
        if (customerInfo.entitlements?.active && typeof customerInfo.entitlements.active === 'object' && typeof customerInfo.entitlements.active[requiredEntitlement] !== 'undefined') {
            // 3. Purchase successful and entitlement active, proceed with organization creation
            console.log(`Purchase successful for ${productIdentifier}, entitlement '${requiredEntitlement}' active.`);
            
            const result = await createOrganization(orgName.trim());
            
            if (result.success) {
                Alert.alert('Erfolg', `Organisation "${result.data.name}" wurde erstellt und dein Abo ist aktiv!`);
                navigation.goBack(); // Go back to profile screen
            } else {
                // Handle organization creation failure *after* successful payment
                // This is a critical state. Log it, inform the user to contact support.
                console.error(`CRITICAL: Payment successful (Product: ${productIdentifier}, Entitlement: ${requiredEntitlement}) but org creation failed for user ${user?.id}:`, result.error);
                setError(String(result.error?.message || 'Dein Abo ist aktiv, aber die Organisation konnte nicht erstellt werden. Bitte kontaktiere den Support.'));
                // Keep user on this screen to see the error
            }
        } else {
            // Entitlement not found after purchase - should not happen with correct setup
            console.error(`Purchase successful for ${productIdentifier}, but required entitlement '${requiredEntitlement}' not found in active entitlements for user ${user?.id}.`, customerInfo.entitlements.active);
            setError('Kauf erfolgreich, aber Berechtigung konnte nicht überprüft werden. Bitte kontaktiere den Support.');
        }

    } catch (e) {
        console.log("Purchase Error:", JSON.stringify(e, null, 2));
        if (!e.userCancelled) {
            setError('Kauf fehlgeschlagen. Bitte versuche es erneut.');
            Alert.alert('Kauf fehlgeschlagen', e.message);
        } else {
            setError('Kauf abgebrochen.'); // Optional: inform user about cancellation
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Bitte gib einen Einladungscode ein.');
      return;
    }
    
    Keyboard.dismiss();
    setIsLoading(true);
    setError('');
    
    const result = await joinOrganizationByInviteCode(inviteCode.trim());
    
    setIsLoading(false);
    
    if (result.success) {
      Alert.alert('Erfolg', `Du bist "${result.data.name}" beigetreten!`);
      // Optionally switch context immediately
      // await switchOrganizationContext(result.data.id);
      navigation.goBack(); // Go back to profile screen after joining
    } else {
      // Provide more specific error feedback for invite codes
      let errorMessage = 'Beitritt fehlgeschlagen.';
      if (result.error?.message?.includes('not found')) {
          errorMessage = 'Einladungscode ungültig oder abgelaufen.';
      } else if (result.error?.message?.includes('already a member')) {
          errorMessage = 'Du bist bereits Mitglied dieser Organisation.';
      } else {
          errorMessage = String(result.error?.message || errorMessage);
      }
      setError(errorMessage);
    }
  };
  
  // --- Voucher Validation ---
  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Bitte gib einen Gutschein-Code ein.');
      return;
    }
    
    Keyboard.dismiss();
    setIsVoucherLoading(true);
    setVoucherError('');
    
    try {
      const { data, error: dbError } = await supabase
        .from('organization_vouchers')
        .select('id, is_used, expires_at')
        .eq('code', voucherCode.trim())
        .maybeSingle(); // Use maybeSingle to handle non-existent codes gracefully

      if (dbError) {
        console.error("Error fetching voucher:", dbError);
        setVoucherError('Fehler bei der Überprüfung des Codes.');
      } else if (!data) {
        setVoucherError('Gutschein-Code nicht gefunden.');
      } else if (data.is_used) {
        setVoucherError('Dieser Gutschein wurde bereits verwendet.');
      } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setVoucherError('Dieser Gutschein ist abgelaufen.');
      } else {
        // Voucher is valid!
        setShowVoucherModal(false);
        setMode('create'); // Proceed to the create form
        setError(''); // Clear main screen error
      }
    } catch (err) {
      console.error("Unexpected error during voucher validation:", err);
      setVoucherError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsVoucherLoading(false);
    }
  };

  // --- Render Functions ---

  const renderCreateForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Name der neuen Organisation</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. Sportverein Musterdorf"
        value={orgName}
        onChangeText={setOrgName}
        autoCapitalize="words"
      />
      {!!error && (
        <Text style={styles.errorText}>
          {String(error)}
        </Text>
      )}
      {/* If we got here via voucher, the voucherCode state is set */}
      {voucherCode ? (
         <TouchableOpacity 
            style={[styles.button, styles.actionButtonPaywall, isLoading && styles.buttonDisabled]} 
            onPress={handleCreateWithVoucher} // Use specific handler
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Organisation mit Gutschein erstellen</Text>}
          </TouchableOpacity>
      ) : (
        // --- Actual Payment Button ---
        <View style={styles.paymentSection}>
          {isFetchingOfferings ? (
            <ActivityIndicator size="small" color="#007BFF" />
          ) : selectedPackage ? (
             <TouchableOpacity 
                style={[styles.button, styles.actionButtonPaywall, isLoading && styles.buttonDisabled]} 
                onPress={handlePurchaseAndCreate} // Use new handler
                disabled={isLoading || !selectedPackage} // Disable if no package or loading
             >
                {isLoading ? <ActivityIndicator color="#fff" /> : 
                    <Text style={styles.buttonText}>
                        {`Erstellen (${selectedPackage.product.priceString} / ${selectedPackage.product.subscriptionPeriod || 'einmalig'})`} 
                    </Text>
                }
             </TouchableOpacity>
          ) : (
              <Text style={styles.errorText}>{purchaseError || "Keine Kaufoptionen ladbar."}</Text>
          )}
          {(purchaseError && !isFetchingOfferings) && ( // Show specific purchase errors
             <Text style={[styles.errorText, { marginTop: 5 }]}>{purchaseError}</Text>
          )}
        </View>
      )}
     
      <TouchableOpacity onPress={() => { setMode('select'); setError(''); setOrgName(''); setVoucherCode(''); setPurchaseError(null); /* Clear voucher & purchase error */ }}>
        <Text style={styles.backLink}>Zurück</Text>
      </TouchableOpacity>
    </View>
  );

  const renderJoinForm = () => (
     <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Einladungscode</Text>
      <TextInput
        style={styles.input}
        placeholder="Code eingeben"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="none"
        maxLength={8} // Assuming invite codes are 8 chars
      />
      {!!error && (
        <Text style={styles.errorText}>
          {String(error)}
        </Text>
      )}
      <TouchableOpacity 
        style={[styles.button, styles.actionButtonJoin, isLoading && styles.buttonDisabled]} // Different style for Join button
        onPress={handleJoin}
        disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Organisation beitreten</Text>}
      </TouchableOpacity>
       <TouchableOpacity onPress={() => { setMode('select'); setError(''); setInviteCode(''); }}>
        <Text style={styles.backLink}>Zurück</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSelectionMode = () => (
    <View style={styles.selectionContainer}>
        {/* Paywall Card */}
        <View style={styles.paywallCard}>
            <Text style={styles.paywallTitle}>Werde Admin deiner eigenen Organisation</Text>
            <Text style={styles.paywallSubtitle}>Nutze exklusive Tools und erreiche maximale Sichtbarkeit</Text>
            
            <View style={styles.featureList}>
                <View style={styles.featureItem}>
                    <Ionicons name="calendar-outline" size={18} color="#4CAF50" style={styles.featureIcon} />
                    <Text style={styles.featureText}>Eigene Events veröffentlichen (auch wiederkehrend)</Text>
                </View>
                 <View style={styles.featureItem}>
                    <Ionicons name="chatbubbles-outline" size={18} color="#2196F3" style={styles.featureIcon} />
                    <Text style={styles.featureText}>Zwei eigene Chat-Gruppen für Ankündigungen erstellen</Text>
                </View>
                 <View style={styles.featureItem}>
                    <Ionicons name="newspaper-outline" size={18} color="#FF9800" style={styles.featureIcon} />
                    <Text style={styles.featureText}>Eigene Artikel veröffentlichen</Text>
                </View>
                 <View style={styles.featureItem}>
                    <Ionicons name="map-outline" size={18} color="#E91E63" style={styles.featureIcon} />
                    <Text style={styles.featureText}>Organisation auf der Karte eintragen</Text>
                </View>
                 <View style={styles.featureItem}>
                    <Ionicons name="share-social-outline" size={18} color="#9C27B0" style={styles.featureIcon} />
                    <Text style={styles.featureText}>Invite-Code für Mitglieder und Mitarbeiter erhalten</Text>
                </View>
            </View>
            
            <Text style={styles.priceText}>Nur 3,99 € pro Woche</Text>
            
             <TouchableOpacity 
                style={[styles.button, styles.actionButtonPaywall]} 
                onPress={() => setMode('create')} // Go to create form (payment logic TBD)
            >
                <Ionicons name="add-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Organisation kostenpflichtig erstellen</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={[styles.button, styles.voucherButton]} 
                onPress={() => { setVoucherCode(''); setVoucherError(''); setShowVoucherModal(true); }} // Open voucher modal
            >
                 <Ionicons name="ticket-outline" size={20} color="#4285F4" style={styles.buttonIcon} />
                 <Text style={styles.voucherButtonText}>Gutschein-Code eingeben</Text>
            </TouchableOpacity>
        </View>
        
        {/* Separator */}
        <View style={styles.separatorContainer}>
            <View style={styles.separatorLine} />
            <Text style={styles.orText}>oder</Text>
            <View style={styles.separatorLine} />
        </View>

        {/* Join Existing Organization Button (Less Prominent) */}
        <TouchableOpacity style={[styles.button, styles.joinButton]} onPress={() => { setMode('join'); setError(''); }}>
           <Ionicons name="log-in-outline" size={22} color="#34A853" style={styles.buttonIcon} />
          <Text style={styles.joinButtonText}>Bestehender Organisation beitreten</Text>
        </TouchableOpacity>
    </View>
  );

   const renderVoucherModal = () => (
    <Modal
      visible={showVoucherModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowVoucherModal(false)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Gutschein einlösen</Text>
            <Text style={styles.modalSubtitle}>Gib deinen Gutschein-Code ein, um eine Organisation kostenlos zu erstellen.</Text>
            
            <TextInput
              style={styles.inputModal}
              placeholder="Gutschein-Code"
              value={voucherCode}
              onChangeText={setVoucherCode}
              autoCapitalize="characters" // Often codes are uppercase
              autoCorrect={false}
            />
            
            {voucherError ? <Text style={styles.errorTextModal}>{voucherError}</Text> : null}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowVoucherModal(false)}
                disabled={isVoucherLoading}
              >
                <Text style={styles.modalButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, isVoucherLoading && styles.buttonDisabled]} 
                onPress={handleValidateVoucher}
                disabled={isVoucherLoading}
              >
                {isVoucherLoading ? 
                   <ActivityIndicator color="#fff" size="small" /> : 
                   <Text style={styles.modalButtonText}>Einlösen</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderContent = () => {
    switch (mode) {
      case 'create':
        return renderCreateForm();
      case 'join':
        return renderJoinForm();
      case 'select':
      default:
        return renderSelectionMode();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => { 
                // setPurchaseError(null); // Temporarily commented out to test navigation
                navigation.goBack();
           }} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          <Text style={styles.title}>Organisation verwalten</Text>
          <View style={{ width: 24 }} />{/* Spacer */}
        </View>
        {/* Subtitle is now less prominent or removed */}
        {/* <Text style={styles.subtitle}>
          Erstelle eine neue Organisation (Verein, Gemeinde, Unternehmen) oder trete einer bestehenden mittels Einladungscode bei.
        </Text> */}
        {renderContent()}
        {renderVoucherModal()} 
      </ScrollView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Light gray background
  },
   scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50, // Adjust top padding as needed
    alignItems: 'center',
  },
   header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20, // Increased margin
  },
   backButton: {
     padding: 5, // Easier tap target
  },
  title: {
    fontSize: 20, // Slightly smaller title
    fontWeight: '600', // Medium weight
    color: '#333',
    textAlign: 'center',
    flex: 1, // Allow title to take space
  },
  subtitle: { // Style for subtitle if kept
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    paddingHorizontal: 15,
  },
  selectionContainer: {
    width: '100%',
    alignItems: 'center',
  },
   formContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 20, // Add margin to push form down slightly
  },
  // --- Paywall Card Styles ---
  paywallCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#eee'
  },
  paywallTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
      textAlign: 'center',
      marginBottom: 5,
  },
  paywallSubtitle: {
      fontSize: 14,
      color: '#555',
      textAlign: 'center',
      marginBottom: 20,
  },
  featureList: {
      marginBottom: 20,
      alignItems: 'flex-start', // Align items to the start
  },
  featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
  },
  featureIcon: {
      marginRight: 10,
  },
  featureText: {
      fontSize: 14,
      color: '#444',
      flexShrink: 1, // Allow text to wrap
  },
  priceText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#007BFF', // Primary color for price
      textAlign: 'center',
      marginBottom: 15,
      minHeight: 20, // Reserve space while loading price
  },
   actionButtonPaywall: {
     backgroundColor: '#007BFF', // Primary action color
     marginBottom: 10, // Space before voucher button
  },
   voucherButton: {
      backgroundColor: '#fff', // White background
      borderWidth: 1,
      borderColor: '#ccc', // Neutral border
   },
   voucherButtonText: {
      color: '#4285F4', // Link color
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginLeft: 10,
   },
   // --- Join Button (Less Prominent) ---
   joinButton: {
      backgroundColor: '#f0f0f0', // Lighter gray background
      borderWidth: 1,
      borderColor: '#ddd',
      shadowOpacity: 0.05, // Less shadow
      elevation: 1,
   },
   joinButtonText: {
      color: '#34A853', // Keep green color for association
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginLeft: 10,
   },
   // --- Separator ---
   separatorContainer: {
       flexDirection: 'row',
       alignItems: 'center',
       width: '80%',
       marginVertical: 20,
   },
   separatorLine: {
       flex: 1,
       height: 1,
       backgroundColor: '#ddd',
   },
   orText: {
    marginHorizontal: 10, // Keep margin
    color: '#888',
    fontSize: 14,
  },
  // --- General Button Styles ---
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14, // Slightly adjusted padding
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    // maxWidth: 350, // Removed max width for card layout
    marginVertical: 5, // Reduced vertical margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6, // Make disabled more apparent
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 8, // Add margin if icon exists
  },
   buttonIcon: {
    marginRight: 5, // Adjust icon spacing
  },
  // --- Form Styles ---
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc', // Slightly darker border
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  backLink: {
    marginTop: 20, // Adjusted margin
    color: '#007BFF', // Use primary color
    fontSize: 15,
    fontWeight: '600',
  },
   // --- Modal Styles (Adapted from ProfileScreen) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
   modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
   inputModal: { // Specific style for modal input
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    width: '100%', // Ensure full width within modal
  },
  errorTextModal: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    marginTop: -5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Space out buttons
    marginTop: 20,
  },
  modalButton: {
    flex: 1, // Make buttons share space
    paddingVertical: 12,
    borderRadius: 8, // Match main button radius
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6c757d', // Gray for cancel
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#007BFF', // Primary blue for save/action
    borderWidth: 1,
    borderColor: '#007BFF',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Style for the Join action button to differentiate if needed
  actionButtonJoin: {
      backgroundColor: '#28a745', // Green color for joining
  },
  // --- Payment Section in Create Form ---
  paymentSection: {
      width: '100%',
      alignItems: 'center',
      marginVertical: 10, // Add some vertical spacing
  },
});

export default OrganizationSetupScreen; 