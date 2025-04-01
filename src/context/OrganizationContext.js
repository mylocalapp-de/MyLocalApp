import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Create context
const OrganizationContext = createContext();

// Key for AsyncStorage
const ACTIVE_CONTEXT_STORAGE_KEY = 'activeOrganizationContext';

// Provider component
export const OrganizationProvider = ({ children }) => {
  const { user } = useAuth(); // Get the authenticated user

  // State for user's memberships in organizations
  const [memberships, setMemberships] = useState([]);
  // State for the currently active operating context ('personal' or organization_id)
  const [activeContext, setActiveContext] = useState('personal');
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load saved active context from storage on mount
  useEffect(() => {
    const loadActiveContext = async () => {
      try {
        const savedContext = await AsyncStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY);
        if (savedContext) {
          setActiveContext(savedContext);
        }
      } catch (e) {
        console.error("Failed to load active context from storage:", e);
      }
    };
    loadActiveContext();
  }, []);

  // Fetch user's organization memberships when user logs in or changes
  const fetchMemberships = useCallback(async () => {
    if (!user?.id) {
      setMemberships([]);
      // If user logs out, reset context to personal
      if (activeContext !== 'personal') {
          await switchContext('personal');
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log("OrganizationContext: Fetching memberships for user:", user.id);

    try {
      // Fetch memberships including organization name and invite code (if admin)
      const { data, error: fetchError } = await supabase
        .from('organization_members')
        .select(`
          role,
          organization:organizations (
            id,
            name,
            logo_url,
            invite_code
          )
        `)
        .eq('user_id', user.id);

      if (fetchError) {
        console.error("Error fetching organization memberships:", fetchError);
        setError(fetchError.message || 'Failed to fetch memberships.');
        setMemberships([]);
      } else {
        const formattedMemberships = data.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          logoUrl: m.organization.logo_url,
          role: m.role,
          // Only include invite code if the user is an admin of that org
          inviteCode: m.role === 'admin' ? m.organization.invite_code : null,
        }));
        console.log("OrganizationContext: Fetched memberships:", formattedMemberships);
        setMemberships(formattedMemberships);

        // Validate active context - if current context is an org ID not in the fetched list, reset to personal
        if (activeContext !== 'personal' && !formattedMemberships.some(m => m.id === activeContext)) {
            console.log(`OrganizationContext: Active context ${activeContext} no longer valid, resetting to personal.`);
            await switchContext('personal');
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching memberships:", err);
      setError('An unexpected error occurred while fetching memberships.');
      setMemberships([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activeContext]); // Add activeContext dependency

  // Fetch memberships on user change
  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]); // Now depends on fetchMemberships callback

  // Function to switch the active context
  const switchContext = async (contextId) => {
    if (contextId !== 'personal' && !memberships.some(m => m.id === contextId)) {
      console.error(`Attempted to switch to invalid organization context: ${contextId}`);
      setError(`You are not a member of this organization.`);
      // Optionally switch back to personal
      // setActiveContext('personal');
      // await AsyncStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, 'personal');
      return; // Prevent switching
    }
    console.log(`OrganizationContext: Switching context to ${contextId}`);
    setActiveContext(contextId);
    setError(null); // Clear previous errors
    try {
      await AsyncStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, contextId);
    } catch (e) {
      console.error("Failed to save active context to storage:", e);
    }
  };

  // Function to create a new organization
  const createOrganization = async (orgName, logoUrl = null) => {
    if (!user?.id) {
      setError("User must be logged in to create an organization.");
      return { success: false, error: "User not logged in." };
    }
    if (!orgName || orgName.trim().length === 0) {
        setError("Organization name cannot be empty.");
        return { success: false, error: "Organization name cannot be empty." };
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          logo_url: logoUrl,
          admin_id: user.id, // Creator is the admin
        })
        .select() // Select the newly created org data
        .single(); // Expecting a single row back

      if (insertError) {
        console.error("Error creating organization:", insertError);
        setError(insertError.message || 'Failed to create organization.');
        return { success: false, error: insertError };
      } else {
        console.log("OrganizationContext: Organization created:", data);
        // The trigger 'handle_new_organization' adds the creator to members.
        // Refetch memberships to include the new one.
        await fetchMemberships();
        // Optionally switch context to the new org immediately?
        // await switchContext(data.id);
        return { success: true, data };
      }
    } catch (err) {
      console.error("Unexpected error creating organization:", err);
      setError('An unexpected error occurred.');
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  // Function to join an existing organization using an invite code
  const joinOrganization = async (inviteCode) => {
    if (!user?.id) {
       setError("User must be logged in to join an organization.");
       return { success: false, error: "User not logged in." };
    }
    if (!inviteCode || inviteCode.trim().length === 0) {
        setError("Invite code cannot be empty.");
        return { success: false, error: "Invite code cannot be empty." };
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Find the organization by invite code
      const { data: orgData, error: findError } = await supabase
        .from('organizations')
        .select('id')
        .eq('invite_code', inviteCode.trim())
        .maybeSingle(); // Use maybeSingle in case code is invalid

      if (findError) {
        console.error("Error finding organization by invite code:", findError);
        setError(findError.message || 'Error checking invite code.');
        return { success: false, error: findError };
      }

      if (!orgData) {
        setError("Invalid or expired invite code.");
        return { success: false, error: "Invalid invite code." };
      }

      const organizationId = orgData.id;

      // 2. Check if already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
          console.error("Error checking existing membership:", checkError);
          setError(checkError.message || 'Could not verify membership.');
          return { success: false, error: checkError };
      }

      if (existingMember) {
          setError("You are already a member of this organization.");
          // Fetch memberships again in case local state was stale
          await fetchMemberships();
          return { success: true, alreadyMember: true }; // Indicate success but already joined
      }


      // 3. Insert the user into the organization_members table
      const { error: joinError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          role: 'member', // Default role on joining
        });

      if (joinError) {
        console.error("Error joining organization:", joinError);
        setError(joinError.message || 'Failed to join organization.');
        return { success: false, error: joinError };
      } else {
        console.log(`OrganizationContext: User ${user.id} joined organization ${organizationId}`);
        // Refetch memberships to update the UI
        await fetchMemberships();
        // Optionally switch context?
        // await switchContext(organizationId);
        return { success: true };
      }
    } catch (err) {
      console.error("Unexpected error joining organization:", err);
      setError('An unexpected error occurred.');
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  // Function to leave an organization
   const leaveOrganization = async (organizationId) => {
      if (!user?.id || !organizationId) {
          setError("User and Organization ID required to leave.");
          return { success: false, error: "Missing user or organization ID." };
      }

      // **TODO: Add check here to prevent the last admin from leaving**
      // This might require a database function or more complex client-side logic
      // to check if the user is an admin and if they are the *only* admin.

      setIsLoading(true);
      setError(null);

      try {
          const { error: deleteError } = await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', organizationId)
              .eq('user_id', user.id);

          if (deleteError) {
              console.error("Error leaving organization:", deleteError);
              setError(deleteError.message || 'Failed to leave organization.');
              return { success: false, error: deleteError };
          } else {
              console.log(`OrganizationContext: User ${user.id} left organization ${organizationId}`);
              // If the user left the currently active organization context, switch back to personal
              if (activeContext === organizationId) {
                  await switchContext('personal');
              }
              // Refetch memberships
              await fetchMemberships();
              return { success: true };
          }
      } catch (err) {
          console.error("Unexpected error leaving organization:", err);
          setError('An unexpected error occurred while leaving.');
          return { success: false, error: err };
      } finally {
          setIsLoading(false);
      }
  };


  // Value provided by the context
  const value = {
    memberships,          // List of orgs the user is part of [{ id, name, role, inviteCode? }]
    activeContext,        // 'personal' or organization_id
    isLoading,            // Loading state for context operations
    error,                // Error message string
    actions: {            // Group actions together
        fetchMemberships,
        switchContext,
        createOrganization,
        joinOrganization,
        leaveOrganization,
    }
  };

  return (
    <OrganizationContext.Provider value={value}>
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

export default OrganizationContext; 