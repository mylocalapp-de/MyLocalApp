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
        console.log(`AuthContext: Auth state changed event: ${_event}`, newSession ? 'New session' : 'No session');
        
        const currentUser = newSession?.user ?? null;
        const currentUserId = currentUser?.id;
        const previousUserId = session?.user?.id;
        const userIdChanged = previousUserId !== currentUserId;

        console.log(`AuthContext: User ID check - Prev: ${previousUserId}, Curr: ${currentUserId}, Changed: ${userIdChanged}`);

        setSession(newSession);
        if (userIdChanged || _event !== 'USER_UPDATED') {
            console.log('AuthContext: Updating user state object.');
            setUser(currentUser);
        } else {
            console.log('AuthContext: Skipping user state object update for USER_UPDATED event.');
        }

        if (currentUser) {
          if (!previousUserId || userIdChanged) { // Set onboarding on first login or user change
             console.log('AuthContext: Setting onboarding complete status.');
             setHasCompletedOnboarding(true);
             await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
          }
          
          if (_event !== 'USER_UPDATED' || userIdChanged) {
            console.log('AuthContext: Loading profile & orgs due to event type or user change.');
            await loadUserProfileAndOrgs(currentUser.id);
          } else {
            console.log('AuthContext: Skipping profile/org reload for USER_UPDATED.');
            setLoadingProfile(false); // Ensure profile loading is false if skipped
          }

        } else {
          // User logged out
          setProfile(null);
          setUserOrganizations([]); // Clear orgs on logout
          // Keep local displayName/preferences?
          // Onboarding is reset in signOut explicitly
          setLoadingProfile(false); // No user, profile/org loading is done
        }
        setLoadingAuth(false); // Auth state processing finished
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
    if (!userId) {
      setProfile(null);
      setUserOrganizations([]);
      setLoadingProfile(false);
      return;
    }
    console.log('AuthContext: Loading profile & orgs for user ID:', userId);
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
        console.error('AuthContext: Error loading user profile:', profileResult.error);
        setProfile(null);
      } else if (profileResult.data) {
        console.log('AuthContext: Profile loaded:', profileResult.data);
        setProfile(profileResult.data);
        if (profileResult.data.display_name) setDisplayName(profileResult.data.display_name);
        if (profileResult.data.preferences) setPreferences(profileResult.data.preferences);
        await AsyncStorage.setItem('userDisplayName', profileResult.data.display_name || '');
        await AsyncStorage.setItem('userPreferences', JSON.stringify(profileResult.data.preferences || []));
      } else {
        console.log('AuthContext: No profile found for user.');
        setProfile(null);
      }

      // Handle organizations result
      if (orgsResult.error) {
        console.error('AuthContext: Error loading user organizations:', JSON.stringify(orgsResult.error, null, 2));
        setUserOrganizations([]);
      } else {
        const orgData = orgsResult.data || [];
        const formattedOrgs = orgData.map(org => ({
            id: org.id,
            name: org.name,
            role: org.organization_members[0]?.role || 'member'
        }));
        console.log('AuthContext: User organizations loaded (revised query):', formattedOrgs);
        setUserOrganizations(formattedOrgs);
      }

    } catch (error) {
      console.error("AuthContext: Unexpected error in loadUserProfileAndOrgs:", error);
      setProfile(null);
      setUserOrganizations([]);
    } finally {
      setLoadingProfile(false);
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
      // onAuthStateChange listener handles loading profile & orgs.
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
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } }; // Still check context user for initial guard
      if (!name || name.trim() === '') {
          return { success: false, error: { message: 'Organisationsname benötigt.' } };
      }
      setLoading(true);
      try {
          // Explicitly get the current authenticated user from Supabase NOW
          const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

          if (userError || !currentUser) {
              console.error("AuthContext: Error fetching current user before creating org:", userError);
              return { success: false, error: { message: 'Benutzer konnte nicht bestätigt werden. Bitte erneut anmelden.' } };
          }

          // Use the ID from the freshly fetched currentUser
          const { data: newOrg, error: insertError } = await supabase
              .from('organizations')
              .insert({ name: name.trim(), admin_id: currentUser.id }) // Use currentUser.id
              .select('id, name') // Select the needed fields from the result
              .single(); // Expect a single row back

          if (insertError) {
              console.error("AuthContext: Error inserting organization:", insertError);
              // Log the IDs for debugging if the error persists
              console.error(`Debug Info - Context User ID: ${user?.id}, CurrentUser ID: ${currentUser?.id}`);
              return { success: false, error: { message: insertError.message || 'Fehler beim Erstellen.' } };
          }

          // Trigger handle_new_organization adds the creator as admin member automatically
          console.log('AuthContext: Organization created:', newOrg);

          // Refetch user organizations to update the context state using the confirmed currentUser ID
          await loadUserProfileAndOrgs(currentUser.id);

          return { success: true, data: newOrg };

      } catch (error) {
          console.error("AuthContext: Unexpected error creating organization:", error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoading(false);
      }
  };

  const joinOrganizationByInviteCode = async (inviteCode) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (!inviteCode || inviteCode.trim() === '') {
           return { success: false, error: { message: 'Einladungscode benötigt.' } };
      }
      setLoading(true);
      try {
          // 1. Find the organization by invite code
          const { data: org, error: findError } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('invite_code', inviteCode.trim())
              .maybeSingle();

          if (findError) {
              console.error("AuthContext: Error finding organization by invite code:", findError);
              return { success: false, error: { message: findError.message || 'Fehler bei Codesuche.' } };
          }
          if (!org) {
              return { success: false, error: { message: 'Ungültiger oder abgelaufener Einladungscode.' } };
          }

          // 2. Add the user as a member
          const { error: joinError } = await supabase
              .from('organization_members')
              .insert({ organization_id: org.id, user_id: user.id, role: 'member' }); 
              // Use default role 'member'. ON CONFLICT DO NOTHING can be added in DB if preferred

          if (joinError) {
               // Handle potential duplicate entry if user is already a member
               if (joinError.code === '23505') { // Unique violation code
                   console.warn('AuthContext: User is already a member of this organization.');
                   // Refetch anyway to ensure state is up-to-date
                   await loadUserProfileAndOrgs(user.id);
                   return { success: true, data: org }; // Treat as success, already joined
               } else {
                   console.error("AuthContext: Error joining organization:", joinError);
                   return { success: false, error: { message: joinError.message || 'Fehler beim Beitreten.' } };
               }
          }
          
          console.log(`AuthContext: User ${user.id} joined organization ${org.name} (${org.id})`);
          
          // Refetch user organizations to update the context state
          await loadUserProfileAndOrgs(user.id);

          return { success: true, data: org };

      } catch (error) {
          console.error("AuthContext: Unexpected error joining organization:", error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoading(false);
      }
  };

  const leaveOrganization = async (organizationId) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
      
      // TODO: Add check - prevent last admin from leaving? Requires extra logic.
      // Example check (pseudo-code):
      // const { data: members, error: memberCheckErr } = await supabase.from...
      // if (members.length === 1 && members[0].role === 'admin') {
      //    return { success: false, error: { message: 'Letzter Admin kann Organisation nicht verlassen.' } };
      // }
      
      setLoading(true);
      try {
          const { error } = await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', organizationId)
              .eq('user_id', user.id);

          if (error) {
              console.error("AuthContext: Error leaving organization:", error);
              return { success: false, error: { message: error.message || 'Fehler beim Verlassen.' } };
          }
          
          console.log(`AuthContext: User ${user.id} left organization ${organizationId}`);
          
          // Refetch user organizations
          await loadUserProfileAndOrgs(user.id);
          
          // Check if the left org was the active one - handled by OrganizationContext via user change?
          // Let OrganizationContext handle clearing active state if needed based on userOrganizations change.
          
          return { success: true };

      } catch (error) {
          console.error("AuthContext: Unexpected error leaving organization:", error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoading(false);
      }
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