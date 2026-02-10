import React, { createContext, useState, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase'; // Assuming supabase client is setup here
import { useAuth } from './AuthContext'; // To potentially access user info
import { Buffer } from 'buffer'; // Import Buffer for base64 handling
import * as FileSystem from 'expo-file-system'; // Import FileSystem for reading image

// Create context
const OrganizationContext = createContext();

// Key for storing active organization ID in AsyncStorage
const ACTIVE_ORG_STORAGE_KEY = 'activeOrganizationId';

// --- State Machine Types ---
// mode: 'personal' | 'switching' | 'org'
const ORG_MODES = {
  PERSONAL: 'personal',
  SWITCHING: 'switching',
  ORG: 'org',
};

// Reducer action types
const ORG_ACTIONS = {
  START_SWITCH: 'START_SWITCH',
  SWITCH_SUCCESS: 'SWITCH_SUCCESS',
  SWITCH_FAIL: 'SWITCH_FAIL',
  CLEAR_TO_PERSONAL: 'CLEAR_TO_PERSONAL',
  UPDATE_ORG_DETAILS: 'UPDATE_ORG_DETAILS',
  SET_ERROR: 'SET_ERROR',
  START_MUTATION: 'START_MUTATION',
  END_MUTATION: 'END_MUTATION',
};

// Initial state
const initialOrgState = {
  mode: ORG_MODES.PERSONAL,
  activeOrgId: null,
  activeOrg: null,
  error: null,
  switchRequestId: null, // Nonce for guarding stale async results
  pendingMutations: 0, // Counter for ongoing mutation operations
};

// Reducer function
const orgReducer = (state, action) => {
  switch (action.type) {
    case ORG_ACTIONS.START_SWITCH:
      return {
        ...state,
        mode: ORG_MODES.SWITCHING,
        error: null,
        switchRequestId: action.requestId,
      };
    case ORG_ACTIONS.SWITCH_SUCCESS:
      // Guard: only accept if requestId matches (latest request wins)
      if (state.switchRequestId !== action.requestId) {
        // console.log(`OrgReducer: Ignoring stale SWITCH_SUCCESS (expected ${state.switchRequestId}, got ${action.requestId})`);
        return state;
      }
      return {
        ...state,
        mode: action.orgData ? ORG_MODES.ORG : ORG_MODES.PERSONAL,
        activeOrgId: action.orgId,
        activeOrg: action.orgData,
        error: null,
        switchRequestId: null,
      };
    case ORG_ACTIONS.SWITCH_FAIL:
      // Guard: only accept if requestId matches
      if (state.switchRequestId !== action.requestId) {
        // console.log(`OrgReducer: Ignoring stale SWITCH_FAIL (expected ${state.switchRequestId}, got ${action.requestId})`);
        return state;
      }
      return {
        ...state,
        mode: ORG_MODES.PERSONAL,
        activeOrgId: null,
        activeOrg: null,
        error: action.error,
        switchRequestId: null,
      };
    case ORG_ACTIONS.CLEAR_TO_PERSONAL:
      return {
        ...state,
        mode: ORG_MODES.PERSONAL,
        activeOrgId: null,
        activeOrg: null,
        error: null,
        switchRequestId: null,
      };
    case ORG_ACTIONS.UPDATE_ORG_DETAILS:
      // Only update if we're in org mode and IDs match
      if (state.mode !== ORG_MODES.ORG || state.activeOrgId !== action.orgId) {
        return state;
      }
      return {
        ...state,
        activeOrg: { ...state.activeOrg, ...action.updates },
      };
    case ORG_ACTIONS.SET_ERROR:
      return { ...state, error: action.error };
    case ORG_ACTIONS.START_MUTATION:
      return { ...state, pendingMutations: state.pendingMutations + 1 };
    case ORG_ACTIONS.END_MUTATION:
      return { ...state, pendingMutations: Math.max(0, state.pendingMutations - 1) };
    default:
      return state;
  }
};

// Provider component
export const OrganizationProvider = ({ children }) => {
  // Use reducer for core org state
  const [orgState, dispatch] = useReducer(orgReducer, initialOrgState);
  
  // Separate loading states for specific operations (not switching)
  const [loadingOrgLogo, setLoadingOrgLogo] = useState(false);
  const [loadingOrgAboutMe, setLoadingOrgAboutMe] = useState(false);
  
  // Track if initial load is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Organization members state (centralized with race-safety)
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const membersRequestIdRef = useRef(null);
  
  // Request ID counter ref for generating unique nonces
  const requestIdCounter = useRef(0);
  const generateRequestId = useCallback(() => {
    requestIdCounter.current += 1;
    return `switch-${Date.now()}-${requestIdCounter.current}`;
  }, []);
  
  const {
      user,
      userOrganizations,
      refreshCurrentUserProfile, // Safe parameterless refresh
      patchUserOrganization, // Local org patching
      removeUserOrganization, // Local org removal
  } = useAuth(); // Get user status, userOrganizations and org patching functions
  
  // Derived values for backward compatibility
  const activeOrganizationId = orgState.activeOrgId;
  const activeOrganization = orgState.activeOrg;
  const isOrganizationActive = orgState.mode === ORG_MODES.ORG;
  // isLoading: true during initial load OR when switching
  const isLoading = !initialLoadComplete || orgState.mode === ORG_MODES.SWITCHING;
  // isMutating: true when any mutation operation is in progress
  const isMutating = orgState.pendingMutations > 0;

  // Effect to log changes in userOrganizations (for debugging the trigger)
  useEffect(() => {
    // REMOVED THE AUTOMATIC SWITCH LOGIC - Let UI handle redirection
    if (user && initialLoadComplete) { 
        // console.log('OrgContext: Detected change in userOrganizations:', userOrganizations);
        // NO LONGER attempting switchOrganizationContext(null) from here
    }
    // Keep dependencies
  }, [userOrganizations, user, activeOrganizationId, initialLoadComplete]);

  // Update activeOrganization state on role change (via reducer)
  useEffect(() => {
    // Only run if a user is logged in, an org is active, and we have the lists
    if (user && activeOrganizationId && activeOrganization && userOrganizations) {
        // Find the membership details for the *currently logged-in user* in the *active organization*
        const updatedOrgMembershipForCurrentUser = userOrganizations.find(
            org => org.id === activeOrganizationId // Match the active org ID
        );
        
        const newRoleForCurrentUser = updatedOrgMembershipForCurrentUser?.role;
        
        // Update the activeOrganization state ONLY if the *current user's* role has changed
        if (newRoleForCurrentUser && newRoleForCurrentUser !== activeOrganization.currentUserRole) {
            // console.log(`OrgContext: Detected role change for CURRENT USER (${user.id}) in active org ${activeOrganizationId}. Updating role from ${activeOrganization.currentUserRole} to ${newRoleForCurrentUser}.`);
            dispatch({
                type: ORG_ACTIONS.UPDATE_ORG_DETAILS,
                orgId: activeOrganizationId,
                updates: {
                    currentUserRole: newRoleForCurrentUser,
                    // All members can see invite code now
                },
            });
        }
    }
  }, [userOrganizations, activeOrganizationId, user, activeOrganization]); 

  // Load active organization from storage on mount
  useEffect(() => {
    const loadActiveOrg = async () => {
      try {
        const storedOrgId = await AsyncStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
        if (storedOrgId) {
          // Fetch full organization details if an ID was stored
          await switchOrganizationContext(storedOrgId);
        } else {
          dispatch({ type: ORG_ACTIONS.CLEAR_TO_PERSONAL });
        }
      } catch (error) {
        console.error("Error loading active organization:", error);
        dispatch({ type: ORG_ACTIONS.CLEAR_TO_PERSONAL });
      } finally {
        setInitialLoadComplete(true);
      }
    };

    if (user) { // Only load if user is logged in
        loadActiveOrg();
    } else {
        // Clear active org if user logs out
        dispatch({ type: ORG_ACTIONS.CLEAR_TO_PERSONAL });
        AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        setInitialLoadComplete(true);
    }
  }, [user]); // Rerun when user logs in or out

  // Function to switch the active organization context (uses reducer with request ID guard)
  const switchOrganizationContext = async (organizationId) => {
    const requestId = generateRequestId();
    // console.log(`%%%% OrgContext: switchOrganizationContext CALLED with ID: ${organizationId}, requestId: ${requestId} %%%%`);

    // Signal that we're starting a switch
    dispatch({ type: ORG_ACTIONS.START_SWITCH, requestId });

    // Ensure 'user' is accessible here.
    if (!user) {
        console.error(`OrgContext: [${requestId}] Cannot switch context - User is not logged in.`);
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        dispatch({ type: ORG_ACTIONS.SWITCH_FAIL, requestId, error: 'User not logged in.' });
        return { success: false, error: 'User not logged in.' };
    }
    // console.log(`OrgContext: [${requestId}] Current logged in user ID: ${user.id}`);

    try {
      if (!organizationId) {
        // Switching back to personal context
        // console.log(`OrgContext: [${requestId}] Switching back to personal context.`);
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        dispatch({ type: ORG_ACTIONS.SWITCH_SUCCESS, requestId, orgId: null, orgData: null });
        // console.log(`OrgContext: [${requestId}] Successfully switched back to personal context.`);
        return { success: true };
      }
      
      // Fetch organization details from Supabase
      // console.log(`OrgContext: [${requestId}] Fetching details for organization ID: ${organizationId}`);
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, logo_url, invite_code, admin_id, about_me')
        .eq('id', organizationId)
        .maybeSingle();

      if (error) {
        console.error(`OrgContext: [${requestId}] Error fetching organization details for ID ${organizationId}:`, error);
        throw new Error(`Error fetching organization details: ${error.message}`);
      }

      // console.log(`OrgContext: [${requestId}] Fetched org details result for ID ${organizationId}:`, data);

      if (data) {
         // console.log(`OrgContext: [${requestId}] Checking membership for user ${user?.id} in organization ${organizationId}...`);
         const { data: memberData, error: memberError } = await supabase
           .from('organization_members')
           .select('role')
           .eq('organization_id', organizationId)
           .eq('user_id', user?.id)
           .maybeSingle();

         if (memberError) {
             console.error(`OrgContext: [${requestId}] Error checking membership for user ${user?.id} in org ${organizationId}:`, memberError);
             throw new Error(`Error checking membership: ${memberError.message}`);
         }

         // console.log(`OrgContext: [${requestId}] Membership check result for user ${user?.id} in org ${organizationId}:`, memberData);

         if (!memberData) {
             console.warn(`OrgContext: [${requestId}] User ${user?.id} is NOT a member of organization ${organizationId}. Cannot switch context.`);
             await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
             dispatch({ type: ORG_ACTIONS.SWITCH_FAIL, requestId, error: 'User is not a member of this organization.' });
             return { success: false, error: 'User is not a member of this organization.' };
         }

         // console.log(`OrgContext: [${requestId}] User ${user?.id} IS a member (Role: ${memberData.role}). Proceeding with switch to org ${organizationId}.`);
         const orgDetails = {
             ...data,
             invite_code: data.invite_code, // All members can see invite code
             currentUserRole: memberData.role,
             about_me: data.about_me,
         };

        // Persist to storage
        await AsyncStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId);
        
        // Dispatch success - the reducer will guard against stale results
        dispatch({ type: ORG_ACTIONS.SWITCH_SUCCESS, requestId, orgId: organizationId, orgData: orgDetails });
        // console.log(`OrgContext: [${requestId}] Successfully switched context to organization:`, orgDetails);
        return { success: true, data: orgDetails };
      } else {
        console.warn(`OrgContext: [${requestId}] Organization ${organizationId} not found or access denied by RLS.`);
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        dispatch({ type: ORG_ACTIONS.SWITCH_FAIL, requestId, error: 'Organization not found or access denied.' });
        return { success: false, error: 'Organization not found or access denied.' };
      }
    } catch (error) {
       console.error(`OrgContext: [${requestId}] Unexpected error in switchOrganizationContext:`, error);
       await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
       dispatch({ type: ORG_ACTIONS.SWITCH_FAIL, requestId, error: error.message || 'Failed to switch organization.' });
       return { success: false, error: error.message || 'Failed to switch organization.' };
    }
    // Note: No finally block needed - reducer handles state transitions atomically
  };

  // Function to delete an organization (admin only)
  const deleteOrganization = async (organizationId) => {
    dispatch({ type: ORG_ACTIONS.START_MUTATION });
    // console.log(`OrgContext: Starting deleteOrganization for ID: ${organizationId}`);

    if (!user) {
      console.error("OrgContext: Cannot delete organization - User is not logged in.");
      dispatch({ type: ORG_ACTIONS.END_MUTATION });
      return { success: false, error: 'User not logged in.' };
    }

    try {
      // Check if user is an admin of the organization
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) {
        console.error("Error checking admin status:", memberError);
        throw new Error(`Error checking admin status: ${memberError.message}`);
      }

      if (!memberData || memberData.role !== 'admin') {
        console.error("User is not an admin of this organization");
        return { success: false, error: 'Only admins can delete organizations.' };
      }

      // The organization is deleted via a DELETE operation
      // RLS policies will ensure only admins can delete
      const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      if (deleteError) {
        console.error("Error deleting organization:", deleteError);
        throw new Error(`Failed to delete organization: ${deleteError.message}`);
      }

      // Clear active organization if it was the one deleted
      if (activeOrganizationId === organizationId) {
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        dispatch({ type: ORG_ACTIONS.CLEAR_TO_PERSONAL });
      }
      
      // Remove org from local list instead of full refetch
      removeUserOrganization(organizationId);
      // console.log("Removed organization from local list after deletion");

      // console.log(`OrgContext: Successfully deleted organization: ${organizationId}`);
      return { success: true };
    } catch (error) {
      console.error("Unexpected error in deleteOrganization:", error);
      return { success: false, error: error.message || 'Failed to delete organization.' };
    } finally {
      dispatch({ type: ORG_ACTIONS.END_MUTATION });
    }
  };

  // --- NEW: Function to update Organization Logo ---
  const updateOrganizationLogo = async (organizationId, imageUri) => {
    if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
    if (!organizationId) return { success: false, error: { message: 'Organisations-ID fehlt.' } };
    if (!imageUri) return { success: false, error: { message: 'Kein Bild ausgewählt.' } };

    setLoadingOrgLogo(true);
    const timestamp = Date.now();
    // console.log(`[${timestamp}] OrgContext: Starting logo upload for org ${organizationId}. Image URI: ${imageUri}`);

    try {
      // Verify user is a member of this organization (RLS handles authorization)
      const orgMembership = userOrganizations.find(org => org.id === organizationId);
      if (!orgMembership) {
          return { success: false, error: { message: 'Du bist kein Mitglied dieser Organisation.'}};
      }

      // Determine file extension and path
      const fileExt = imageUri.split('.').pop() || 'png'; // Default to png if extension missing
      const fileName = `${organizationId}.${fileExt}`; // Simple filename: ORG_ID.EXT
      const filePath = `public/${fileName}`; // Store in public folder within profile_images bucket
      const fileType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      // Read file as base64
      // console.log(`[${timestamp}] OrgContext: Reading image file as base64...`);
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // console.log(`[${timestamp}] OrgContext: Image read. Uploading to storage... Path: ${filePath}, Type: ${fileType}`);

      // Upload to Supabase Storage (use profile_images bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile_images') // Use the profile_images bucket as requested
        .upload(filePath, Buffer.from(base64, 'base64'), {
          contentType: fileType,
          cacheControl: '3600', // Cache for 1 hour
          upsert: true, // Overwrite if a file with the same *exact* path exists (timestamp helps avoid this unless rapid uploads)
        });

      if (uploadError) {
        console.error(`[${timestamp}] OrgContext: Supabase storage upload error for org ${organizationId}:`, uploadError);
        return { success: false, error: { message: uploadError.message || 'Fehler beim Hochladen des Logos.' } };
      }

      // console.log(`[${timestamp}] OrgContext: Storage upload successful for org ${organizationId}:`, uploadData);

      // Construct the public URL manually
      const storageBaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!storageBaseUrl) {
          console.error(`[${timestamp}] OrgContext: EXPO_PUBLIC_SUPABASE_URL is not defined!`);
          return { success: false, error: { message: 'Server-Konfigurationsfehler.' } };
      }
      const imageUrlPath = uploadData?.path ?? filePath;
      // Add timestamp query param to help bypass cache after update
      const publicUrl = `${storageBaseUrl}/storage/v1/object/public/profile_images/${imageUrlPath}?t=${new Date().getTime()}`;

      // console.log(`[${timestamp}] OrgContext: Generated public URL for org ${organizationId}:`, publicUrl);

      // Update the logo_url in the organizations table
      // console.log(`[${timestamp}] OrgContext: Updating organizations table with logo_url for org ${organizationId}`);
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl, updated_at: new Date() })
        .eq('id', organizationId);

      if (dbError) {
        console.error(`[${timestamp}] OrgContext: Error updating organizations table logo_url for org ${organizationId}:`, dbError);
        // Attempt to delete the uploaded image if DB update fails? Consider implications.
        // await supabase.storage.from('profile_images').remove([filePath]);
        return { success: false, error: { message: dbError.message || 'Fehler beim Speichern des Logo-Links.' } };
      }

      // console.log(`[${timestamp}] OrgContext: Organization logo_url updated successfully for org ${organizationId}.`);

      // Update local activeOrganization state immediately if this is the active org via reducer
      if (activeOrganizationId === organizationId) {
         dispatch({
             type: ORG_ACTIONS.UPDATE_ORG_DETAILS,
             orgId: organizationId,
             updates: { logo_url: publicUrl },
         });
         // console.log(`[${timestamp}] OrgContext: Updated activeOrganization state with new logo_url.`);
      }

      // Patch user's org list locally instead of full refetch
      patchUserOrganization(organizationId, { logo_url: publicUrl });
      // console.log(`[${timestamp}] OrgContext: Patched org logo_url locally.`);

      return { success: true, data: { logoUrl: publicUrl } };

    } catch (error) {
      console.error(`[${timestamp}] OrgContext: Unexpected error in updateOrganizationLogo for org ${organizationId}:`, error);
      return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
      setLoadingOrgLogo(false);
      // console.log(`[${timestamp}] OrgContext: Finished updateOrganizationLogo for org ${organizationId}. loadingOrgLogo set to false.`);
    }
  };

  // --- Organization Management Functions ---
  
  // Race-safe member fetching - stores in context state
  const fetchOrganizationMembers = useCallback(async (organizationId) => {
      if (!organizationId) {
          setOrganizationMembers([]);
          return { success: false, error: { message: 'Organisations-ID benötigt.' } };
      }
      
      // Generate unique request ID for race-safety
      const requestId = `members-${Date.now()}-${Math.random()}`;
      membersRequestIdRef.current = requestId;
      
      setLoadingMembers(true);
      setMembersError(null);
      
      // console.log(`[OrgContext] Fetching members for org ID: ${organizationId}, requestId: ${requestId}`);
      try {
          const { data, error } = await supabase.rpc('get_organization_members_with_names', {
              p_organization_id: organizationId
          });
          
          // Guard against stale results
          if (membersRequestIdRef.current !== requestId) {
              // console.log(`[OrgContext] Ignoring stale members result (expected ${membersRequestIdRef.current}, got ${requestId})`);
              return { success: false, error: { message: 'Request superseded by newer request.' } };
          }
          
          if (error) {
              console.error("OrgContext: Error calling get_organization_members_with_names RPC:", error);
              setMembersError(error.message || 'Fehler beim Laden der Mitglieder.');
              return { success: false, error: { message: error.message || 'Fehler beim Laden der Mitglieder.' } };
          }
          
          const memberData = data ?? [];
          // console.log(`[OrgContext] Member data received from RPC for org ${organizationId}:`, memberData);
          setOrganizationMembers(memberData);
          return { success: true, data: memberData };
      } catch (error) {
          // Guard against stale results in catch block too
          if (membersRequestIdRef.current !== requestId) {
              return { success: false, error: { message: 'Request superseded by newer request.' } };
          }
          console.error("OrgContext: Unexpected error fetching members:", error);
          setMembersError('Ein unerwarteter Fehler ist aufgetreten.');
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          // Only clear loading if this is still the latest request
          if (membersRequestIdRef.current === requestId) {
              setLoadingMembers(false);
          }
      }
  }, []);
  
  // Clear members when switching away from org context
  useEffect(() => {
      if (!isOrganizationActive) {
          setOrganizationMembers([]);
          setMembersError(null);
          membersRequestIdRef.current = null;
      }
  }, [isOrganizationActive]);
  
  // Auto-fetch members when org becomes active
  useEffect(() => {
      if (isOrganizationActive && activeOrganizationId && user) {
          fetchOrganizationMembers(activeOrganizationId);
      }
  }, [isOrganizationActive, activeOrganizationId, user, fetchOrganizationMembers]);

  const updateOrganizationDetails = async (organizationId, details) => {
       if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } }; // Check user
       if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
       // RLS Policy "Allow admin to manage their organization" should handle authz
       
       // Dynamically build the update object
       const updatePayload = { updated_at: new Date() };
       if (details.hasOwnProperty('name')) {
           updatePayload.name = details.name;
       }
       if (details.hasOwnProperty('about_me')) {
           updatePayload.about_me = details.about_me;
       }

       // If no fields to update besides timestamp, return early (or decide if timestamp update is desired)
       if (Object.keys(updatePayload).length <= 1) {
           // console.log("OrgContext: No fields to update in updateOrganizationDetails.");
           return { success: true, data: activeOrganization }; // Nothing changed, return current data
       }

       dispatch({ type: ORG_ACTIONS.START_MUTATION });
       try {
            const { data, error } = await supabase
                .from('organizations')
                .update(updatePayload) // Use the dynamic payload
                .eq('id', organizationId)
                .select('id, name, about_me') // Select updated data including about_me
                .single();

            if (error) {
                console.error("OrgContext: Error updating organization details:", error);
                const message = error.message.includes('duplicate key value violates unique constraint')
                    ? 'Eine Organisation mit diesem Namen existiert bereits.'
                    : error.message.includes('permission denied')
                    ? 'Berechtigung verweigert. Nur Admins können die Details ändern.'
                    : error.message || 'Fehler beim Aktualisieren der Details.';
                return { success: false, error: { message } };
            }
            
            // If the active org was updated, update via reducer
            if(activeOrganizationId === organizationId) {
                dispatch({
                    type: ORG_ACTIONS.UPDATE_ORG_DETAILS,
                    orgId: organizationId,
                    updates: data,
                });
            }
            // Patch user's org list locally if name changed (about_me not in org list)
            if (data.name) {
                patchUserOrganization(organizationId, { name: data.name });
            }

            return { success: true, data };

       } catch (error) {
           console.error("OrgContext: Unexpected error updating org details:", error);
           return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
       } finally {
           dispatch({ type: ORG_ACTIONS.END_MUTATION });
       }
  };

  const updateOrganizationName = async (organizationId, newName) => {
    if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
    if (!organizationId) return { success: false, error: { message: 'Organisations-ID benötigt.' } };
    if (!newName || newName.trim() === '') return { success: false, error: { message: 'Organisationsname darf nicht leer sein.' } };

    dispatch({ type: ORG_ACTIONS.START_MUTATION });
    try {
        // console.log(`OrgContext: Attempting to update name for org ${organizationId} to "${newName.trim()}" by admin ${user.id}`);
        // RLS policy "Allow admin to manage their organization" handles authorization
        const { data, error } = await supabase
            .from('organizations')
            .update({ name: newName.trim(), updated_at: new Date() })
            .eq('id', organizationId)
            .select('id, name') // Select the updated data
            .single(); // Expect a single row back

        if (error) {
            console.error("OrgContext: Error updating organization name:", error);
            const message = error.message.includes('duplicate key value violates unique constraint')
                ? 'Eine Organisation mit diesem Namen existiert bereits.'
                : error.message.includes('permission denied')
                ? 'Berechtigung verweigert. Nur Admins können den Namen ändern.'
                : error.message || 'Fehler beim Aktualisieren des Namens.';
            return { success: false, error: { message } };
        }

        // console.log(`OrgContext: Successfully updated org name to "${data.name}"`);
        // Refresh the active org state if this is the active org via reducer
        if (activeOrganizationId === organizationId) {
            dispatch({
                type: ORG_ACTIONS.UPDATE_ORG_DETAILS,
                orgId: organizationId,
                updates: { name: data.name },
            });
        }
        // Patch user's org list locally instead of full refetch
        patchUserOrganization(organizationId, { name: data.name });
        
        return { success: true, data };

    } catch (error) {
        console.error("OrgContext: Unexpected error updating org name:", error);
        return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
        dispatch({ type: ORG_ACTIONS.END_MUTATION });
    }
  };

  const removeOrganizationMember = async (organizationId, memberUserId) => {
    if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
    if (!organizationId || !memberUserId) return { success: false, error: { message: 'Organisations- und Mitglieds-ID benötigt.' } };
    if (memberUserId === user.id) return { success: false, error: { message: 'Du kannst dich nicht selbst entfernen.'}}; // Prevent self-removal via this function

    dispatch({ type: ORG_ACTIONS.START_MUTATION });
    try {
        // console.log(`OrgContext: Attempting to remove member ${memberUserId} from org ${organizationId} by admin ${user.id}`);
        // RLS policy "prevent_last_admin_leave_or_remove_others" handles authorization
        const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('organization_id', organizationId)
            .eq('user_id', memberUserId);

        if (error) {
            console.error("OrgContext: Error removing member:", error);
            const message = error.message.includes('permission denied')
              ? 'Berechtigung verweigert. Nur Admins können Mitglieder entfernen.'
              : error.message || 'Fehler beim Entfernen des Mitglieds.';
            return { success: false, error: { message } };
        }

        // console.log(`OrgContext: Successfully removed member ${memberUserId} from org ${organizationId}`);
        // ProfileScreen will need to refetch members after this succeeds using fetchOrganizationMembers
        return { success: true };

    } catch (error) {
        console.error("OrgContext: Unexpected error removing member:", error);
        return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
        dispatch({ type: ORG_ACTIONS.END_MUTATION });
    }
  };

  const transferOrganizationAdmin = async (organizationId, newAdminUserId) => {
    if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
    if (!organizationId || !newAdminUserId) return { success: false, error: { message: 'Organisations- und neue Admin-ID benötigt.' } };

    dispatch({ type: ORG_ACTIONS.START_MUTATION });
    try {
      // console.log(`OrgContext: Attempting to transfer admin role in org ${organizationId} to user ${newAdminUserId} by current admin ${user.id}`);
      const { data, error } = await supabase.rpc('set_organization_admin', {
        p_organization_id: organizationId,
        p_new_admin_user_id: newAdminUserId
      });

      if (error) {
        console.error("OrgContext: Error calling set_organization_admin RPC:", error);
        return { success: false, error: { message: error.message || 'Fehler bei der Admin-Übertragung.' } };
      }

      if (data === false) { // RPC returns false on internal error
        console.warn("OrgContext: set_organization_admin RPC returned false.");
        return { success: false, error: { message: 'Admin-Übertragung fehlgeschlagen (RPC).' } };
      }

      // console.log(`OrgContext: Successfully transferred admin role in org ${organizationId} to user ${newAdminUserId}`);
      // Patch the current user's role locally (they become 'member')
      patchUserOrganization(organizationId, { role: 'member' });
      
      // Refresh the active org state if this is the active org to update current user's role
       if (activeOrganizationId === organizationId) {
           // Update role locally via reducer + re-fetch to get new invite code state
           dispatch({
               type: ORG_ACTIONS.UPDATE_ORG_DETAILS,
               orgId: organizationId,
               updates: { currentUserRole: 'member' }, // Keep invite_code visible for all members
           });
       }
      // ProfileScreen will also need to refetch members to update roles visually
      return { success: true };

    } catch (error) {
        console.error("OrgContext: Unexpected error transferring admin role:", error);
        return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
    } finally {
        dispatch({ type: ORG_ACTIONS.END_MUTATION });
    }
  };

  // --- NEW: Function to update Organization About Me ---
  const updateOrganizationAboutMe = async (organizationId, newAboutMe) => {
      if (!user) return { success: false, error: { message: 'Nicht angemeldet.' } };
      if (!organizationId) return { success: false, error: { message: 'Organisations-ID fehlt.' } };
      
      // Basic check for empty string, allow empty/null to clear it
      const aboutMeToSave = newAboutMe?.trim() ?? null; 

      setLoadingOrgAboutMe(true);
      const timestamp = Date.now();
      // console.log(`[${timestamp}] OrgContext: Starting about_me update for org ${organizationId}.`);

      try {
          // RLS policy "Allow admin to manage their organization" should handle authorization
          const { data, error } = await supabase
              .from('organizations')
              .update({ about_me: aboutMeToSave, updated_at: new Date() })
              .eq('id', organizationId)
              .select('id, about_me') // Select updated data
              .single(); // Expect single row

          if (error) {
              console.error(`[${timestamp}] OrgContext: Error updating organization about_me for org ${organizationId}:`, error);
              const message = error.message.includes('permission denied')
                  ? 'Berechtigung verweigert. Nur Admins können die Beschreibung ändern.'
                  : error.message || 'Fehler beim Aktualisieren der Beschreibung.';
              return { success: false, error: { message } };
          }

          // console.log(`[${timestamp}] OrgContext: Successfully updated org about_me for org ${organizationId}.`);

          // Update local activeOrganization state if this is the active org via reducer
          if (activeOrganizationId === organizationId) {
              dispatch({
                  type: ORG_ACTIONS.UPDATE_ORG_DETAILS,
                  orgId: organizationId,
                  updates: { about_me: data.about_me },
              });
              // console.log(`[${timestamp}] OrgContext: Updated activeOrganization state with new about_me.`);
          }
          // Note: about_me is not stored in userOrganizations list, no patching needed

          return { success: true, data: { aboutMe: data.about_me } };

      } catch (error) {
          console.error(`[${timestamp}] OrgContext: Unexpected error in updateOrganizationAboutMe for org ${organizationId}:`, error);
          return { success: false, error: { message: 'Ein unerwarteter Fehler ist aufgetreten.' } };
      } finally {
          setLoadingOrgAboutMe(false);
          // console.log(`[${timestamp}] OrgContext: Finished updateOrganizationAboutMe for org ${organizationId}. loadingOrgAboutMe set to false.`);
      }
  };
  // --- END NEW FUNCTION ---

  return (
    <OrganizationContext.Provider
        value={{
            // Core state (derived from reducer)
            activeOrganizationId,
            activeOrganization, // Provide full details
            isLoading, // True during initial load or switching
            isOrganizationActive, // True when mode is 'org'
            isMutating, // True when pendingMutations > 0
            orgError: orgState.error, // Expose error state
            
            // Actions
            switchOrganizationContext,
            deleteOrganization,
            
            // Member management (centralized, race-safe)
            organizationMembers, // Current members list
            loadingMembers, // Members loading state
            membersError, // Members error state
            fetchOrganizationMembers, // Manual refetch
            removeOrganizationMember,
            transferOrganizationAdmin,
            
            // Organization details management
            updateOrganizationDetails,
            updateOrganizationName,
            updateOrganizationLogo,
            loadingOrgLogo,
            updateOrganizationAboutMe,
            loadingOrgAboutMe,
        }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

// Custom hook to use the context
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

// Default export might not be needed if only using the hook
// export default OrganizationContext; 