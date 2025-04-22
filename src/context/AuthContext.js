import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

// Create auth context
const AuthContext = createContext();

// Function to generate a random password (simple example)
const generateRandomPassword = (length = 12) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  return password;
};

// Auth provider component
export const AuthProvider = ({ children, expoPushToken }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null); // Supabase Auth user object
  const [profile, setProfile] = useState(null); // Public profile data (includes is_temporary, avatar_url)
  const [preferences, setPreferences] = useState([]); // Local/Profile preferences
  const [displayName, setDisplayName] = useState(''); // Local/Profile display name
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [userOrganizations, setUserOrganizations] = useState([]); // NEW: Store user's org memberships
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true); // Separate loading for profile/orgs
  const [loadingAuth, setLoadingAuth] = useState(true); // Separate loading for auth state
  const [loadingProfilePicture, setLoadingProfilePicture] = useState(false);

  // --- Push Token Registration Logic ---
  const registerOrUpdatePushToken = useCallback(async (token, userId) => {
    if (!token) {
      console.log("AuthContext: [PushToken] No push token provided, skipping registration.");
      return;
    }

    console.log(`AuthContext: [PushToken] Attempting registration. Token: ${token}, UserID: ${userId === null ? 'null (anonymous)' : userId}`);

    const upsertData = [{ expo_push_token: token, user_id: userId }];
    console.log(`AuthContext: [PushToken] Data prepared for upsert:`, JSON.stringify(upsertData));

    try {
      // Upsert token, minimal returning. Remove select to avoid RLS return issues.
      const { data, error } = await supabase
        .from('push_tokens')
        .upsert(
          upsertData,
          { onConflict: 'expo_push_token', returning: 'minimal' }
        );

      if (error) {
        console.error(`AuthContext: [PushToken] Error upserting token. UserID: ${userId === null ? 'null' : userId}. Error:`, JSON.stringify(error, null, 2));
      } else {
        console.log(`AuthContext: [PushToken] Successfully upserted token. UserID: ${userId === null ? 'null' : userId}. Result data (minimal):`, data);
      }
    } catch (e) {
      console.error(`AuthContext: [PushToken] Unexpected error during push token upsert. UserID: ${userId === null ? 'null' : userId}. Error:`, e);
    }
  }, []); // useCallback dependencies are empty as supabase client is stable

  // Effect to register token when token or user changes
  useEffect(() => {
    if (expoPushToken) { // Only run if the token is available
      // Register based on the *current* user state
      registerOrUpdatePushToken(expoPushToken, user?.id ?? null);
    }
    // Dependency array: This effect runs when expoPushToken becomes available
    // or when the user object (specifically user?.id) changes.
  }, [expoPushToken, user, registerOrUpdatePushToken]);

  // --- Session Management --- (Ensure this useEffect also depends on registerOrUpdatePushToken)
  useEffect(() => {
    const fetchSession = async () => {
      setLoadingAuth(true);
      try {
        // Check Supabase session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log("AuthContext: Initial session fetch:", currentSession ? `Session found (User ID: ${currentSession.user.id})` : 'No session');
        const initialUser = currentSession?.user ?? null;
        setSession(currentSession);
        setUser(initialUser); // Set initial user state

        if (initialUser) {
          await loadUserProfileAndOrgs(initialUser.id); // Load profile/orgs including is_temporary
          // Set onboarding complete if a session exists? Depends on final flow.
          const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
          setHasCompletedOnboarding(onboardingStatus === 'true');

          // Token registration handled by useEffect
        } else {
          setLoadingProfile(false); // No user, profile loading done
          setHasCompletedOnboarding(false); // No user, not onboarded
          // If no initial user, ensure token is registered as anonymous
          if (expoPushToken) {
            registerOrUpdatePushToken(expoPushToken, null);
          }
        }

      } catch (error) {
        console.error("AuthContext: Error fetching initial session or local data:", error);
        setLoadingProfile(false); // Ensure loading stops on error
      } finally {
        setLoadingAuth(false);
      }
    };

    fetchSession();

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setLoadingAuth(true); // Indicate auth state change processing
        console.log(`AuthContext: Auth state changed event: ${_event}`, newSession ? `Session User: ${newSession.user.id}` : 'No session');

        const newSupabaseUser = newSession?.user ?? null;
        const previousSupabaseUserId = user?.id ?? null; // Get ID from current state `user`
        const userIdChanged = newSupabaseUser?.id !== previousSupabaseUserId;

        console.log(`AuthContext: User ID check - Prev: ${previousSupabaseUserId}, New: ${newSupabaseUser?.id}, Changed: ${userIdChanged}`);

        // Update session state regardless of event type
        setSession(newSession);

        // Update user state *only* if the user ID has actually changed
        if (userIdChanged) {
          console.log('AuthContext: Updating user context state object due to ID change.');
          setUser(newSupabaseUser); // This state change will trigger the token registration useEffect
        } else {
          console.log('AuthContext: Skipping user context state object update (ID unchanged).');
          // If user didn't change, but an event happened (like TOKEN_REFRESHED),
          // ensure profile loading stops if it was triggered.
          if (!newSupabaseUser) setLoadingProfile(false); // No user exists after event
        }

        // --- Handle specific event logic AFTER updating user state (if changed) ---
        // Loading profile/orgs and managing onboarding status
        switch (_event) {
            case 'SIGNED_IN':
            case 'INITIAL_SESSION': // Treat initial session like sign in if user exists
                if (newSupabaseUser) {
                    console.log(`AuthContext: ${_event} event - Loading profile/orgs for user:`, newSupabaseUser.id);
                    await loadUserProfileAndOrgs(newSupabaseUser.id);
                    // Setting onboarding based on whether a profile exists maybe? Or keep asyncstorage?
                    // For now, keep AsyncStorage check, set during onboarding/signin
                    const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
                    setHasCompletedOnboarding(onboardingStatus === 'true');

                } else {
                    console.log('AuthContext: INITIAL_SESSION with no user.');
                    setProfile(null);
                    setUserOrganizations([]);
                    setHasCompletedOnboarding(false);
                    setLoadingProfile(false);
                    // Token registration for anonymous user handled by useEffect watching `user`
                }
                break;

            case 'SIGNED_OUT':
                console.log('AuthContext: SIGNED_OUT event.');
                // User state is set to null via setUser(newSupabaseUser) when ID changes.
                // The signOut function handles clearing local storage.
                setProfile(null);
                setUserOrganizations([]);
                setHasCompletedOnboarding(false); // Reset onboarding on sign out
                setLoadingProfile(false);
                // Token registration for anonymous user handled by useEffect watching `user`
                break;

            // Other cases (TOKEN_REFRESHED, USER_UPDATED, etc.) don't typically require profile/org reload
            // unless user ID changes, which is handled above.
            // Ensure loading state is managed.
            default:
                console.log(`AuthContext: Auth event: ${_event} - user ID unchanged or handled. Profile Loading: ${loadingProfile}`);
                 if (!newSupabaseUser) {
                    // If event resulted in no user, ensure profile loading stops.
                    setLoadingProfile(false);
                 } else if (!userIdChanged) {
                    // If user ID didn't change, stop profile loading if it hasn't already.
                    // Maybe reload profile on USER_UPDATED?
                    if(_event === 'USER_UPDATED') {
                        console.log("AuthContext: USER_UPDATED event, reloading profile/orgs.");
                        await loadUserProfileAndOrgs(newSupabaseUser.id);
                    } else {
                    setLoadingProfile(false);
                    }
                 } // Otherwise, profile loading is managed by loadUserProfileAndOrgs
        }

        setLoadingAuth(false); // Auth state processing finished for this event
      }
    );

    // Cleanup listener on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, [expoPushToken, registerOrUpdatePushToken]); // Simplified dependencies

  // ... (keep loading useEffect as is)
  useEffect(() => {
    const isLoading = loadingAuth || (!loadingAuth && !!user && loadingProfile);
    setLoading(isLoading);
  }, [loadingAuth, loadingProfile, user]);

  // --- Profile & Organization Loading ---
  const loadUserProfileAndOrgs = async (userId) => {
    const callTimestamp = Date.now();
    console.log(`AuthContext: [${callTimestamp}] START loadUserProfileAndOrgs for user ID:`, userId);

    if (!userId) {
      console.log(`AuthContext: [${callTimestamp}] loadUserProfileAndOrgs - No userId provided. Clearing profile/orgs.`);
      setProfile(null);
      setUserOrganizations([]);
      setLoadingProfile(false);
      console.log(`AuthContext: [${callTimestamp}] END loadUserProfileAndOrgs (no user ID).`);
      return;
    }
    console.log(`AuthContext: [${callTimestamp}] loadUserProfileAndOrgs - Setting loadingProfile true for user ID:`, userId);
    setLoadingProfile(true);
    try {
      // Fetch profile and organizations concurrently
      const [profileResult, orgsResult] = await Promise.all([
        supabase
          .from('profiles')
          // Fetch avatar_url along with other profile data
          .select(`display_name, preferences, updated_at, is_temporary, avatar_url, about_me`)
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('organizations')
          .select(`
            id,
            name,
            logo_url,
            organization_members!inner ( role )
          `)
          .eq('organization_members.user_id', userId)
      ]);

      // Handle profile result
      if (profileResult.error && profileResult.status !== 406) {
        console.error(`AuthContext: [${callTimestamp}] Error loading user profile for ID ${userId}:`, profileResult.error);
        setProfile(null); // Clear profile state on error
        setDisplayName(''); // Clear derived state
        setPreferences([]); // Clear derived state
        // Clear local storage? Maybe not, user might log in again.
      } else if (profileResult.data) {
        console.log(`AuthContext: [${callTimestamp}] Profile loaded for ID ${userId}:`, profileResult.data);
        const loadedProfile = profileResult.data;
        // Set the entire profile object, including avatar_url
        setProfile(loadedProfile);
        // Use optional chaining and defaults when setting derived state/storage
        const displayNameToSet = loadedProfile.display_name ?? '';
        const preferencesToSet = loadedProfile.preferences ?? [];
        setDisplayName(displayNameToSet);
        setPreferences(preferencesToSet);
        // Keep storing these locally? Maybe helpful if profile load fails later.
        // await AsyncStorage.setItem('userDisplayName', displayNameToSet);
        // await AsyncStorage.setItem('userPreferences', JSON.stringify(preferencesToSet));
        // Set onboarding complete flag in storage if profile loaded successfully
        // This assumes loading profile means onboarding is done.
        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        setHasCompletedOnboarding(true);

      } else {
        console.log(`AuthContext: [${callTimestamp}] No profile found for user ID ${userId}. Clearing profile state.`);
        // If no profile found for a logged-in user, it's an issue.
        setProfile(null);
        setDisplayName('');
        setPreferences([]);
        setHasCompletedOnboarding(false); // No profile = not onboarded
        await AsyncStorage.removeItem('hasCompletedOnboarding');
        // await AsyncStorage.removeItem('userDisplayName');
        // await AsyncStorage.removeItem('userPreferences');
      }

      // Handle organizations result (keep as is)
      // ... existing org handling code ...
      if (orgsResult.error) {
        console.error(`AuthContext: [${callTimestamp}] Error loading user organizations for ID ${userId}:`, JSON.stringify(orgsResult.error, null, 2));
        setUserOrganizations([]); // Clear on error
      } else {
        const orgData = orgsResult.data || [];
        const formattedOrgs = orgData.map(org => ({
            id: org.id, // Assume id and name are non-nullable based on DB schema
            name: org.name,
            logo_url: org.logo_url,
            role: org.organization_members?.[0]?.role ?? 'member' // Safely access nested role
        }));
        console.log(`AuthContext: [${callTimestamp}] User organizations loaded successfully for ID ${userId}:`, formattedOrgs);
        setUserOrganizations(formattedOrgs);
      }

    } catch (error) {
      console.error(`AuthContext: [${callTimestamp}] Unexpected error in loadUserProfileAndOrgs for ID ${userId}:`, error);
      setProfile(null);
      setUserOrganizations([]); // Clear on error
      setHasCompletedOnboarding(false); // Ensure onboarding is false on error
      await AsyncStorage.removeItem('hasCompletedOnboarding');
    } finally {
      setLoadingProfile(false);
      console.log(`AuthContext: [${callTimestamp}] END loadUserProfileAndOrgs for ID ${userId}. loadingProfile set to false.`);
    }
  };

  // --- NEW: Temporary Account Creation ---
  const createTemporaryAccount = async (userDisplayName, userEmail = null) => {
    setLoading(true); // Use overall loading
    try {
      console.log('AuthContext: Attempting to create temporary account for:', userDisplayName);

      if (!userDisplayName || userDisplayName.trim() === '') {
        return { success: false, error: { message: 'Bitte gib einen Anzeigenamen ein.' } };
      }

      // Validate email format if provided
      if (userEmail && !userEmail.includes('@')) {
        return { success: false, error: { message: 'Bitte gib eine gültige E-Mail-Adresse ein oder lasse das Feld leer.' } };
      }

      // Generate temporary credentials
      const password = generateRandomPassword(16); // Generate a strong random password
      // Generate shorter random number instead of UUID for temp email
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // 0000-9999
      const email = userEmail ? userEmail.trim() : `${userDisplayName.trim().replace(/\s+/g, '.').toLowerCase()}.${randomSuffix}@temp.mylocalapp.de`;
      const allPreferences = ['kultur', 'sport', 'verkehr', 'politik', 'vereine', 'gemeinde']; // Pre-select all preferences

      console.log(`AuthContext: Generated credentials - Email: ${email}, Password: [REDACTED], DisplayName: ${userDisplayName}`);

      // Sign up with Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // emailRedirectTo: null, // Disable email confirmation is default now? Check Supabase settings.
          data: {
            // Pass metadata for the trigger function `handle_new_user`
            display_name: userDisplayName.trim(),
            preferences: allPreferences,
            is_temporary: true // Mark account as temporary
          }
        }
      });

      if (signUpError) {
        console.error('AuthContext: Supabase signUp error (temporary account):', signUpError);
        const message = signUpError.message.includes('User already registered')
          ? 'Diese E-Mail-Adresse wird bereits verwendet. Bitte gib eine andere ein oder logge dich ein.'
          : signUpError.message || 'Fehler bei der Registrierung.';
        return { success: false, error: { message } };
      }

      if (!signUpData.user) {
        console.error('AuthContext: SignUp successful but no user data returned (temporary account).');
        return { success: false, error: { message: 'Registrierung fehlgeschlagen, keine Benutzerdaten.' } };
      }

      const userId = signUpData.user.id;
      console.log('AuthContext: Temporary SignUp successful, user ID:', userId);

      // --- Profile Verification (Trigger should handle creation) ---
      // We rely on the trigger `handle_new_user` to create the profile entry.
      // We wait a bit and then try to load it to confirm.
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for trigger

      console.log('AuthContext: Checking if profile exists for temporary user ID:', userId);
      const { data: createdProfile, error: profileCheckError, status } = await supabase
          .from('profiles')
        .select('id, is_temporary') // Check if is_temporary was set correctly
          .eq('id', userId)
        .maybeSingle();

      if (profileCheckError && status !== 406) {
        console.error('AuthContext: Error checking profile after temporary signup:', profileCheckError);
        // Log the error but proceed, hoping the state change listener fixes it.
      }

      if (createdProfile && createdProfile.is_temporary === true) {
        console.log('AuthContext: Temporary profile confirmed.', createdProfile);
        // The onAuthStateChange listener will handle setting state and loading profile/orgs.
        // Mark onboarding complete in local storage here
        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        setHasCompletedOnboarding(true); // Update local state immediately
        return { success: true, data: { user: signUpData.user } };
        } else {
        console.error('AuthContext: Temporary profile verification failed or is_temporary not set correctly.', createdProfile);
        // If profile wasn't created or flag isn't set, it's an issue.
        // Try manual profile creation as fallback? Might be complex due to trigger race conditions.
        // For now, return failure.
        return { success: false, error: { message: 'Fehler bei der Accounterstellung (Profil nicht gefunden oder nicht temporär markiert).' } };
      }

    } catch (error) {
      console.error('AuthContext: Unexpected error in createTemporaryAccount:', error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoading(false);
    }
  };

  // --- Account Creation / Upgrade ---
  // This function is now used when a TEMPORARY user wants to make their account PERMANENT
  const upgradeToFullAccount = async (email, password) => {
    setLoading(true);
    try {
      console.log('AuthContext: Attempting to upgrade temporary account to full account:', email);

      if (!user) {
        return { success: false, error: { message: 'Kein temporärer Benutzer angemeldet.' } };
      }
      if (!profile || !profile.is_temporary) {
         return { success: false, error: { message: 'Dieser Account ist bereits permanent.' } };
      }

      // Basic validation
      if (!email || !email.includes('@') || !password || password.length < 6) {
        return {
          success: false,
          error: { message: 'Bitte gültige E-Mail und Passwort (mind. 6 Zeichen) eingeben.' }
        };
      }

      // 1. Update Supabase Auth User (email and password)
      console.log(`AuthContext: Updating Auth user ${user.id} with new email/password.`);
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        email: email.trim(),
        password: password // Update password
      });

      if (updateError) {
          console.error('AuthContext: Supabase updateUser error during upgrade:', updateError);
          const message = updateError.message.includes('email link') // Check if it's about email change requiring confirmation
            ? 'Fehler beim Aktualisieren der E-Mail. Möglicherweise ist eine Bestätigung erforderlich.'
            : updateError.message.includes('New password should be different from the old password.')
            ? 'Das neue Passwort muss sich vom alten (temporären) unterscheiden.' // Should not happen with random pw, but safety.
            : updateError.message || 'Fehler beim Aktualisieren der Benutzerdaten.';
          return { success: false, error: { message } };
      }

      console.log('AuthContext: Auth user email/password updated successfully.', updateData);

      // 2. Update Profile to set is_temporary = false
      console.log(`AuthContext: Updating profile ${user.id} to set is_temporary=false.`);
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ is_temporary: false, updated_at: new Date() })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error('AuthContext: Error updating profile during upgrade (setting is_temporary=false):', profileUpdateError);
        // Account auth updated, but profile flag failed. Critical? Maybe warn.
        return {
            success: true, // Auth part succeeded
            warning: 'Benutzerdaten aktualisiert, aber Profil konnte nicht als permanent markiert werden.',
            data: { user: updateData.user }
        };
      }

      console.log('AuthContext: Profile updated successfully (is_temporary=false).');

      // Reload profile to get the updated is_temporary state
      await loadUserProfileAndOrgs(user.id);

      // Optional: Trigger email verification if Supabase project requires it for email changes.
      // Check updateData or project settings if needed.
      // if (updateData.user.email_change_sent_at) { ... }

      return { success: true, data: { user: updateData.user } };

    } catch (error) {
      console.error('AuthContext: Unexpected error in upgradeToFullAccount:', error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoading(false);
    }
  };

  // --- Sign In / Sign Out --- (No change needed for token here, handled by useEffect)
  const signIn = async (email, password) => {
    setLoading(true);
    try {
      console.log('AuthContext: Attempting sign in:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('AuthContext: Supabase signIn error:', error);
        return { success: false, error: { message: error.message || 'Anmeldung fehlgeschlagen.' } };
      }

      if (!data.user) {
         console.error('AuthContext: SignIn successful but no user data returned.');
         return { success: false, error: { message: 'Anmeldung fehlgeschlagen, keine Benutzerdaten.' } };
      }

      console.log('AuthContext: SignIn successful, user:', data.user.id);

      // Set onboarding complete flag in storage on successful sign-in
      console.log('AuthContext: Setting onboarding complete status after sign-in.');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setHasCompletedOnboarding(true); // Update state

      // onAuthStateChange listener handles setting user state, loading profile & orgs,
      // and triggering token registration via useEffect.
      return { success: true, data: { user: data.user } };

    } catch (error) {
      console.error('AuthContext: Unexpected error during signIn:', error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoading(false);
    }
  };

  // Modify signOut to explicitly register token as anonymous AFTER sign out completes
  const signOut = async () => {
    setLoading(true);
    try {
      console.log('AuthContext: Signing out...');
      const currentToken = expoPushToken; // Capture token before state changes potentially clear it

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthContext: Supabase signOut error:', error);
        // Still attempt to clear local state and register token as anon
      }
      console.log('AuthContext: Supabase SignOut successful or attempted.');

      // Clear local data - KEEP THIS
      // Remove local storage items that are no longer used
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      // await AsyncStorage.removeItem('userPreferences'); // Keep these if useful fallback? Maybe remove.
      // await AsyncStorage.removeItem('userDisplayName');
      await AsyncStorage.removeItem('activeOrganizationId'); // Also clear active org

      // Clear Context State - KEEP THIS
      setHasCompletedOnboarding(false);
      setPreferences([]);
      setDisplayName('');
      setUserOrganizations([]); // Clear orgs state
      setUser(null); // Explicitly set user to null - triggers listener
      setProfile(null); // Clear profile state
      setSession(null); // Clear session state


      // After ensuring user state is null, update token to be anonymous
      if (currentToken) {
        console.log('AuthContext: Updating push token to anonymous after sign out.');
        await registerOrUpdatePushToken(currentToken, null);
      }
      
      console.log('AuthContext: SignOut complete, local state cleared.');
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Unexpected error during signOut:', error);
      // Attempt to clear state even on error
      setUser(null);
      setProfile(null);
      setSession(null);
      setHasCompletedOnboarding(false);
      // Maybe try registering token as anon here too?
      if (expoPushToken) {
         registerOrUpdatePushToken(expoPushToken, null);
      }
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // --- Profile Updates ---
  // Update Display Name (Applies to both temporary and full accounts)
  const updateDisplayName = async (newDisplayName) => {
    if (!user) { // Check if there is an active user session
       console.warn('AuthContext: updateDisplayName called without active user.');
       return { success: false, error: { message: 'Kein Benutzer angemeldet.' } };
    }

    if (!newDisplayName || newDisplayName.trim() === '') {
      return { success: false, error: { message: 'Benutzername darf nicht leer sein.' } };
    }

    // Update local state immediately
    const originalDisplayName = displayName; // Store original for potential revert
    setDisplayName(newDisplayName.trim());
    // await AsyncStorage.setItem('userDisplayName', newDisplayName.trim()); // Keep local storage?

    // Update DB
      try {
        console.log('AuthContext: Updating profile display name in DB for user:', user.id);
        const { error } = await supabase
          .from('profiles')
        .update({ display_name: newDisplayName.trim(), updated_at: new Date() })
          .eq('id', user.id);

        if (error) {
          console.error('AuthContext: Error updating display name in DB:', error);
        // Revert local state
        // await AsyncStorage.setItem('userDisplayName', originalDisplayName);
        setDisplayName(originalDisplayName);
          return {
          success: false,
          error: { message: 'Fehler beim Speichern des Namens in der Datenbank.' }
          };
        }
      // Update profile state in context
      setProfile(prev => prev ? ({ ...prev, display_name: newDisplayName.trim() }) : null);
        console.log('AuthContext: Profile display name updated successfully in DB.');
      return { success: true, data: newDisplayName.trim() };
      } catch (e) {
         console.error('AuthContext: Unexpected error updating display name in DB:', e);
       setDisplayName(originalDisplayName); // Revert state on unexpected error
         return { success: false, error: { message: 'Unerwarteter Fehler beim DB-Update.' } };
    }
  };

  // Update Preferences (Applies to both temporary and full accounts)
  const updatePreferences = async (newPreferences) => {
     if (!user) { // Check if there is an active user session
       console.warn('AuthContext: updatePreferences called without active user.');
       return { success: false, error: { message: 'Kein Benutzer angemeldet.' } };
     }

     if (!Array.isArray(newPreferences)) { // Basic validation
       return { success: false, error: { message: 'Ungültiges Präferenzformat.' } };
     }
     // Allow empty preferences? Maybe.
     // if (newPreferences.length === 0) {
     //   return { success: false, error: { message: 'Bitte mindestens eine Präferenz auswählen.' } };
     // }

     // Update local state immediately
     const originalPreferences = preferences;
     setPreferences(newPreferences);
     // await AsyncStorage.setItem('userPreferences', JSON.stringify(newPreferences)); // Keep local storage?

     // Update DB
       try {
         console.log('AuthContext: Updating profile preferences in DB for user:', user.id);
         const { error } = await supabase
           .from('profiles')
           .update({ preferences: newPreferences, updated_at: new Date() })
           .eq('id', user.id);

         if (error) {
           console.error('AuthContext: Error updating preferences in DB:', error);
         // Revert local state
         // await AsyncStorage.setItem('userPreferences', JSON.stringify(originalPreferences));
         setPreferences(originalPreferences);
           return {
           success: false,
           error: { message: 'Fehler beim Speichern der Präferenzen in der Datenbank.' }
           };
         }
         // Update profile state in context
         setProfile(prev => prev ? ({ ...prev, preferences: newPreferences }) : null);
         console.log('AuthContext: Profile preferences updated successfully in DB.');
         return { success: true, data: newPreferences };
       } catch (e) {
          console.error('AuthContext: Unexpected error updating preferences in DB:', e);
          setPreferences(originalPreferences); // Revert state on unexpected error
          return { success: false, error: { message: 'Unerwarteter Fehler beim DB-Update.' } };
       }
  };

   // Generic Profile Update (Handles display_name, preferences, about_me)
   const updateProfile = async (updates) => {
        if (!user) {
            console.warn('AuthContext: updateProfile called without active user.');
            return { success: false, error: { message: 'Kein Benutzer angemeldet.' } };
        }
        if (Object.keys(updates).length === 0) {
            console.log('AuthContext: updateProfile called with no updates.');
            return { success: true }; // No changes needed
        }

        // Optimistic UI updates (update local state first)
        const originalProfile = { ...profile }; // Shallow copy for revert
        const updatedProfile = { ...profile, ...updates };
        setProfile(updatedProfile);
        if ('display_name' in updates) setDisplayName(updates.display_name);
        if ('preferences' in updates) setPreferences(updates.preferences);
        // No separate state for about_me, it's directly in profile

        try {
            console.log(`AuthContext: Updating profile in DB for user ${user.id}:`, updates);
            const { error } = await supabase
                .from('profiles')
                .update({ ...updates, updated_at: new Date() }) // Spread the updates object
                .eq('id', user.id);

            if (error) {
                console.error('AuthContext: Error updating profile in DB:', error);
                // Revert local state on DB error
                setProfile(originalProfile);
                if ('display_name' in updates) setDisplayName(originalProfile.display_name || '');
                if ('preferences' in updates) setPreferences(originalProfile.preferences || []);

                return {
                    success: false,
                    error: { message: 'Fehler beim Speichern des Profils in der Datenbank.' },
                };
            }

            console.log('AuthContext: Profile updated successfully in DB.');
            // No need to update state again, already done optimistically
            return { success: true, data: updatedProfile };
        } catch (e) {
            console.error('AuthContext: Unexpected error updating profile in DB:', e);
            // Revert local state on unexpected error
            setProfile(originalProfile);
            if ('display_name' in updates) setDisplayName(originalProfile.display_name || '');
            if ('preferences' in updates) setPreferences(originalProfile.preferences || []);

            return { success: false, error: { message: 'Unerwarteter Fehler beim DB-Update.' } };
        }
    };

   // Update user email (Only applicable if account IS NOT temporary)
   const updateEmail = async (newEmail, password) => {
     if (!user) {
       return { success: false, error: { message: 'Nicht angemeldet.' } };
     }
     if (profile?.is_temporary) {
       return { success: false, error: { message: 'E-Mail kann für temporäre Konten nicht geändert werden. Bitte zuerst Account vervollständigen.' } };
     }
     if (!newEmail || !newEmail.includes('@')) {
        return { success: false, error: { message: 'Neue E-Mail benötigt.' } };
     }
     // Password check might be needed depending on Supabase security settings for email change.
     // Temporarily remove password requirement for email change if confirmation is off
     // if (!password) {
     //    return { success: false, error: { message: 'Aktuelles Passwort benötigt.' } };
     // }

     setLoading(true); // Use account settings loading? Or overall?
     try {
       // Update email using Supabase Auth
       console.log('AuthContext: Attempting to update email via Supabase Auth...');
       const { data, error: updateError } = await supabase.auth.updateUser({
         email: newEmail
       });

       if (updateError) {
         console.error("AuthContext: Supabase updateUser (email) error:", updateError);
         // Handle specific errors if needed (e.g., email already exists)
         return { success: false, error: { message: updateError.message || 'E-Mail konnte nicht geändert werden.' } };
       }

       console.log("AuthContext: Email update successful via API.", data);
       // Since email confirmation is disabled in project settings, treat as immediate success.
       // The onAuthStateChange listener should eventually update the user object in the context.
       // Reload the profile manually IF the user object doesn't update quickly enough via listener.
       setTimeout(() => loadUserProfileAndOrgs(user.id), 500); // Trigger profile reload

       return { success: true }; // Indicate success to the ProfileScreen

     } catch (error) {
       console.error("AuthContext: Unexpected error updating email:", error);
       return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
     } finally {
       setLoading(false);
     }
   };

   // Update user password (Only applicable if account IS NOT temporary)
   const updatePassword = async (newPassword) => {
      if (!user) {
         return { success: false, error: { message: 'Nicht angemeldet.' } };
      }
      // No is_temporary check here anymore

      // Basic validation
      if (!newPassword || newPassword.length < 6) {
          return { success: false, error: { message: 'Neues Passwort muss mind. 6 Zeichen lang sein.' } };
      }

      let passwordUpdateResult = null;
      let profileUpdateError = null; // To track profile update specifically

      try {
          console.log('AuthContext: Attempting password update via Supabase Auth...');
          // 1. Update Auth User Password
          const { data: authUpdateData, error: authUpdateError } = await supabase.auth.updateUser({
              password: newPassword
          });

          if (authUpdateError) {
              console.error("AuthContext: Supabase updateUser (password) error:", authUpdateError);
              return { success: false, error: { message: authUpdateError.message || 'Passwort konnte nicht geändert werden.' } };
          }

          console.log("AuthContext: Auth password updated successfully.", authUpdateData);
          passwordUpdateResult = { success: true }; // Mark auth password update as success

          // 2. Update Profile to set is_temporary = false *IF* it was temporary
          // Check the profile state from the context
          if (profile?.is_temporary) {
              console.log(`AuthContext: Account was temporary. Updating profile ${user.id} to set is_temporary=false.`);
              const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ is_temporary: false, updated_at: new Date() })
                  .eq('id', user.id);

              if (updateError) {
                  console.error('AuthContext: Error updating profile (setting is_temporary=false): ', updateError);
                  profileUpdateError = updateError; // Store the error
              } else {
                  console.log('AuthContext: Profile updated successfully (is_temporary=false).');
                  // Trigger profile reload to get the new state reflected in the context/UI
                  loadUserProfileAndOrgs(user.id);
              }
          } else {
             console.log("AuthContext: Account was already permanent, skipping profile flag update.");
          }

      } catch (error) {
          console.error("AuthContext: Unexpected error during password update process:", error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      }

      // Determine final result based on password update success and profile update error
      if (passwordUpdateResult?.success) {
          if (profileUpdateError) {
             // Password updated, but profile flag failed
             return {
                  success: true, // Main action (password set) succeeded
                  warning: `Passwort gesetzt, aber Profil konnte nicht als permanent markiert werden: ${profileUpdateError.message}.`,
                  error: profileUpdateError // Pass along the specific profile error
              };
          } else {
             // Everything succeeded
             return { success: true };
          }
      } else {
         // Password update itself failed (should have been caught earlier, but safety)
         return { success: false, error: { message: 'Passwort-Update fehlgeschlagen.'} };
      }
   };

  // --- NEW: Profile Picture Update ---
  const updateProfilePicture = async (imageUri) => {
    if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
    if (!imageUri) return { success: false, error: { message: 'Kein Bild ausgewählt.' } };

    setLoadingProfilePicture(true);
    try {
      console.log(`AuthContext: Starting profile picture upload for user ${user.id}. Image URI: ${imageUri}`);

      // Determine file extension from URI
      const fileExt = imageUri.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `public/${fileName}`; // Store in a public folder within the bucket
      const fileType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to Supabase Storage
      console.log(`AuthContext: Uploading to storage. Path: ${filePath}, Type: ${fileType}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile_images') // Use the article_images bucket as requested
        .upload(filePath, Buffer.from(base64, 'base64'), {
          contentType: fileType,
          cacheControl: '3600', // Cache for 1 hour
          upsert: true, // Overwrite existing file for the user
        });

      if (uploadError) {
        console.error('AuthContext: Supabase storage upload error:', uploadError);
        return { success: false, error: { message: uploadError.message || 'Fehler beim Hochladen des Bildes.' } };
      }

      console.log('AuthContext: Storage upload successful:', uploadData);

      // Get the public URL for the uploaded file
      // Construct the URL manually as getPublicUrl might be deprecated or behave unexpectedly
      const storageBaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; // Ensure this is set in your environment
      if (!storageBaseUrl) {
          console.error('AuthContext: EXPO_PUBLIC_SUPABASE_URL is not defined!');
          return { success: false, error: { message: 'Server-Konfigurationsfehler.' } };
      }
      // Use the key from uploadData.data if available, otherwise use constructed filePath
      const imageUrlPath = uploadData?.path ?? filePath;
      const publicUrl = `${storageBaseUrl}/storage/v1/object/public/profile_images/${imageUrlPath}?t=${new Date().getTime()}`; // Update bucket name in URL

      console.log('AuthContext: Generated public URL:', publicUrl);

      // Update the avatar_url in the profiles table
      console.log(`AuthContext: Updating profile table with avatar_url for user ${user.id}`);
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date() })
        .eq('id', user.id);

      if (dbError) {
        console.error('AuthContext: Error updating profile avatar_url:', dbError);
        // Attempt to delete the uploaded image if DB update fails?
        // await supabase.storage.from('avatars').remove([filePath]);
        return { success: false, error: { message: dbError.message || 'Fehler beim Speichern des Bild-Links.' } };
      }

      console.log('AuthContext: Profile avatar_url updated successfully.');

      // Update local profile state immediately
      setProfile(prev => prev ? ({ ...prev, avatar_url: publicUrl }) : null);

      return { success: true, data: { avatarUrl: publicUrl } };
    } catch (error) {
      console.error('AuthContext: Unexpected error in updateProfilePicture:', error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoadingProfilePicture(false);
    }
  };

  // --- Organization Actions (kept in AuthContext as they relate to the logged-in user joining/leaving/creating) ---
  const createOrganization = async (name) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (profile?.is_temporary) return { success: false, error: { message: 'Temporäre Konten können keine Organisationen erstellen.' } };
      if (!name || name.trim() === '') {
          return { success: false, error: { message: 'Organisationsname benötigt.' } };
      }
      setLoading(true);
      let newOrg = null;
      try {
          const { data: rpcData, error: rpcError } = await supabase.rpc(
              'create_new_organization',
              { org_name: name.trim() } 
          );

          if (rpcError) {
              console.error("AuthContext: Error calling create_new_organization RPC:", rpcError);
              return { success: false, error: { message: rpcError.message || 'Fehler beim Erstellen über RPC.' } };
          }

          if (!rpcData || rpcData.length === 0) {
              console.error("AuthContext: create_new_organization RPC returned no data.");
              return { success: false, error: { message: 'RPC zur Erstellung fehlgeschlagen.' } };
          }

          newOrg = rpcData[0]; 
          console.log('AuthContext: Organization created via RPC:', newOrg);
          await loadUserProfileAndOrgs(user.id); // Refetch to include the new org
          console.log('AuthContext: User profile and orgs refetched.');
          return { success: true, data: newOrg };

      } catch (error) {
          console.error("AuthContext: Unexpected error creating organization via RPC:", error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoading(false);
      }
  };

  const joinOrganizationByInviteCode = async (inviteCode) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (profile?.is_temporary) return { success: false, error: { message: 'Temporäre Konten können Organisationen nicht beitreten.' } };
      if (!inviteCode || inviteCode.trim() === '') return { success: false, error: { message: 'Einladungscode benötigt.' } };
      
      setLoading(true);
      let finalResult = {};
      try {
          const { data: org, error: findError } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('invite_code', inviteCode.trim())
              .maybeSingle();

          if (findError) throw new Error(findError.message || 'Fehler bei Codesuche.');
          if (!org) {
              finalResult = { success: false, error: { message: 'Ungültiger oder abgelaufener Einladungscode.' } };
          } else {
             const memberData = { organization_id: org.id, user_id: user.id, role: 'member' };
             const { error: joinError } = await supabase.from('organization_members').insert(memberData);

             if (joinError) {
                  if (joinError.code === '23505') { // Already a member
                      await loadUserProfileAndOrgs(user.id);
                      finalResult = { success: true, data: org }; 
                  } else {
                      throw new Error(joinError.message || 'Fehler beim Beitreten.');
                  }
             } else {
                 await loadUserProfileAndOrgs(user.id);
                 finalResult = { success: true, data: org };
             }
          }
      } catch (error) {
          console.error("[AuthContext] Error in joinOrganizationByInviteCode:", error);
          finalResult = { success: false, error: { message: String(error.message || 'Ein unerwarteter Fehler ist aufgetreten.') } };
      } finally {
          setLoading(false);
      }
      return finalResult;
  };

  const leaveOrganization = async (organizationId) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
      
      setLoading(true); 
      let result = {};
      try {
          // Simplified check - RLS should handle last admin prevention
          const { error } = await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', organizationId)
              .eq('user_id', user.id);

          if (error) {
               // Check if the error is from our RLS policy
              if (error.message.includes('prevent_last_admin_leave')) { 
                   result = { success: false, error: { message: 'Du bist der letzte Admin und kannst die Organisation nicht verlassen.', code: 'LAST_ADMIN_VIOLATION' } };
              } else {
                  result = { success: false, error: { message: error.message || 'Fehler beim Verlassen.' } };
              }
          } else {
              await loadUserProfileAndOrgs(user.id); // Refetch orgs list
              result = { success: true };
          }
      } catch (error) {
          console.error("AuthContext: Unexpected error leaving organization:", error);
          result = { success: false, error: { message: error.message || 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoading(false); 
      }
      return result;
  };

  // --- NEW: Delete Current User Account --- (Needs is_temporary check?)
  const deleteCurrentUserAccount = async () => {
    if (!user) {
      return { success: false, error: { message: 'Nicht angemeldet.' } };
    }
    // Allow temporary users to delete their account? YES.
    // if (profile?.is_temporary) {
    //   return { success: false, error: { message: 'Temporäre Accounts können nicht gelöscht werden.'}}; // Or allow?
    // }
    
    const currentToken = expoPushToken; // Capture token before anything happens
    setLoading(true);
    try {
      console.log(`AuthContext: Attempting to delete account for user ${user.id} via RPC.`);
      
      // Call the RPC function to perform checks (like admin status) and delete profile data
      const { error: rpcError } = await supabase.rpc('delete_user_account');

      if (rpcError) {
        console.error("AuthContext: Error calling delete_user_account RPC:", rpcError);
        // Pass the specific error message from the RPC back
        return { success: false, error: { message: rpcError.message || 'Fehler beim Löschen über RPC.' } };
      }

      console.log(`AuthContext: RPC delete_user_account successful for user ${user.id}. Now signing out.`);

      // IMPORTANT: The actual deletion from auth.users needs a service_role key.
      // This should be handled by a separate backend process or Supabase Function triggered by the RPC potentially.

      // Sign out the user locally after profile data is cleared via RPC
      // SignOut now also handles updating the push token to anonymous
      const signOutResult = await signOut(); 
      if (!signOutResult.success) {
        console.error("AuthContext: Sign out failed after account deletion RPC.");
        // Even if sign out fails, the DB part succeeded conceptually
        return { success: true, warning: 'Account data deleted, but local sign out failed.' }; 
      }
      
      console.log(`AuthContext: Account deletion process complete (profile data removed, user signed out, token updated).`);
      return { success: true };

    } catch (error) {
        // Catch unexpected errors during the process
        console.error("AuthContext: Unexpected error in deleteCurrentUserAccount:", error);
        return { success: false, error: { message: 'Ein unerwarteter Fehler ist beim Löschen aufgetreten.' } };
    } finally {
        setLoading(false); 
    }
  };

  // --- Context Value --- (Add/Remove functions)
  const value = {
    session,
    user,
    profile, // Includes avatar_url and about_me now
    loading,
    preferences,
    displayName,
    hasCompletedOnboarding,
    userOrganizations,
    supabase, // Keep exporting supabase client instance
    // Auth Flow
    // createLocalAccount, // REMOVED
    createTemporaryAccount, // ADDED
    upgradeToFullAccount, // Now used for temp -> full
    signIn,
    signOut,
    // Profile Updates
    updateDisplayName,
    updatePreferences,
    updateProfile,
    updateEmail, // Add temporary check inside
    updatePassword, // ADD THIS LINE
    updateProfilePicture, // ADDED
    loadingProfilePicture, // ADDED
    loadUserProfile: loadUserProfileAndOrgs, // Keep combined loading function
    // Organization Functions (These DO belong in AuthContext)
    createOrganization, 
    joinOrganizationByInviteCode,
    leaveOrganization,
    // Account Deletion
    deleteCurrentUserAccount, // Keep
    // Push Token Management
    registerOrUpdatePushToken, // Keep
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 