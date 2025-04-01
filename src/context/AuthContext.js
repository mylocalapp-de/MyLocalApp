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
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        setUser(currentUser);
        setLoading(false);

        if (currentUser) {
          // User logged in or session restored
          await loadUserProfile(currentUser.id);
          // Mark onboarding as complete if they have a session
          setHasCompletedOnboarding(true);
          await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        } else {
          // User logged out
          setProfile(null);
          // Keep local displayName/preferences if user signs out? Or clear them?
          // Let's keep them for now, they might log back in.
          // Consider clearing if resetOnboarding is called explicitly.
        }
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
    try {
      setLoading(true);
      console.log('AuthContext: Attempting to upgrade to full account:', email);

      // Basic validation
      if (!email || !email.includes('@') || !password || password.length < 6) {
        return {
          success: false,
          error: { message: 'Bitte gültige E-Mail und Passwort (mind. 6 Zeichen) eingeben.' }
        };
      }

      // Get locally stored preferences and display name
      const localPrefs = await AsyncStorage.getItem('userPreferences');
      const localDisplayName = await AsyncStorage.getItem('userDisplayName');

      // Sign up using Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Pass local data to be picked up by the handle_new_user trigger
          data: {
            display_name: localDisplayName || email.split('@')[0], // Use local name or generate default
            preferences: localPrefs ? JSON.parse(localPrefs) : []
          }
        }
      });

      if (signUpError) {
        console.error('AuthContext: Supabase signUp error:', signUpError);
        return { success: false, error: { message: signUpError.message || 'Fehler bei der Registrierung.' } };
      }

      if (!signUpData.user) {
        // This should ideally not happen if there's no error, but handle defensively
         console.error('AuthContext: SignUp successful but no user data returned.');
         return { success: false, error: { message: 'Registrierung fehlgeschlagen, keine Benutzerdaten.' } };
      }

      console.log('AuthContext: SignUp successful, user:', signUpData.user.id);
      // The onAuthStateChange listener will handle setting the session, user, and loading the profile.
      // We might need a brief wait here for the trigger to run and profile to be created?
      // Or rely on the ProfileScreen logic to handle a potentially null profile initially.
      // Let's assume the listener handles it.

      // Clear local-only markers if desired, or keep them until profile is confirmed loaded
      // await AsyncStorage.removeItem('userPreferences');
      // await AsyncStorage.removeItem('userDisplayName');

      return { success: true, data: { user: signUpData.user } }; // Return Supabase user object

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
      // Reset onboarding state if needed for the flow.
      // setHasCompletedOnboarding(false); // Decide if sign out resets onboarding
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
     // Basic validation
     if (!newEmail || !newEmail.includes('@') || !password) {
        return { success: false, error: { message: 'Neue E-Mail und aktuelles Passwort benötigt.' } };
     }

     setLoading(true);
     try {
       // 1. Verify current password - Supabase doesn't have a direct verify method,
       // so we attempt a sign-in with the current email and provided password.
       // This is a workaround and not ideal.
       console.log('AuthContext: Verifying password before email change...');
       const { error: verifyError } = await supabase.auth.signInWithPassword({
         email: user.email,
         password: password,
       });

       if (verifyError) {
         console.error("AuthContext: Password verification failed:", verifyError);
         // Attempting to sign in again immediately might cause issues if the initial sign-in is still processing.
         // Re-sign in the user if verification 'failed' (as signIn logs them out on failure)
         // await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword }); // Requires storing currentPassword securely? Risky.
         // Best approach is to ask user to re-login or handle this flow differently.
         // For now, return error.
         return { success: false, error: { message: 'Aktuelles Passwort ist nicht korrekt.' } };
       }
       console.log("AuthContext: Password verified (via sign-in attempt).");


       // 2. Update email using Supabase Auth
       console.log('AuthContext: Attempting to update email via Supabase Auth...');
       const { data, error: updateError } = await supabase.auth.updateUser({
         email: newEmail
         // Password needs to be re-provided for email change confirmation usually,
         // but Supabase handles this via a confirmation email by default.
         // If `secure_email_change_enabled` is true (default), Supabase sends a confirmation email.
       });

       if (updateError) {
         console.error("AuthContext: Supabase updateUser (email) error:", updateError);
         return { success: false, error: { message: updateError.message || 'E-Mail konnte nicht geändert werden.' } };
       }

       console.log("AuthContext: Email update initiated successfully. Check email for confirmation.", data);
       // The user object in state will update automatically via onAuthStateChange *after* confirmation.
       // Inform the user they need to confirm via email.
       return { success: true, needsConfirmation: true };

     } catch (error) {
       console.error("AuthContext: Unexpected error updating email:", error);
       return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
     } finally {
       setLoading(false);
       // Re-sign in the user after password verification attempt? Complex due to potential state changes.
       // Best to rely on the existing session or prompt re-login if needed.
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

      setLoading(true);
      try {
          console.log('AuthContext: Attempting password update via Supabase Auth...');
          const { data, error } = await supabase.auth.updateUser({
              password: newPassword
          });

          if (error) {
              console.error("AuthContext: Supabase updateUser (password) error:", error);
              // Supabase error might include "New password should be different from the old password."
              return { success: false, error: { message: error.message || 'Passwort konnte nicht geändert werden.' } };
          }

          console.log("AuthContext: Password updated successfully.", data);
          // User state remains the same, just password changed.
          return { success: true };

      } catch (error) {
          console.error("AuthContext: Unexpected error updating password:", error);
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