/**
 * useOrganizationManagement — State & logic for org switching, member management,
 * org editing, leaving/deleting orgs.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useOrganization } from '../../../context/OrganizationContext';

export default function useOrganizationManagement() {
  const {
    user,
    userOrganizations,
    leaveOrganization,
    refreshCurrentUserProfile,
    loading: authLoading,
  } = useAuth();

  const {
    activeOrganizationId,
    activeOrganization,
    isOrganizationActive,
    switchOrganizationContext,
    deleteOrganization,
    isLoading: isOrgContextLoading,
    organizationMembers,
    loadingMembers: isFetchingMembers,
    membersError: orgMgmtError,
    fetchOrganizationMembers,
    removeOrganizationMember,
    transferOrganizationAdmin,
    updateOrganizationDetails,
    updateOrganizationName,
    updateOrganizationLogo,
    loadingOrgLogo,
  } = useOrganization();

  // Org edit modal state
  const [showOrgEditModal, setShowOrgEditModal] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgAboutMe, setEditOrgAboutMe] = useState('');
  const [isOrgEditLoading, setIsOrgEditLoading] = useState(false);
  const [orgEditError, setOrgEditError] = useState('');

  // Member management loading
  const [memberManagementLoading, setMemberManagementLoading] = useState(false);

  const reloadMembers = useCallback(() => {
    if (activeOrganizationId) {
      fetchOrganizationMembers(activeOrganizationId);
    }
  }, [activeOrganizationId, fetchOrganizationMembers]);

  const handleOpenOrgEdit = () => {
    if (!isOrganizationActive || !activeOrganization) return;
    setEditOrgName(activeOrganization.name || '');
    setEditOrgAboutMe(activeOrganization.about_me || '');
    setOrgEditError('');
    setShowOrgEditModal(true);
  };

  const handleSaveOrgDetails = async () => {
    if (!isOrganizationActive || !activeOrganizationId) return;
    const trimmedName = editOrgName.trim();
    const trimmedAboutMe = editOrgAboutMe.trim();

    if (!trimmedName) {
      setOrgEditError('Organisationsname darf nicht leer sein.');
      return;
    }

    const updates = {};
    let needsUpdate = false;
    if (trimmedName !== activeOrganization?.name) { updates.name = trimmedName; needsUpdate = true; }
    if (trimmedAboutMe !== (activeOrganization?.about_me || '')) { updates.about_me = trimmedAboutMe; needsUpdate = true; }

    if (!needsUpdate) { setShowOrgEditModal(false); return; }

    setIsOrgEditLoading(true);
    setOrgEditError('');
    try {
      const result = await updateOrganizationDetails(activeOrganizationId, updates);
      if (result.success) {
        Alert.alert('Erfolg', 'Organisationsdetails aktualisiert.');
        setShowOrgEditModal(false);
      } else {
        setOrgEditError(result.error?.message || 'Fehler beim Speichern.');
      }
    } catch {
      setOrgEditError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsOrgEditLoading(false);
    }
  };

  const handleSwitchToOrg = (orgId) => {
    switchOrganizationContext(orgId).then(result => {
      if (!result.success) {
        if (result.error && result.error.includes('not found')) {
          Alert.alert('Organisation nicht gefunden', 'Diese Organisation existiert nicht mehr.', [
            { text: 'OK', onPress: () => refreshCurrentUserProfile() },
          ]);
        } else {
          Alert.alert('Fehler', result.error || 'Konnte nicht zur Organisation wechseln.');
        }
      }
    }).catch(() => {
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    });
  };

  const handleSwitchToPersonal = async () => {
    const result = await switchOrganizationContext(null);
    if (!result.success) {
      Alert.alert('Fehler', result.error || 'Konnte nicht zum persönlichen Account wechseln.');
    }
  };

  const handleLeaveOrg = async (orgId, orgName) => {
    if (!orgId || !orgName) return;
    Alert.alert('Organisation verlassen', `Möchtest du die Organisation "${orgName}" wirklich verlassen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Verlassen',
        style: 'destructive',
        onPress: async () => {
          const result = await leaveOrganization(orgId);
          if (result.success) {
            Alert.alert('Erfolg', `Du hast "${orgName}" verlassen.`);
            await switchOrganizationContext(null);
          } else {
            const msg = result.error?.message === 'Database Error: Cannot leave as the last admin.'
              ? 'Du kannst die Organisation nicht verlassen, da du der letzte Administrator bist.'
              : result.error?.message || 'Verlassen fehlgeschlagen.';
            Alert.alert('Fehler', msg);
          }
        },
      },
    ]);
  };

  const handleDeleteOrg = (orgId, orgName) => {
    if (!orgId || !orgName) return;
    Alert.alert(
      'Organisation löschen',
      `Möchtest du die Organisation "${orgName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteOrganization(orgId);
            if (result.success) {
              Alert.alert('Erfolg', `Die Organisation "${orgName}" wurde gelöscht.`);
            } else {
              Alert.alert('Fehler', result.error || 'Löschen fehlgeschlagen.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (memberUserId, memberName) => {
    if (!activeOrganizationId) return;
    Alert.alert('Mitglied entfernen', `Möchtest du "${memberName || 'dieses Mitglied'}" wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: async () => {
          setMemberManagementLoading(true);
          const result = await removeOrganizationMember(activeOrganizationId, memberUserId);
          setMemberManagementLoading(false);
          if (result.success) {
            Alert.alert('Erfolg', `"${memberName || 'Mitglied'}" wurde entfernt.`);
            reloadMembers();
          } else {
            Alert.alert('Fehler', result.error?.message || 'Entfernen fehlgeschlagen.');
          }
        },
      },
    ]);
  };

  const handleMakeAdmin = (newAdminUserId, memberName) => {
    if (!activeOrganizationId) return;
    Alert.alert(
      'Admin ernennen',
      `Möchtest du "${memberName || 'dieses Mitglied'}" zum neuen Administrator ernennen? Du wirst dadurch zum normalen Mitglied.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ernennen',
          onPress: async () => {
            setMemberManagementLoading(true);
            const result = await transferOrganizationAdmin(activeOrganizationId, newAdminUserId);
            setMemberManagementLoading(false);
            if (result.success) {
              Alert.alert('Erfolg', `"${memberName || 'Mitglied'}" ist jetzt Administrator.`);
              reloadMembers();
            } else {
              Alert.alert('Fehler', result.error?.message || 'Admin-Übertragung fehlgeschlagen.');
            }
          },
        },
      ]
    );
  };

  const handleReloadOrgContext = () => {
    if (activeOrganizationId) {
      switchOrganizationContext(activeOrganizationId);
    }
  };

  return {
    // Org context
    activeOrganizationId,
    activeOrganization,
    isOrganizationActive,
    isOrgContextLoading,
    userOrganizations,
    authLoading,
    user,
    // Members
    organizationMembers,
    isFetchingMembers,
    orgMgmtError,
    memberManagementLoading,
    // Org edit
    showOrgEditModal, setShowOrgEditModal,
    editOrgName, setEditOrgName,
    editOrgAboutMe, setEditOrgAboutMe,
    isOrgEditLoading,
    orgEditError,
    // Org logo
    updateOrganizationLogo,
    loadingOrgLogo,
    // Handlers
    handleOpenOrgEdit,
    handleSaveOrgDetails,
    handleSwitchToOrg,
    handleSwitchToPersonal,
    handleLeaveOrg,
    handleDeleteOrg,
    handleRemoveMember,
    handleMakeAdmin,
    handleReloadOrgContext,
  };
}
