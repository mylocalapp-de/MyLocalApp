import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { supabase } from '../lib/supabase';

// Create auth context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null); // Supabase Auth user object
  const [profile, setProfile] = useState(null); // Public profile data
  const [preferences, setPreferences] = useState([]); // Local/Profile preferences
  const [displayName, setDisplayName] = useState(''); // Local/Profile display name
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [userOrganizations, setUserOrganizations] = useState([]); // NEW: Store user's org memberships
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true); // Separate loading for profile/orgs
  const [loadingAuth, setLoadingAuth] = useState(true); // Separate loading for auth state

  // --- Session Management ---
  useEffect(() => {
    const fetchSession = async () => {
      setLoadingAuth(true);
      try {
        // Check Async Storage for onboarding status and local data first
        const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
        setHasCompletedOnboarding(onboardingStatus === 'true');

        const savedPreferences = await AsyncStorage.getItem('userPreferences');
        if (savedPreferences) setPreferences(JSON.parse(savedPreferences));

        const savedDisplayName = await AsyncStorage.getItem('userDisplayName');
        if (savedDisplayName) setDisplayName(savedDisplayName);

        // Check Supabase session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log("AuthContext: Initial session fetch:", currentSession ? 'Session found' : 'No session');
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await loadUserProfileAndOrgs(currentSession.user.id); // Use combined loading function
        } else {
          setLoadingProfile(false); // No user, so profile/org loading is done (nothing to load)
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
        const previousSupabaseUser = session?.user ?? null; // Use previous session state
        const userIdChanged = newSupabaseUser?.id !== previousSupabaseUser?.id;

        console.log(`AuthContext: User ID check - Prev: ${previousSupabaseUser?.id}, New: ${newSupabaseUser?.id}, Changed: ${userIdChanged}`);

        // Update session state regardless of event type
        setSession(newSession);

        // Update user state IF the user object itself has changed identity
        // This prevents unnecessary updates for events like TOKEN_REFRESHED where user ID is the same
        if (userIdChanged) {
            console.log('AuthContext: Updating user context state object due to ID change.');
            setUser(newSupabaseUser);
        } else {
            console.log('AuthContext: Skipping user context state object update (ID unchanged).');
        }

        // Handle different event types
        switch (_event) {
            case 'SIGNED_IN':
            case 'INITIAL_SESSION': // Treat initial session like sign in if user exists
                if (newSupabaseUser) {
                    console.log(`AuthContext: ${_event} event - Loading profile/orgs for user:`, newSupabaseUser.id);
                    await loadUserProfileAndOrgs(newSupabaseUser.id);
                    // Ensure onboarding is marked complete on sign-in or initial load with user
                    if (!hasCompletedOnboarding) {
                        console.log('AuthContext: Setting onboarding complete status from auth listener.');
                        setHasCompletedOnboarding(true);
                        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
                    }
                } else {
                    // INITIAL_SESSION with no user (logged out state)
                    console.log('AuthContext: INITIAL_SESSION with no user.');
                    setProfile(null);
                    setUserOrganizations([]);
                    setLoadingProfile(false);
                }
                break;

            case 'SIGNED_OUT':
                console.log('AuthContext: SIGNED_OUT event.');
                // State clearing (user, profile, orgs) is handled by the userIdChanged logic above
                // and the explicit signOut function clears local storage.
                setProfile(null);
                setUserOrganizations([]);
                setLoadingProfile(false);
                break;

            case 'TOKEN_REFRESHED':
                if (newSupabaseUser && userIdChanged) {
                    // If token refresh somehow resulted in a different user ID (unlikely but possible)
                    console.log('AuthContext: TOKEN_REFRESHED with user ID change - Reloading profile/orgs for user:', newSupabaseUser.id);
                    await loadUserProfileAndOrgs(newSupabaseUser.id);
                } else if (newSupabaseUser) {
                    // Normal token refresh, user is the same, no need to reload profile/orgs
                    console.log('AuthContext: TOKEN_REFRESHED, user unchanged, skipping profile reload.');
                    setLoadingProfile(false); // Ensure loading stops if it was somehow triggered
                } else {
                    // Token refresh resulted in no user?
                    console.log('AuthContext: TOKEN_REFRESHED resulted in no user.');
                    setProfile(null);
                    setUserOrganizations([]);
                    setLoadingProfile(false);
                }
                break;

            case 'USER_UPDATED':
                // User metadata (like email verification status) updated
                if (newSupabaseUser) {
                    console.log('AuthContext: USER_UPDATED - potentially reload profile if needed or update user object partially');
                    // Optionally update the user state if specific metadata is needed immediately
                    setUser(prevUser => ({ ...prevUser, ...newSupabaseUser }));
                    // Generally, profile reload isn't needed unless email changed etc.
                    // Consider reloading profile specifically if email was updated and verified.
                    setLoadingProfile(false);
                } else {
                    setLoadingProfile(false);
                }
                break;

            case 'PASSWORD_RECOVERY':
                console.log('AuthContext: PASSWORD_RECOVERY event.');
                // Usually handled by UI flow, no immediate context change needed
                setLoadingProfile(false);
                break;

            default:
                console.log(`AuthContext: Unhandled auth event: ${_event}`);
                setLoadingProfile(false); // Ensure loading stops for unhandled cases
        }

        setLoadingAuth(false); // Auth state processing finished for this event
      }
    );

    // Cleanup listener on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);
  
   // Update overall loading state
  useEffect(() => {
    setLoading(loadingAuth || loadingProfile);
  }, [loadingAuth, loadingProfile]);

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
          .select(`display_name, preferences, updated_at`)
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('organizations')
          .select(`
            id, 
            name,
            organization_members!inner ( role )
          `)
          .eq('organization_members.user_id', userId)
      ]);

      // Handle profile result
      if (profileResult.error && profileResult.status !== 406) {
        console.error(`AuthContext: [${callTimestamp}] Error loading user profile for ID ${userId}:`, profileResult.error);
        setProfile(null);
      } else if (profileResult.data) {
        console.log(`AuthContext: [${callTimestamp}] Profile loaded for ID ${userId}:`, profileResult.data);
        setProfile(profileResult.data);
        if (profileResult.data.display_name) setDisplayName(profileResult.data.display_name);
        if (profileResult.data.preferences) setPreferences(profileResult.data.preferences);
        await AsyncStorage.setItem('userDisplayName', profileResult.data.display_name || '');
        await AsyncStorage.setItem('userPreferences', JSON.stringify(profileResult.data.preferences || []));
      } else {
        console.log(`AuthContext: [${callTimestamp}] No profile found for user ID ${userId}.`);
        setProfile(null);
      }

      // Handle organizations result
      if (orgsResult.error) {
        console.error(`AuthContext: [${callTimestamp}] Error loading user organizations for ID ${userId}:`, JSON.stringify(orgsResult.error, null, 2));
        setUserOrganizations([]); // Clear on error
      } else {
        const orgData = orgsResult.data || [];
        const formattedOrgs = orgData.map(org => ({
            id: org.id,
            name: org.name,
            role: org.organization_members[0]?.role || 'member'
        }));
        console.log(`AuthContext: [${callTimestamp}] User organizations loaded successfully for ID ${userId}:`, formattedOrgs);
        setUserOrganizations(formattedOrgs);
      }

    } catch (error) {
      console.error(`AuthContext: [${callTimestamp}] Unexpected error in loadUserProfileAndOrgs for ID ${userId}:`, error);
      setProfile(null);
      setUserOrganizations([]); // Clear on error
    } finally {
      setLoadingProfile(false);
      console.log(`AuthContext: [${callTimestamp}] END loadUserProfileAndOrgs for ID ${userId}. loadingProfile set to false.`);
    }
  };

  // --- Local Onboarding Flow ---
  const createLocalAccount = async (selectedPreferences, userDisplayName) => {
    try {
      await AsyncStorage.setItem('userPreferences', JSON.stringify(selectedPreferences));
      await AsyncStorage.setItem('userDisplayName', userDisplayName);
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setPreferences(selectedPreferences);
      setDisplayName(userDisplayName);
      setHasCompletedOnboarding(true);
      setUser(null); 
      setProfile(null);
      setUserOrganizations([]); // Clear orgs for local
      console.log('AuthContext: Local account created/set.');
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Error creating local account:', error);
      return { success: false, error };
    }
  };

  // --- Account Creation / Upgrade ---
  const upgradeToFullAccount = async (email, password) => {
    setLoading(true); // Use overall loading
    try {
      console.log('AuthContext: Attempting to upgrade to full account:', email);

      // Basic validation (keep this)
      if (!email || !email.includes('@') || !password || password.length < 6) {
        return {
          success: false,
          error: { message: 'Bitte gültige E-Mail und Passwort (mind. 6 Zeichen) eingeben.' }
        };
      }

      // Get local data (keep this)
      const localPrefsString = await AsyncStorage.getItem('userPreferences');
      const localDisplayName = await AsyncStorage.getItem('userDisplayName') || email.split('@')[0]; // Ensure default
      let localPrefs = [];
      try {
        if (localPrefsString) {
          localPrefs = JSON.parse(localPrefsString);
          if (!Array.isArray(localPrefs)) localPrefs = [];
        }
      } catch (e) {
        console.error("AuthContext: Failed to parse local preferences from storage", e);
        localPrefs = [];
      }

      // Sign up - disable email confirmation
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: null, // Important: Disables email confirmation
          data: {
            display_name: localDisplayName,
            preferences: localPrefs
          }
        }
      });

      if (signUpError) {
        console.error('AuthContext: Supabase signUp error:', signUpError);
        return { success: false, error: { message: signUpError.message || 'Fehler bei der Registrierung.' } };
      }

      if (!signUpData.user) {
        console.error('AuthContext: SignUp successful but no user data returned.');
        return { success: false, error: { message: 'Registrierung fehlgeschlagen, keine Benutzerdaten.' } };
      }

      const userId = signUpData.user.id;
      console.log('AuthContext: SignUp successful, user ID:', userId);

      // --- Profile Creation/Verification --- 
      let profileExists = false;
      try {
        // Wait a moment for the trigger potentially
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // Attempt to load the profile
        console.log('AuthContext: Checking if profile exists for user ID:', userId);
        const { data: existingProfile, error: profileCheckError, status } = await supabase
          .from('profiles')
          .select('id') // Only need to check existence
          .eq('id', userId)
          .maybeSingle(); // Use maybeSingle to handle 0 or 1 row without error

        if (existingProfile) {
          console.log('AuthContext: Profile found (likely created by trigger).');
          profileExists = true;
        } else {
          console.log('AuthContext: Profile not found, attempting manual creation.');
          if (profileCheckError && status !== 406) { // Log unexpected errors
             console.warn('AuthContext: Profile check failed with unexpected error:', profileCheckError);
          }

          // Manually insert the profile
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
              id: userId,
              display_name: localDisplayName,
              preferences: localPrefs,
            }]);

          if (insertError) {
            console.error('AuthContext: FATAL - Error manually creating profile:', insertError);
            // Return failure here, as the account is incomplete without a profile
            return { success: false, error: { message: 'Account erstellt, aber Profil konnte nicht angelegt werden.' } };
          } else {
            console.log('AuthContext: Profile manually created successfully.');
            profileExists = true;
          }
        }
      } catch (e) {
         console.error('AuthContext: Unexpected error during profile check/creation:', e);
         // Decide how to handle this - maybe let the user proceed but log the error?
         // For now, return failure.
         return { success: false, error: { message: 'Fehler bei der Profilerstellung.' } };
      }
      
      // --- Final State Update --- 
      if (profileExists) {
         console.log('AuthContext: Setting onboarding complete state.');
         setHasCompletedOnboarding(true);
         await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
         // The onAuthStateChange listener will call loadUserProfileAndOrgs.
         return { success: true, data: { user: signUpData.user } };
      } else {
         // This case should ideally not be reached due to error handling above
         console.error('AuthContext: Profile does not exist after creation attempt.');
         return { success: false, error: { message: 'Profil konnte nicht verifiziert werden.' } };
      }

    } catch (error) {
      console.error('AuthContext: Unexpected error in upgradeToFullAccount:', error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoading(false);
    }
  };

  // --- Sign In / Sign Out ---
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

      // Explicitly set onboarding complete on successful sign-in
      console.log('AuthContext: Explicitly setting onboarding complete status after sign-in.');
      setHasCompletedOnboarding(true); // <-- Ensure state is set
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true'); // <-- Ensure storage is set

      // onAuthStateChange listener handles loading profile & orgs.
      // The listener will still run, but this ensures the state is true beforehand.
      return { success: true, data: { user: data.user } };

    } catch (error) {
      console.error('AuthContext: Unexpected error during signIn:', error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      console.log('AuthContext: Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthContext: Supabase signOut error:', error);
        return { success: false, error };
      }
      console.log('AuthContext: SignOut successful.');
      // onAuthStateChange handles clearing user, profile, session
      // Clear local data as well on explicit sign out
      setHasCompletedOnboarding(false);
      setPreferences([]);
      setDisplayName('');
      setUserOrganizations([]); // Clear orgs state
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await AsyncStorage.removeItem('userPreferences');
      await AsyncStorage.removeItem('userDisplayName');
      await AsyncStorage.removeItem('activeOrganizationId'); // Also clear active org
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Unexpected error during signOut:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // --- Profile Updates ---
  const updateDisplayName = async (newDisplayName) => {
    if (!newDisplayName || newDisplayName.trim() === '') {
      return { success: false, error: { message: 'Benutzername darf nicht leer sein.' } };
    }

    // Update local state immediately
    setDisplayName(newDisplayName);
    await AsyncStorage.setItem('userDisplayName', newDisplayName);

    if (profile && user) { // Only update DB if user is logged in and profile exists
      try {
        console.log('AuthContext: Updating profile display name in DB for user:', user.id);
        const { error } = await supabase
          .from('profiles')
          .update({ display_name: newDisplayName, updated_at: new Date() })
          .eq('id', user.id);

        if (error) {
          console.error('AuthContext: Error updating display name in DB:', error);
          // Revert local state? Or just warn? Let's warn.
          await AsyncStorage.setItem('userDisplayName', profile.display_name || ''); // Revert storage
          setDisplayName(profile.display_name || ''); // Revert state
          return {
            success: false, // Indicate DB update failed
            error: { message: 'Fehler beim Speichern des Namens in der Datenbank.' },
            warning: 'Änderung lokal gespeichert, aber Datenbank-Update fehlgeschlagen.'
          };
        }
        // Update profile state as well
        setProfile(prev => ({ ...prev, display_name: newDisplayName }));
        console.log('AuthContext: Profile display name updated successfully in DB.');
        return { success: true, data: newDisplayName };
      } catch (e) {
         console.error('AuthContext: Unexpected error updating display name in DB:', e);
         return { success: false, error: { message: 'Unerwarteter Fehler beim DB-Update.' } };
      }
    } else {
      console.log('AuthContext: Display name updated locally only (no user/profile).');
      return { success: true, data: newDisplayName }; // Local update succeeded
    }
  };

  const updatePreferences = async (newPreferences) => {
     if (!Array.isArray(newPreferences) || newPreferences.length === 0) {
       return { success: false, error: { message: 'Bitte mindestens eine Präferenz auswählen.' } };
     }

     // Update local state immediately
     setPreferences(newPreferences);
     await AsyncStorage.setItem('userPreferences', JSON.stringify(newPreferences));

     if (profile && user) { // Only update DB if user is logged in and profile exists
       try {
         console.log('AuthContext: Updating profile preferences in DB for user:', user.id);
         const { error } = await supabase
           .from('profiles')
           .update({ preferences: newPreferences, updated_at: new Date() })
           .eq('id', user.id);

         if (error) {
           console.error('AuthContext: Error updating preferences in DB:', error);
           // Revert local state? Or just warn? Let's warn.
           await AsyncStorage.setItem('userPreferences', JSON.stringify(profile.preferences || [])); // Revert storage
           setPreferences(profile.preferences || []); // Revert state
           return {
             success: false, // Indicate DB update failed
             error: { message: 'Fehler beim Speichern der Präferenzen in der Datenbank.' },
             warning: 'Änderung lokal gespeichert, aber Datenbank-Update fehlgeschlagen.'
           };
         }
         // Update profile state
         setProfile(prev => ({ ...prev, preferences: newPreferences }));
         console.log('AuthContext: Profile preferences updated successfully in DB.');
         return { success: true, data: newPreferences };
       } catch (e) {
          console.error('AuthContext: Unexpected error updating preferences in DB:', e);
          return { success: false, error: { message: 'Unerwarteter Fehler beim DB-Update.' } };
       }
     } else {
       console.log('AuthContext: Preferences updated locally only (no user/profile).');
       return { success: true, data: newPreferences }; // Local update succeeded
     }
  };

   // Update user email (uses Supabase Auth)
   const updateEmail = async (newEmail, password) => {
     if (!user) {
       return { success: false, error: { message: 'Nicht angemeldet.' } };
     }
     if (!newEmail || !newEmail.includes('@')) {
        return { success: false, error: { message: 'Neue E-Mail benötigt.' } };
     }
     // Temporarily remove password requirement for email change if confirmation is off
     // if (!password) {
     //    return { success: false, error: { message: 'Aktuelles Passwort benötigt.' } };
     // }

     setLoading(true);
     try {
       // Removed the problematic password verification step

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
       // This provides faster feedback in the UI.
       setTimeout(() => loadUserProfileAndOrgs(user.id), 500); // Trigger profile reload

       return { success: true }; // Indicate success to the ProfileScreen

     } catch (error) {
       console.error("AuthContext: Unexpected error updating email:", error);
       return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
     } finally {
       setLoading(false);
     }
   };

   // Update user password (uses Supabase Auth)
   const updatePassword = async (newPassword) => {
      if (!user) {
         return { success: false, error: { message: 'Nicht angemeldet.' } };
      }
       // Basic validation (current password verification happens server-side with Supabase)
      if (!newPassword || newPassword.length < 6) {
          return { success: false, error: { message: 'Neues Passwort muss mind. 6 Zeichen lang sein.' } };
      }

      let result = null; // Variable to hold the result
      try {
          console.log('AuthContext: Attempting password update via Supabase Auth...');
          const { data, error } = await supabase.auth.updateUser({
              password: newPassword
          });

          if (error) {
              console.error("AuthContext: Supabase updateUser (password) error:", error);
              // Supabase error might include "New password should be different from the old password."
              result = { success: false, error: { message: error.message || 'Passwort konnte nicht geändert werden.' } };
          } else {
             console.log("AuthContext: Password updated successfully in try block.", data);
             result = { success: true };
          }

      } catch (error) {
          console.error("AuthContext: Unexpected error updating password:", error);
          result = { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          console.log("AuthContext: updatePassword finally block reached. Returning:", result); // Log before returning
      }
      return result; // Return the captured result
   };

  // --- Organization Actions --- 
  const createOrganization = async (name) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (!name || name.trim() === '') {
          return { success: false, error: { message: 'Organisationsname benötigt.' } };
      }
      setLoading(true);
      let newOrg = null; // Variable to hold the new org data
      try {
          // Call the RPC function instead of direct insert
          console.log(`AuthContext: Calling RPC create_new_organization for name: ${name.trim()}`);
          const { data: rpcData, error: rpcError } = await supabase.rpc(
              'create_new_organization',
              { org_name: name.trim() } // Pass arguments as an object
          );

          if (rpcError) {
              console.error("AuthContext: Error calling create_new_organization RPC:", rpcError);
              return { success: false, error: { message: rpcError.message || 'Fehler beim Erstellen über RPC.' } };
          }

          if (!rpcData || rpcData.length === 0) {
              console.error("AuthContext: create_new_organization RPC returned no data.");
              return { success: false, error: { message: 'RPC zur Erstellung fehlgeschlagen.' } };
          }

          newOrg = rpcData[0]; // Get the newly created org data
          console.log('AuthContext: Organization created via RPC:', newOrg);

          // Refetch user organizations to update the context state
          console.log('AuthContext: Refetching user profile and orgs after creation...');
          await loadUserProfileAndOrgs(user.id);
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
      console.log(`[AuthContext] Attempting joinOrganizationByInviteCode with code: "${inviteCode}"`); // Log entry
      if (!user) {
          console.error('[AuthContext] joinOrganizationByInviteCode failed: User not logged in.');
          return { success: false, error: { message: 'Nicht angemeldet.' } };
      }
      if (!inviteCode || inviteCode.trim() === '') {
           console.error('[AuthContext] joinOrganizationByInviteCode failed: Invite code is empty.');
           return { success: false, error: { message: 'Einladungscode benötigt.' } };
      }
      
      setLoading(true);
      let finalResult = {}; // Define final result variable

      try {
          // 1. Find the organization by invite code
          console.log(`[AuthContext] Finding organization with invite code: ${inviteCode.trim()}`);
          const { data: org, error: findError } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('invite_code', inviteCode.trim())
              .maybeSingle();

          if (findError) {
              console.error("[AuthContext] Error finding organization by invite code:", findError);
              throw new Error(findError.message || 'Fehler bei Codesuche.'); // Throw to be caught below
          }
          if (!org) {
              console.warn("[AuthContext] No organization found for invite code:", inviteCode.trim());
              finalResult = { success: false, error: { message: 'Ungültiger oder abgelaufener Einladungscode.' } };
              // No need to return early, finally block handles loading state
          } else {
             console.log(`[AuthContext] Found organization: ${org.name} (ID: ${org.id})`);

             // 2. Prepare member data
             const memberData = { organization_id: org.id, user_id: user.id, role: 'member' };
             console.log('[AuthContext] Attempting to insert into organization_members:', memberData);

             // 3. Add the user as a member
             const { data: insertData, error: joinError } = await supabase
                 .from('organization_members')
                 .insert(memberData)
                 .select(); // Select to see if an error occurs but returns data?

             console.log('[AuthContext] Insert operation result - Error:', joinError); // Log the error
             console.log('[AuthContext] Insert operation result - Data:', insertData); // Log returned data

             if (joinError) {
                  // Handle potential duplicate entry if user is already a member
                  if (joinError.code === '23505') { // Unique violation code
                      console.warn('[AuthContext] User is already a member of this organization (Code 23505). Treating as success.');
                      // Refetch anyway to ensure state is up-to-date
                      console.log('[AuthContext] Refetching user profile and orgs (already member case)...');
                      await loadUserProfileAndOrgs(user.id);
                      console.log('[AuthContext] Refetch completed (already member case).');
                      finalResult = { success: true, data: org }; // Treat as success, already joined
                  } else {
                      console.error("[AuthContext] Error joining organization (Insert failed): ", joinError);
                      // Throw specific error to be caught
                      throw new Error(joinError.message || 'Fehler beim Beitreten.');
                  }
             } else {
                 // Insert seems successful (no error)
                 console.log(`[AuthContext] User ${user.id} successfully inserted into organization ${org.name} (${org.id}) membership.`);
                 
                 // 4. Refetch user organizations to update the context state
                 console.log('[AuthContext] Refetching user profile and orgs after successful join...');
                 await loadUserProfileAndOrgs(user.id);
                 console.log('[AuthContext] Refetch completed after successful join.');

                 finalResult = { success: true, data: org };
             }
          }

      } catch (error) {
          console.error("[AuthContext] Unexpected error caught in joinOrganizationByInviteCode:", error);
          // Ensure the error message passed back is a string
          finalResult = { success: false, error: { message: String(error.message || 'Ein unerwarteter Fehler ist aufgetreten.') } };
      } finally {
          setLoading(false);
          console.log("[AuthContext] joinOrganizationByInviteCode finished. Returning:", finalResult); // Log final result
      }
      
      return finalResult;
  };

  const leaveOrganization = async (organizationId) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
      
      setLoading(true); // Set loading true at the start
      let result = {}; // Define result variable
      try {
          // ** CHECK: Prevent last admin from leaving **
          console.log(`AuthContext: Checking membership status before leaving org ${organizationId}`);
          const { data: members, error: memberCheckError } = await supabase
              .from('organization_members')
              .select('user_id, role')
              .eq('organization_id', organizationId);

          if (memberCheckError) {
              console.error("AuthContext: Error checking members before leaving:", memberCheckError);
              throw new Error("Fehler beim Prüfen der Mitgliederzahl."); // Throw to be caught by catch block
          }

          const isAdmin = members.some(m => m.user_id === user.id && m.role === 'admin');
          const adminCount = members.filter(m => m.role === 'admin').length;

          if (isAdmin && adminCount === 1 && members.length > 1) {
             // Is the sole admin, but other members exist
             console.warn(`AuthContext: User ${user.id} is the last admin of org ${organizationId} with other members.`);
             result = { success: false, error: { message: 'Du bist der letzte Admin. Bitte übertrage die Admin-Rolle oder entferne zuerst alle anderen Mitglieder.' } };
             setLoading(false); // <-- Need to set loading false here before returning
             return result;
          } 
          // Note: If isAdmin && adminCount === 1 && members.length === 1, 
          // the RLS policy should ideally prevent deletion anyway, but the backend check adds clarity.
          // If !isAdmin, they can always leave.

          console.log(`AuthContext: Proceeding with DELETE from organization_members for user ${user.id} and org ${organizationId}`);
          const { error } = await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', organizationId)
              .eq('user_id', user.id);

          if (error) {
              console.error("AuthContext: Error leaving organization (delete op):", error);
              // Check if the error is from our RLS policy
              if (error.message.includes('policy "prevent_last_admin_leave"' ) || error.message.includes('check constraint violation')) { // Adjust based on actual error
                   result = { success: false, error: { message: 'Du bist der letzte Admin und kannst die Organisation nicht verlassen.', code: 'LAST_ADMIN_VIOLATION' } };
              } else {
                  result = { success: false, error: { message: error.message || 'Fehler beim Verlassen.' } };
              }
          } else {
              console.log(`AuthContext: User ${user.id} successfully deleted membership for org ${organizationId}`);
              
              // Refetch user organizations immediately AFTER successful delete
              console.log('AuthContext: Refetching user profile and orgs after leaving...');
              await loadUserProfileAndOrgs(user.id); // This updates userOrganizations state
              console.log('AuthContext: User profile and orgs refetched after leaving.');
              
              // Let OrganizationContext react to the change in userOrganizations if the left org was active.
              
              result = { success: true };
          }

      } catch (error) {
          console.error("AuthContext: Unexpected error leaving organization:", error);
          result = { success: false, error: { message: error.message || 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoading(false); // Ensure loading is set to false in finally block
      }
      return result; // Return the result
  };

  const fetchOrganizationMembers = async (organizationId) => {
      if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
      // RLS should ensure only members of the org can fetch this? Check policy.
      try {
          const { data, error } = await supabase
              .from('organization_members')
              .select(`
                  user_id,
                  role,
                  profiles ( display_name )
              `)
              .eq('organization_id', organizationId);

          if (error) {
              console.error("AuthContext: Error fetching organization members:", error);
              return { success: false, error: { message: error.message || 'Fehler beim Laden der Mitglieder.' } };
          }
          
          return { success: true, data };

      } catch (error) {
          console.error("AuthContext: Unexpected error fetching members:", error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      }
  };

  const updateOrganizationDetails = async (organizationId, details) => {
       if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
       if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
       // RLS Policy "Allow admin to manage their organization" should handle authz
       
       setLoading(true);
       try {
           const { data, error } = await supabase
               .from('organizations')
               .update({ 
                   name: details.name, // Only allow updating specific fields
                   // logo_url: details.logo_url, // Example
                   updated_at: new Date() 
               })
               .eq('id', organizationId)
               .select('id, name') // Return updated data
               .single();

           if (error) {
               console.error("AuthContext: Error updating organization details:", error);
               return { success: false, error: { message: error.message || 'Fehler beim Aktualisieren.' } };
           }
           
           // Refetch user's org list in case name changed
           await loadUserProfileAndOrgs(user.id);
           // Optionally, update the activeOrganization in OrganizationContext if this was the active org

           return { success: true, data };

       } catch (error) {
           console.error("AuthContext: Unexpected error updating org details:", error);
           return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
       } finally {
           setLoading(false);
       }
  };

  // --- Reset Onboarding (for testing/dev) ---
  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await AsyncStorage.removeItem('userPreferences');
      await AsyncStorage.removeItem('userDisplayName');
      await AsyncStorage.removeItem('activeOrganizationId'); // Clear active org
      setHasCompletedOnboarding(false);
      setPreferences([]);
      setDisplayName('');
      setUserOrganizations([]); // Clear orgs state
      // Sign out the Supabase user if they were logged in
      if (user) {
        await signOut(); // signOut now handles clearing other local data
      } else {
         setUser(null);
         setProfile(null);
         setSession(null);
      }
      console.log('AuthContext: Onboarding reset.');
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Error resetting onboarding:', error);
      return { success: false, error };
    }
  };

  // --- Context Value ---
  const value = {
    session,
    user,
    profile,
    loading,
    preferences,
    displayName,
    hasCompletedOnboarding,
    userOrganizations, // Expose the list of organizations
    supabase, // Keep exporting supabase client instance
    createLocalAccount,
    upgradeToFullAccount,
    signIn,
    signOut,
    resetOnboarding,
    updateDisplayName,
    updatePreferences,
    updateEmail,
    updatePassword,
    loadUserProfile: loadUserProfileAndOrgs, // Expose combined loading function
    // Organization Functions
    createOrganization,
    joinOrganizationByInviteCode,
    leaveOrganization,
    fetchOrganizationMembers,
    updateOrganizationDetails
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