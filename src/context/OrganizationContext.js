import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase'; // Assuming supabase client is setup here
import { useAuth } from './AuthContext'; // To potentially access user info

// Create context
const OrganizationContext = createContext();

// Key for storing active organization ID in AsyncStorage
const ACTIVE_ORG_STORAGE_KEY = 'activeOrganizationId';

// Provider component
export const OrganizationProvider = ({ children }) => {
  const [activeOrganizationId, setActiveOrganizationId] = useState(null);
  const [activeOrganization, setActiveOrganization] = useState(null); // Store full org details
  const [isLoading, setIsLoading] = useState(true);
  const {
      user,
      userOrganizations,
      loadUserProfile,
      removeOrganizationMember, // Get from AuthContext
      transferOrganizationAdmin // Get from AuthContext
  } = useAuth(); // Get user status, userOrganizations and loadUserProfile function

  // Effect to log changes in userOrganizations (for debugging the trigger)
  useEffect(() => {
    // REMOVED THE AUTOMATIC SWITCH LOGIC - Let UI handle redirection
    if (user && !isLoading) { 
        console.log('OrgContext: Detected change in userOrganizations:', userOrganizations);
        // NO LONGER attempting switchOrganizationContext(null) from here
    }
    // Keep dependencies
  }, [userOrganizations, user, activeOrganizationId, isLoading]);

  // <<< NEW useEffect to update activeOrganization state on role change >>>
  useEffect(() => {
    // Only run if a user is logged in, an org is active, and we have the lists
    if (user && activeOrganizationId && activeOrganization && userOrganizations) {
        // Find the membership details for the *currently logged-in user* in the *active organization*
        const updatedOrgMembershipForCurrentUser = userOrganizations.find(
            org => org.id === activeOrganizationId // Match the active org ID
            // No user ID check needed here, userOrganizations is already filtered by AuthContext for the logged-in user
        );
        
        const newRoleForCurrentUser = updatedOrgMembershipForCurrentUser?.role;
        
        // console.log(`OrgContext Check: Active Org ID: ${activeOrganizationId}, Current User: ${user.id}, Current Role in State: ${activeOrganization.currentUserRole}, New Role from userOrgs for this user: ${newRoleForCurrentUser}`);
        
        // Update the activeOrganization state ONLY if the *current user's* role has changed
        if (newRoleForCurrentUser && newRoleForCurrentUser !== activeOrganization.currentUserRole) {
            console.log(`OrgContext: Detected role change for CURRENT USER (${user.id}) in active org ${activeOrganizationId}. Updating role from ${activeOrganization.currentUserRole} to ${newRoleForCurrentUser}.`);
            setActiveOrganization(prev => {
                if (!prev) return null; // Safety check
                return {
                    ...prev,
                    currentUserRole: newRoleForCurrentUser,
                    // Re-evaluate invite code visibility based on the current user's new role
                    invite_code: newRoleForCurrentUser === 'admin' ? prev.invite_code : null 
                };
            });
        }
    }
    // Depend on userOrganizations, activeOrganizationId, and user object (to get user.id)
    // Also depend on activeOrganization itself to prevent potential stale closures, though the primary trigger is userOrganizations
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
          setActiveOrganizationId(null);
          setActiveOrganization(null);
        }
      } catch (error) {
        console.error("Error loading active organization:", error);
        // Handle error appropriately, maybe clear state
        setActiveOrganizationId(null);
        setActiveOrganization(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) { // Only load if user is logged in
        loadActiveOrg();
    } else {
        // Clear active org if user logs out
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        setIsLoading(false);
    }
  }, [user]); // Rerun when user logs in or out

  // Function to switch the active organization context
  const switchOrganizationContext = async (organizationId) => {
    // **** ADDED SIMPLE LOG - RE-APPLYING ****
    console.log(`%%%% OrgContext: switchOrganizationContext CALLED with ID: ${organizationId} %%%%`);

    setIsLoading(true);
    const switchTimestamp = Date.now();
    console.log(`OrgContext: [${switchTimestamp}] START switchOrganizationContext - Target Org ID: ${organizationId}`);

    // Ensure 'user' is accessible here.
    if (!user) {
        console.error(`OrgContext: [${switchTimestamp}] Cannot switch context - User is not logged in.`);
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        setIsLoading(false);
        console.log(`OrgContext: [${switchTimestamp}] END switchOrganizationContext (No user logged in).`);
        return { success: false, error: 'User not logged in.' };
    }
    console.log(`OrgContext: [${switchTimestamp}] Current logged in user ID: ${user.id}`);

    try {
      if (!organizationId) {
        // Switching back to personal context
        console.log(`OrgContext: [${switchTimestamp}] Switching back to personal context.`);
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        console.log(`OrgContext: [${switchTimestamp}] Successfully switched back to personal context. State cleared.`);
      } else {
        // Fetch organization details from Supabase
        console.log(`OrgContext: [${switchTimestamp}] Fetching details for organization ID: ${organizationId}`);
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, logo_url, invite_code, admin_id')
          .eq('id', organizationId)
          .maybeSingle();

        if (error) {
          console.error(`OrgContext: [${switchTimestamp}] Error fetching organization details for ID ${organizationId}:`, error);
          throw new Error(`Error fetching organization details: ${error.message}`);
        }

        console.log(`OrgContext: [${switchTimestamp}] Fetched org details result for ID ${organizationId}:`, data);

        if (data) {
           console.log(`OrgContext: [${switchTimestamp}] Checking membership for user ${user?.id} in organization ${organizationId}...`);
           const { data: memberData, error: memberError } = await supabase
             .from('organization_members')
             .select('role')
             .eq('organization_id', organizationId)
             .eq('user_id', user?.id)
             .maybeSingle();

           if (memberError) {
               console.error(`OrgContext: [${switchTimestamp}] Error checking membership for user ${user?.id} in org ${organizationId}:`, memberError);
               throw new Error(`Error checking membership: ${memberError.message}`);
           }

           console.log(`OrgContext: [${switchTimestamp}] Membership check result for user ${user?.id} in org ${organizationId}:`, memberData);

           if (!memberData) {
               console.warn(`OrgContext: [${switchTimestamp}] User ${user?.id} is NOT a member of organization ${organizationId}. Cannot switch context.`);
               setActiveOrganizationId(null);
               setActiveOrganization(null);
               await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
               console.log(`OrgContext: [${switchTimestamp}] END switchOrganizationContext (User not a member). State cleared.`);
               return { success: false, error: 'User is not a member of this organization.' };
           }

           console.log(`OrgContext: [${switchTimestamp}] User ${user?.id} IS a member (Role: ${memberData.role}). Proceeding with switch to org ${organizationId}.`);
           const orgDetails = {
               ...data,
               invite_code: memberData.role === 'admin' ? data.invite_code : null,
               currentUserRole: memberData.role,
           };

          // --- BEGIN STATE UPDATES ---
          console.log(`OrgContext: [${switchTimestamp}] Updating state: Setting active ID to ${organizationId}`);
          setActiveOrganizationId(organizationId);
          console.log(`OrgContext: [${switchTimestamp}] Updating state: Setting active Org details:`, orgDetails);
          setActiveOrganization(orgDetails);
          console.log(`OrgContext: [${switchTimestamp}] Updating state: Saving active ID to AsyncStorage`);
          await AsyncStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId);
          console.log(`OrgContext: [${switchTimestamp}] State updates complete. Preparing to return success.`);
          // --- END STATE UPDATES ---

          console.log(`OrgContext: [${switchTimestamp}] Successfully switched context. State updated for organization:`, orgDetails);
          return { success: true, data: orgDetails };
        } else {
          console.warn(`OrgContext: [${switchTimestamp}] Organization ${organizationId} not found or access denied by RLS.`);
          setActiveOrganizationId(null);
          setActiveOrganization(null);
          await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
          console.log(`OrgContext: [${switchTimestamp}] END switchOrganizationContext (Org not found or RLS denied). State cleared.`);
          return { success: false, error: 'Organization not found or access denied.' };
        }
      }
      console.log(`OrgContext: [${switchTimestamp}] END switchOrganizationContext (Successful switch/clear). Preparing to return success.`);
      return { success: true };
    } catch (error) {
       console.error(`OrgContext: [${switchTimestamp}] Unexpected error in switchOrganizationContext:`, error);
       console.log(`OrgContext: [${switchTimestamp}] Resetting state due to error.`);
       setActiveOrganizationId(null);
       setActiveOrganization(null);
       await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
       console.log(`OrgContext: [${switchTimestamp}] END switchOrganizationContext (Caught error). State cleared.`);
       return { success: false, error: error.message || 'Failed to switch organization.' };
    } finally {
      console.log(`OrgContext: [${switchTimestamp}] Entering FINALLY block for switchOrganizationContext.`);
      setIsLoading(false);
      // console.log(`OrgContext: [${switchTimestamp}] FINALLY block switchOrganizationContext. isLoading set to false.`); // Line 202 - Temporarily commented out for debugging
      console.log(`OrgContext: [${switchTimestamp}] Exiting FINALLY block. isLoading is now false.`);
    }
  };

  // Function to delete an organization (admin only)
  const deleteOrganization = async (organizationId) => {
    setIsLoading(true);
    console.log(`OrgContext: Starting deleteOrganization for ID: ${organizationId}`);

    if (!user) {
      console.error("OrgContext: Cannot delete organization - User is not logged in.");
      setIsLoading(false);
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
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
      }
      
      // Refresh user profile data to update the organizations list
      await loadUserProfile();
      console.log("Refreshed user profile data after organization deletion");

      console.log(`OrgContext: Successfully deleted organization: ${organizationId}`);
      return { success: true };
    } catch (error) {
      console.error("Unexpected error in deleteOrganization:", error);
      return { success: false, error: error.message || 'Failed to delete organization.' };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OrganizationContext.Provider
        value={{
            activeOrganizationId,
            activeOrganization, // Provide full details
            isLoading,
            switchOrganizationContext,
            deleteOrganization, // Add the new function
            isOrganizationActive: !!activeOrganizationId, // Convenience boolean
            // Member management functions passed through
            removeOrganizationMember,
            transferOrganizationAdmin,
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