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
  Modal, // Added Modal
  Platform, // Added Platform
  Linking // Added Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext'; // To switch context after success
import { supabase } from '../lib/supabase'; // Import supabase client
import Purchases, { PurchasesOffering, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants'; // Import Constants

// TODO: Configure Purchases SDK with your API key, typically in App.js
// Purchases.configure({ apiKey: "YOUR_REVENUECAT_API_KEY" });
// Purchases.setLogLevel(LOG_LEVEL.DEBUG); // Optional: For debugging

// --- Determine if iOS IAP is enabled via environment variable ---
const isIosIapEnabled = Constants.expoConfig?.extra?.enableIosIap === true;

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
  
  const { createOrganization, joinOrganizationByInviteCode, user, profile } = useAuth();
  const { switchOrganizationContext } = useOrganization();

  // --- RevenueCat State ---
  const [offerings, setOfferings] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isFetchingOfferings, setIsFetchingOfferings] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null); // Use null consistently
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false); // New state
  const [isRestoring, setIsRestoring] = useState(false); // State for restore loading

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

  // --- Listen for changes after code redemption ---
  useEffect(() => {
    const unsubscribe = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      console.log('CustomerInfo updated after code redemption:', customerInfo);
      // Optionally handle entitlement activation or UI update here
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // --- Fetch RevenueCat Offerings OR Check Entitlement ---
  useEffect(() => {
    // Define the entitlement ID locally
    const requiredEntitlement = 'organization_admin'; 

    const checkEntitlementAndFetchOfferings = async () => {
      if (mode === 'create' && !voucherCode) { // Only run in create mode without voucher
          setIsFetchingOfferings(true); // Use this state for initial check too
          setPurchaseError(null);
          setHasActiveSubscription(false); // Reset entitlement state
          setOfferings(null); // Reset offerings
          setSelectedPackage(null); // Reset package

          try {
              // 1. Check for existing active entitlement first
              console.log('[RevenueCat Check] Fetching customer info to check for active subscription...');
              const customerInfo = await Purchases.getCustomerInfo();
              console.log('[RevenueCat Check] Fetched customer info:', JSON.stringify(customerInfo.entitlements, null, 2));

              if (customerInfo.entitlements?.active?.[requiredEntitlement]) {
                  console.log(`[RevenueCat Check] Active entitlement '${requiredEntitlement}' found. Skipping purchase flow.`);
                  setHasActiveSubscription(true);
                  setIsFetchingOfferings(false); // No need to fetch offerings
                  return; // Exit early
              } else {
                  console.log(`[RevenueCat Check] Active entitlement '${requiredEntitlement}' not found. Proceeding to fetch offerings.`);
                  setHasActiveSubscription(false);
              }

              // 2. If no active entitlement, fetch offerings
              const fetchedOfferings = await Purchases.getOfferings();
              if (fetchedOfferings.current !== null && fetchedOfferings.current.availablePackages.length > 0) {
                  setOfferings(fetchedOfferings.current);
                  console.log('[RevenueCat] Available packages identifiers:', fetchedOfferings.current.availablePackages.map(pkg => pkg.identifier));
                  
                  // Use static weekly subscription package identifier
                  const targetPackageId = '$rc_weekly'; // KEEP this identifier
                  console.log('[RevenueCat] Selecting package with identifier:', targetPackageId);
                  const targetPackage = fetchedOfferings.current.availablePackages.find(
                      pkg => pkg.identifier === targetPackageId
                  );

                  if (targetPackage) {
                      setSelectedPackage(targetPackage);
                  } else {
                      setPurchaseError("Das benötigte Abo-Paket wurde nicht gefunden.");
                      console.error(`Could not find package with ID: ${targetPackageId} in current offering.`);
                  }
              } else {
                  setPurchaseError("Keine Kaufoptionen verfügbar.");
              }
          } catch (e) {
              console.error("Error checking entitlement or fetching offerings:", JSON.stringify(e, null, 2));
              if (e.code) console.error("RevenueCat Error Code:", e.code);
              if (e.message) console.error("RevenueCat Error Message:", e.message);
              if (e.underlyingErrorMessage) console.error("RevenueCat Underlying Error:", e.underlyingErrorMessage);
              setPurchaseError("Fehler beim Laden der Abo-Informationen.");
              // Consider a more specific alert if entitlement check fails vs offering fetch
              Alert.alert("Fehler", "Abo-Informationen konnten nicht geladen werden.");
          } finally {
              setIsFetchingOfferings(false);
          }
      } else {
          // Clear states if not in create mode or if using voucher
          setHasActiveSubscription(false);
          setOfferings(null);
          setSelectedPackage(null);
      }
    };

    checkEntitlementAndFetchOfferings();
  }, [mode, voucherCode]); // Re-run if mode or voucherCode changes

  // --- Restore Purchases Handler ---
  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setError(''); // Clear previous errors
    setPurchaseError(null);

    try {
        console.log('[Restore] Attempting to restore purchases...');
        const customerInfo = await Purchases.restorePurchases();
        console.log('[Restore] Restore completed. Customer Info:', JSON.stringify(customerInfo, null, 2));

        const requiredEntitlement = 'organization_admin';

        // Check if the entitlement is now active after restoring
        if (customerInfo.entitlements?.active?.[requiredEntitlement]) {
            console.log(`[Restore] Entitlement '${requiredEntitlement}' found after restore.`);
            Alert.alert('Erfolg', 'Deine früheren Käufe wurden erfolgreich wiederhergestellt.');
            // Update state to reflect active subscription which triggers UI update
            setHasActiveSubscription(true);
             // If the user is on the selection screen, switch to create mode automatically
            if (mode === 'select') {
                setMode('create');
            }
        } else {
            console.log(`[Restore] Entitlement '${requiredEntitlement}' not found after restore.`);
            Alert.alert('Keine Käufe gefunden', 'Es wurden keine aktiven Abonnements zum Wiederherstellen für dieses Konto gefunden.');
        }

    } catch (e) {
        console.error('[Restore] Error restoring purchases:', JSON.stringify(e, null, 2));
        Alert.alert('Fehler', 'Beim Wiederherstellen der Käufe ist ein Fehler aufgetreten. Bitte versuche es später erneut.');
        // Set error state if needed, e.g., setPurchaseError(...)
    } finally {
        setIsRestoring(false);
    }
  };

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

  // --- New Handler for Creating Org with Active Subscription ---
  const handleCreateWithActiveSubscription = async () => {
    if (!orgName.trim() || orgName.trim().length < 3) {
        setError('Organisationsname muss mind. 3 Zeichen lang sein.');
        return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setError('');

    try {
        // Directly create the organization as the user already has the entitlement
        console.log('[handleCreateWithActiveSubscription] User has active subscription. Creating organization...');
        const result = await createOrganization(orgName.trim());

        if (result.success) {
            Alert.alert('Erfolg', `Organisation "${result.data.name}" wurde erstellt! Dein Abo ist bereits aktiv.`);
            navigation.goBack(); // Go back to profile screen
        } else {
            // Handle organization creation failure even with active subscription
            console.error(`ERROR: Active subscription found, but org creation failed for user ${user?.id}:`, result.error);
            setError(String(result.error?.message || 'Organisation konnte trotz aktivem Abo nicht erstellt werden. Bitte versuche es erneut oder kontaktiere den Support.'));
            // Keep user on this screen to see the error
        }
    } catch (err) {
        console.error("Unexpected error during creation with active subscription:", err);
        setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
        setIsLoading(false);
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
        console.log('[handlePurchaseAndCreate] Attempting purchase with package:', JSON.stringify(selectedPackage, null, 2));
        const purchaseResult = await Purchases.purchasePackage(selectedPackage);
        console.log('[handlePurchaseAndCreate] Purchase attempt finished. Result:', JSON.stringify(purchaseResult, null, 2));

        // DEBUG: log entitlement state after purchase
        console.log('[handlePurchaseAndCreate] customerInfo.entitlements after purchase:', purchaseResult.customerInfo?.entitlements);

        // --- Add check for valid result before destructuring ---
        if (!purchaseResult || typeof purchaseResult !== 'object') {
            console.error("Invalid response from purchasePackage:", purchaseResult);
            throw new Error("Ungültige Antwort vom Kaufvorgang."); 
        }
        // --- End Add check ---

        const { customerInfo, productIdentifier } = purchaseResult;
        // DEBUG: log all entitlements objects
        console.log('[handlePurchaseAndCreate] Full entitlements object:', JSON.stringify(customerInfo.entitlements, null, 2));
        // DEBUG: log active entitlement keys
        console.log('[handlePurchaseAndCreate] Active entitlement identifiers:', Object.keys(customerInfo.entitlements.active || {}));

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
                console.log('[handlePurchaseAndCreate] Org creation failed after payment.');
            }
        } else {
            // Entitlement missing: attempt to sync and refetch customer info before erroring
            console.warn(`[handlePurchaseAndCreate] Entitlement '${requiredEntitlement}' missing, syncing purchases and fetching updated customer info.`);
            try {
                await Purchases.syncPurchases();
                const refreshedInfo = await Purchases.getCustomerInfo();
                if (refreshedInfo.entitlements.active?.[requiredEntitlement]) {
                    console.log('[handlePurchaseAndCreate] Entitlement found after refresh. Proceeding to create organization.');
                    const resultAfterRefresh = await createOrganization(orgName.trim());
                    if (resultAfterRefresh.success) {
                        Alert.alert('Erfolg', `Organisation "${resultAfterRefresh.data.name}" wurde erstellt und dein Abo ist aktiv!`);
                        navigation.goBack();
                    } else {
                        console.error(`CRITICAL: Payment successful but org creation failed after entitlement refresh for user ${user?.id}:`, resultAfterRefresh.error);
                        setError(String(resultAfterRefresh.error?.message || 'Dein Abo ist aktiv, aber die Organisation konnte nicht erstellt werden. Bitte kontaktiere den Support.'));
                    }
                    // DEBUG: log refreshed entitlements
                    console.log('[handlePurchaseAndCreate] Refreshed full entitlements object:', JSON.stringify(refreshedInfo.entitlements, null, 2));
                    console.log('[handlePurchaseAndCreate] Refreshed active entitlement identifiers:', Object.keys(refreshedInfo.entitlements.active || {}));
                } else {
                    throw new Error('Entitlement not found after refresh');
                }
            } catch (refreshError) {
                console.error('[handlePurchaseAndCreate] Entitlement refresh failed:', refreshError);
                setError('Kauf erfolgreich, aber Berechtigung konnte nicht überprüft werden. Bitte kontaktiere den Support.');
            }
            return; // Exit early after refresh attempt
        }

    } catch (e) {
        console.error("[handlePurchaseAndCreate] Purchase Error Caught:", JSON.stringify(e, null, 2));
        if (!e.userCancelled) {
            setError('Kauf fehlgeschlagen. Bitte versuche es erneut.');
            Alert.alert('Kauf fehlgeschlagen', e.message);
        } else {
            setError('Kauf abgebrochen.'); // Optional: inform user about cancellation
            console.log('[handlePurchaseAndCreate] Purchase cancelled by user.');
        }
    } finally {
        console.log('[handlePurchaseAndCreate] Entering finally block.');
        setIsLoading(false);
        console.log('[handlePurchaseAndCreate] setIsLoading(false) executed.');
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

  // Redeem Apple Offer Code or open voucher modal
  const handleRedeemOfferCode = async () => {
    if (Platform.OS === 'ios') {
      try {
        await Purchases.presentCodeRedemptionSheet();
        await Purchases.syncPurchases();
      } catch (e) {
        console.warn('Code-Einlösung fehlgeschlagen', e);
        // Fallback: open Redeem sheet in App Store app
        const appStoreId = Constants.expoConfig?.ios?.appStoreId || 'APP_ID';
        const url = `https://apps.apple.com/redeem?ctx=offercodes&id=${appStoreId}`;
        Linking.openURL(url);
        try { await Purchases.syncPurchases(); } catch {};
      }
    } else {
      setVoucherCode('');
      setVoucherError('');
      setShowVoucherModal(true);
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
        // --- Conditional Rendering based on Active Subscription ---
        <View style={styles.paymentSection}>
            {isFetchingOfferings ? ( // Show loading indicator during initial check/fetch
                <ActivityIndicator size="large" color="#007BFF" />
            ) : hasActiveSubscription ? (
                // User has active subscription - show different button
                <>
                   <Text style={styles.activeSubText}>Aktives Abo erkannt</Text>
                   <TouchableOpacity 
                      style={[styles.button, styles.actionButtonPrimary, isLoading && styles.buttonDisabled]} 
                      onPress={handleCreateWithActiveSubscription} // Use new handler
                      disabled={isLoading}
                   >
                      {isLoading ? <ActivityIndicator color="#fff" /> : 
                          <Text style={styles.buttonText}>
                              Organisation erstellen
                          </Text>
                      }
                   </TouchableOpacity>
                </>
            ) : selectedPackage ? (
                // User needs to purchase - show purchase button
                <TouchableOpacity 
                   style={[styles.button, styles.actionButtonPaywall, isLoading && styles.buttonDisabled]} 
                   onPress={handlePurchaseAndCreate} // Original handler
                   disabled={isLoading} 
                >
                   {isLoading ? <ActivityIndicator color="#fff" /> : 
                       <Text style={styles.buttonText}>
                           {`Erstellen (3,99€/Woche)`} 
                       </Text>
                   }
                </TouchableOpacity>
            ) : (
                // No subscription, no package found (Error case)
                <Text style={styles.errorText}>{purchaseError || "Keine Kaufoptionen verfügbar."}</Text>
            )}
            {/* Show specific purchase/loading errors if they occurred and not loading */}
            {(purchaseError && !isFetchingOfferings && !hasActiveSubscription) && ( 
               <Text style={[styles.errorText, { marginTop: 5 }]}>{purchaseError}</Text>
            )}
        </View>
      )}

      {/* Legal Links */}
      <View style={styles.legalLinksContainer}>
        <Text style={styles.legalLinksTitle}>Rechtliches</Text>
        <TouchableOpacity style={styles.legalLinkItem} onPress={() => Linking.openURL('https://mylocalapp.de/agb')}>
          <Text style={styles.legalLinkText}>AGB / Terms of Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.legalLinkItem} onPress={() => Linking.openURL('https://mylocalapp.de/datenschutz')}>
          <Text style={styles.legalLinkText}>Datenschutz / Privacy Policy</Text>
        </TouchableOpacity>
      </View>

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
            
            {/* Conditional Price Text */}
            {Platform.OS === 'ios' && !isIosIapEnabled ? (
              <Text style={[styles.priceText, styles.iosVoucherOnlyText]}>
                Auf iOS aktuell nur per Gutschein möglich
              </Text>
            ) : (
              <Text style={styles.priceText}>Nur 3,99 € pro Woche</Text>
            )}
            
             <TouchableOpacity 
                style={[styles.button, styles.actionButtonPaywall]} 
                // Conditional onPress for iOS when IAP is disabled
                onPress={() => {
                    if (Platform.OS === 'ios' && !isIosIapEnabled) {
                        Alert.alert(
                            'Hinweis', 
                            'Aktuell ist dies auf iOS noch nicht möglich - Bitte gucke auf unsere Webseite für mehr Informationen',
                            [{ text: 'OK' }]
                        );
                    } else {
                        setMode('create'); // Normal behavior: Go to create form
                    }
                }}
            >
                <Ionicons name="add-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Organisation kostenpflichtig erstellen</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={[styles.button, styles.voucherButton]} 
                // Conditional onPress for iOS when IAP is disabled
                onPress={() => {
                    if (Platform.OS === 'ios' && !isIosIapEnabled) {
                        setVoucherCode('');
                        setVoucherError('');
                        setShowVoucherModal(true); // Open DB voucher modal directly
                    } else {
                        handleRedeemOfferCode(); // Normal behavior (Apple sheet on iOS, modal elsewhere)
                    }
                }}
            >
                 <Ionicons name="ticket-outline" size={20} color="#4285F4" style={styles.buttonIcon} />
                 <Text style={styles.voucherButtonText}>Gutschein-Code eingeben</Text>
            </TouchableOpacity>

            {/* Inline row: Conditionally show Restore & Manage Buttons */}
            {/* Only show if NOT (iOS AND IAP disabled) */}
            {!(Platform.OS === 'ios' && !isIosIapEnabled) && (
              <View style={styles.inlineButtons}>
                {/* Restore Purchases */}
                <TouchableOpacity 
                  style={[styles.button, styles.inlineButton, styles.restoreButton, isRestoring && styles.buttonDisabled]} 
                  onPress={handleRestorePurchases} 
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <ActivityIndicator color="#007BFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={12} color="#0056b3" style={styles.buttonIcon} />
                      <Text style={[styles.restoreButtonText, styles.inlineButtonText]}>Kauf wiederherstellen</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Manage Subscription */}
                {Platform.OS === 'ios' && ( // Keep this check as Manage Subscriptions is iOS-only via Purchases SDK
                  <TouchableOpacity
                    style={[styles.button, styles.inlineButton, styles.devButton]}
                    onPress={async () => {
                      try { await Purchases.showManageSubscriptions(); }
                      catch { Alert.alert('Fehler', 'Abonnements konnten nicht verwaltet werden.'); }
                    }}
                  >
                    <Ionicons name="cog-outline" size={12} color="#ffc107" style={styles.buttonIcon} />
                    <Text style={[styles.devButtonText]}>Abonnement verwalten</Text>
                  </TouchableOpacity>
                )}
                 {/* Add a placeholder on Android/Web if needed to maintain spacing, or adjust justifyContent */}
                {Platform.OS !== 'ios' && <View style={{flex: 1}} /> /* Placeholder for spacing */}
              </View>
            )}
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

  // New: render for temporary accounts only
  const renderTemporaryBlocked = () => (
    <View style={styles.tempContainer}>
      <Text style={styles.tempErrorMessage}>Temporäre Konten können keine Organisation erstellen.</Text>
      <TouchableOpacity style={styles.tempBackButton} onPress={() => navigation.goBack()}>
        <Text style={styles.tempBackButtonText}>Zurück</Text>
      </TouchableOpacity>
    </View>
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
           <TouchableOpacity 
              onPress={() => { 
                   setIsLoading(false); // Reset loading state on back press
                   setPurchaseError(null);
                   setError('');
                   // Potentially reset mode as well if purchase was hanging?
                   // setMode('select'); 
                   navigation.goBack();
               }} 
              style={styles.backButton}
           >
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          <Text style={styles.title}>Organisation verwalten</Text>
          <View style={{ width: 24 }} />{/* Spacer */}
        </View>
        {/* check for temporary account */}
        {profile?.is_temporary ? (
          renderTemporaryBlocked()
        ) : (
          <>  
            {renderContent()}
            {renderVoucherModal()}
          </>
        )}
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
  // Style for the button when subscription is active
  actionButtonPrimary: {
     backgroundColor: '#007BFF', // Or another primary color like green '#28a745'
  },
  // Style for text indicating active subscription
  activeSubText: {
     fontSize: 16,
     fontWeight: '600',
     color: '#28a745', // Green color for success/active status
     textAlign: 'center',
     marginBottom: 15,
  },
  // --- Legal Links Styles ---
  legalLinksContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  legalLinksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  legalLinkItem: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  legalLinkText: {
    color: '#007BFF',
    fontSize: 14,
  },
  // temporary account block styles
  tempContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  tempErrorMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
  },
  tempBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    backgroundColor: '#007BFF',
    borderRadius: 8,
  },
  tempBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Restore Purchases Button
  restoreButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: '#ddd',
    shadowOpacity: 0.05,
    elevation: 5,
    marginTop: 10,
    marginBottom: 10,
  },
  restoreButtonText: {
    color: '#0056b3',
    fontSize: 11,
    fontWeight: '600',
  },
  // --- Dev Only Button ---
  devButton: {
    backgroundColor: '#444', // Dark background for dev button
    borderColor: '#666',
    borderWidth: 1,
    marginTop: 5, // Space above
  },
  devButtonText: {
    color: '#ffc107', // Warning yellow color
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  // --- Inline Button Styles ---
  inlineButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
  },
  inlineButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#007BFF',
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007BFF',
    textAlign: 'center',
  },
  inlineButtonIcon: {
    marginRight: 5,
    color: '#007BFF',
  },
  // Style for iOS voucher only text
  iosVoucherOnlyText: {
    color: '#6c757d', // Use a more neutral color like gray
    fontWeight: 'normal', // Less emphasis than price
  },
});

export default OrganizationSetupScreen; 