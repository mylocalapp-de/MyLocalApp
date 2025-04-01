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
  const { user } = useAuth(); // Get user status

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
     setIsLoading(true);
     console.log(`Attempting to switch context to organization ID: ${organizationId}`);
     try {
       if (!organizationId) {
         // Switching back to personal context
         setActiveOrganizationId(null);
         setActiveOrganization(null);
         await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
         console.log("Switched back to personal context.");
       } else {
         // Fetch organization details from Supabase
         // Use RLS to ensure user is actually a member (implicitly handled by SELECT policy)
         const { data, error } = await supabase
           .from('organizations')
           .select('id, name, logo_url, invite_code, admin_id') // Select necessary fields
           .eq('id', organizationId)
           .maybeSingle(); // Use maybeSingle to return null if not found/no access

         if (error) {
           throw new Error(`Error fetching organization details: ${error.message}`);
         }

         if (data) {
            // Check if the current user is the admin for fetching invite code (RLS might hide it otherwise)
            // We need member check here before setting active!
            const { data: memberData, error: memberError } = await supabase
              .from('organization_members')
              .select('role')
              .eq('organization_id', organizationId)
              .eq('user_id', user?.id)
              .maybeSingle();

            if (memberError) {
                throw new Error(`Error checking membership: ${memberError.message}`);
            }

            if (!memberData) {
                console.warn(`User ${user?.id} is not a member of organization ${organizationId}. Cannot switch context.`);
                // Don't switch, clear potential stored value
                setActiveOrganizationId(null);
                setActiveOrganization(null);
                await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
                return { success: false, error: 'User is not a member of this organization.' };
            }

            // User is a member, proceed.
            const orgDetails = {
                ...data,
                // Only include invite_code if the user is an admin
                invite_code: memberData.role === 'admin' ? data.invite_code : null,
                currentUserRole: memberData.role, // Store the user's role
            };

           setActiveOrganizationId(organizationId);
           setActiveOrganization(orgDetails); // Store fetched details
           await AsyncStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId);
           console.log(`Successfully switched context to organization: ${orgDetails.name}`);
           return { success: true, data: orgDetails };
         } else {
           // Organization not found or user doesn't have access via RLS
           console.warn(`Organization ${organizationId} not found or access denied.`);
           setActiveOrganizationId(null);
           setActiveOrganization(null);
           await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
           return { success: false, error: 'Organization not found or access denied.' };
         }
       }
       return { success: true };
     } catch (error) {
       console.error("Error switching organization context:", error);
       // Revert state on error
       setActiveOrganizationId(null);
       setActiveOrganization(null);
       await AsyncStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
       return { success: false, error: error.message || 'Failed to switch organization.' };
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
            isOrganizationActive: !!activeOrganizationId, // Convenience boolean
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