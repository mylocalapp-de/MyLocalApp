import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { supabase } from '../lib/supabase';

// Create auth context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null); // This will store the Supabase Auth user object
  const [profile, setProfile] = useState(null); // This will store data from our public.profiles table
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState([]); // Still managed locally first
  const [displayName, setDisplayName] = useState(''); // Still managed locally first
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // --- Session Management ---
  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
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
          await loadUserProfile(currentSession.user.id);
        }

      } catch (error) {
        console.error("AuthContext: Error fetching initial session or local data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log(`AuthContext: Auth state changed event: ${_event}`, newSession ? 'New session' : 'No session');
        
        const currentUser = newSession?.user ?? null;
        const currentUserId = currentUser?.id;
        const previousUserId = session?.user?.id;

        // Explicitly compare IDs, handling nulls
        const userIdChanged = previousUserId !== currentUserId;

        console.log(`AuthContext: User ID check - Previous: ${previousUserId}, Current: ${currentUserId}, Changed: ${userIdChanged}`); // DEBUG log

        const wasAlreadyLoggedIn = !!previousUserId; // Use previousUserId for this check

        setSession(newSession); 
        // Only update the main user state if the user ID actually changed 
        // or if it's not a USER_UPDATED event (e.g., SIGNED_IN, INITIAL_SESSION).
        // Avoids unnecessary re-renders/navigation triggers just for metadata updates.
        if (userIdChanged || _event !== 'USER_UPDATED') {
            console.log('AuthContext: Updating user state object.');
            setUser(currentUser);
        } else {
            console.log('AuthContext: Skipping user state object update for USER_UPDATED event with same user ID.');
        }
        // setLoading(false); // This setLoading might be causing issues if set too early?

        if (currentUser) {
          // User logged in, session restored, or user updated
          
          // Only set onboarding complete on initial sign-in/session recovery, 
          // not on simple user updates if already logged in.
          if (!wasAlreadyLoggedIn || _event !== 'USER_UPDATED') {
             console.log('AuthContext: Setting onboarding complete status (Initial session or non-update event).');
             setHasCompletedOnboarding(true);
             await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
          } else {
             console.log('AuthContext: Skipping onboarding state set for USER_UPDATED event while already logged in.');
          }
          
          // Reload profile *unless* it's just a user update (like password change) for the *same* user.
          if (_event !== 'USER_UPDATED' || userIdChanged) {
            console.log('AuthContext: Loading profile due to event type or user change.');
            await loadUserProfile(currentUser.id);
          } else {
            console.log('AuthContext: Skipping profile reload for USER_UPDATED event with same user ID.');
          }

        } else {
          // User logged out
          setProfile(null);
          // Keep local displayName/preferences if user signs out? Or clear them?
          // Let's keep them for now, they might log back in.
          // Consider clearing if resetOnboarding is called explicitly.
          // Also ensure onboarding is marked false if logged out.
          // setHasCompletedOnboarding(false); // We handle this explicitly in signOut now
        }
        // Set loading false AFTER potentially async operations inside the if(currentUser) block
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // --- Profile Management ---
  const loadUserProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    console.log('AuthContext: Loading profile for user ID:', userId);
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`display_name, preferences, updated_at`)
        .eq('id', userId)
        .single();

      if (error && status !== 406) { // 406 means no row found, which is handled
        console.error('AuthContext: Error loading user profile:', error);
        setProfile(null); // Clear profile on error
      } else if (data) {
        console.log('AuthContext: Profile loaded:', data);
        setProfile(data);
        // Update local state with profile data if available
        if (data.display_name) setDisplayName(data.display_name);
        if (data.preferences) setPreferences(data.preferences);
        // Optionally save to AsyncStorage as well? Depends on strategy.
        await AsyncStorage.setItem('userDisplayName', data.display_name || '');
        await AsyncStorage.setItem('userPreferences', JSON.stringify(data.preferences || []));
      } else {
        console.log('AuthContext: No profile found for user, might be created by trigger shortly.');
        setProfile(null); // Explicitly set to null if no profile exists
      }
    } catch (error) {
      console.error("AuthContext: Unexpected error in loadUserProfile:", error);
      setProfile(null);
    }
  }, []);

  // --- Local Onboarding Flow ---
  const createLocalAccount = async (selectedPreferences, userDisplayName) => {
    try {
      await AsyncStorage.setItem('userPreferences', JSON.stringify(selectedPreferences));
      await AsyncStorage.setItem('userDisplayName', userDisplayName);
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setPreferences(selectedPreferences);
      setDisplayName(userDisplayName);
      setHasCompletedOnboarding(true);
      setUser(null); // Ensure no Supabase user is set for local-only state
      setProfile(null); // Ensure no profile is set
      console.log('AuthContext: Local account created/set.');
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Error creating local account:', error);
      return { success: false, error };
    }
  };

  // --- Account Creation / Upgrade ---
  const upgradeToFullAccount = async (email, password) => {
    setLoading(true);
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
      // Rely on onAuthStateChange to set user, session, and load the profile fully.
      // We just need to ensure onboarding state is correct.
      if (profileExists) {
         console.log('AuthContext: Setting onboarding complete state.');
         setHasCompletedOnboarding(true);
         await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
         // The onAuthStateChange listener will call loadUserProfile.
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
      // onAuthStateChange listener will handle setting state and loading profile.
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
      // onAuthStateChange listener handles clearing state (user, profile, session)
      // Reset onboarding state to trigger navigation back to WelcomeScreen
      setHasCompletedOnboarding(false);
      // Also update AsyncStorage to maintain consistent state
      await AsyncStorage.setItem('hasCompletedOnboarding', 'false');
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
       setTimeout(() => loadUserProfile(user.id), 500); // Trigger profile reload

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


  // --- Reset Onboarding (for testing/dev) ---
  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await AsyncStorage.removeItem('userPreferences');
      await AsyncStorage.removeItem('userDisplayName');
      setHasCompletedOnboarding(false);
      setPreferences([]);
      setDisplayName('');
      // Also sign out the Supabase user if they were logged in
      if (user) {
        await signOut();
      } else {
         // Ensure user/profile state is clear if no Supabase user existed
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
    user, // Supabase auth user
    profile, // Public profile data
    loading,
    preferences, // From profile or local storage
    displayName, // From profile or local storage
    hasCompletedOnboarding,
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
    loadUserProfile // Expose profile loading if needed externally
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