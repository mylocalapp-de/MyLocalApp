/**
 * ProfileScreen — Container component orchestrating sub-components and hooks.
 * Split from the original 2,657-line monolith.
 */

import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { useAppConfig } from '../../context/AppConfigContext';
import Constants from 'expo-constants';

import useAccountSettings from './hooks/useAccountSettings';
import useOrganizationManagement from './hooks/useOrganizationManagement';

import ProfileHeader from './components/ProfileHeader';
import OrganizationManager from './components/OrganizationManager';
import PersonalProfileSection, { CATEGORIES } from './components/PersonalProfileSection';
import {
  CreateAccountModal,
  AccountSettingsModal,
  MakePermanentModal,
  ProfileEditModal,
  AboutMeModal,
  OrgEditModal,
} from './components/AccountSettingsModals';

import styles from './styles';

const isTrue = (val) => val === true || val === 'true' || val === '1';
const defaultDisablePreferences = isTrue(process.env.EXPO_PUBLIC_DISABLE_PREFERENCES) ||
  isTrue(Constants?.expoConfig?.extra?.disablePreferences);

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { config: appConfig, loading: appConfigLoading } = useAppConfig();
  const disablePreferences = appConfigLoading
    ? defaultDisablePreferences
    : isTrue(appConfig.EXPO_PUBLIC_DISABLE_PREFERENCES);

  const {
    user, profile, preferences, displayName,
    userOrganizations, loading: authLoading,
    loadUserProfile, updateProfile,
    updateProfilePicture, loadingProfilePicture,
  } = useAuth();

  const {
    isConnected, lastOfflineSaveTimestamp, isSavingData, saveDataForOffline,
  } = useNetwork();

  // Hooks
  const account = useAccountSettings();
  const org = useOrganizationManagement();

  // Profile edit modal state
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPreferences, setEditPreferences] = useState([]);
  const [editAboutMe, setEditAboutMe] = useState('');
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // About Me modal state
  const [showAboutMeModal, setShowAboutMeModal] = useState(false);

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);

  // Visibility toggle
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const overallLoading = authLoading || org.isOrgContextLoading;

  // ── Profile Edit ──
  const handleOpenProfileEdit = () => {
    setEditDisplayName(displayName || '');
    setEditPreferences(preferences || []);
    setEditAboutMe(profile?.about_me || '');
    setEditFormError('');
    setShowProfileEditModal(true);
  };

  const togglePreference = (id) => {
    setEditPreferences(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSaveProfile = async () => {
    if (org.isOrganizationActive) return;
    if (!editDisplayName.trim()) { setEditFormError('Bitte gib einen Benutzernamen ein.'); return; }

    setIsEditLoading(true);
    setEditFormError('');
    const updates = {};
    let needsUpdate = false;
    if (editDisplayName !== displayName) { updates.display_name = editDisplayName.trim(); needsUpdate = true; }
    if (JSON.stringify(editPreferences.sort()) !== JSON.stringify((preferences || []).sort())) { updates.preferences = editPreferences; needsUpdate = true; }
    if (editAboutMe !== (profile?.about_me || '')) { updates.about_me = editAboutMe.trim(); needsUpdate = true; }
    if (!needsUpdate) { setShowProfileEditModal(false); setIsEditLoading(false); return; }

    try {
      const result = await updateProfile(updates);
      if (result.success) {
        Alert.alert('Erfolgreich', result.warning ? 'Teilweise gespeichert.' : 'Profil aktualisiert.');
        setShowProfileEditModal(false);
      } else {
        setEditFormError(result.error?.message || 'Fehler beim Speichern.');
      }
    } catch { setEditFormError('Ein unerwarteter Fehler ist aufgetreten.'); }
    finally { setIsEditLoading(false); }
  };

  // ── About Me ──
  const handleOpenAboutMeModal = () => {
    setEditAboutMe(profile?.about_me || '');
    setEditFormError('');
    setShowAboutMeModal(true);
  };

  const handleSaveAboutMe = async () => {
    if (editAboutMe.trim() === (profile?.about_me || '')) { setShowAboutMeModal(false); return; }
    setIsEditLoading(true);
    setEditFormError('');
    try {
      const result = await updateProfile({ about_me: editAboutMe.trim() });
      if (result.success) { Alert.alert('Erfolgreich', 'Beschreibung aktualisiert.'); setShowAboutMeModal(false); }
      else { setEditFormError(result.error?.message || 'Fehler beim Speichern.'); }
    } catch { setEditFormError('Ein unerwarteter Fehler ist aufgetreten.'); }
    finally { setIsEditLoading(false); }
  };

  // ── Image Pickers ──
  const handleSelectProfilePicture = async () => {
    if (!user || org.isOrganizationActive || uploadingImage || loadingProfilePicture) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Berechtigung benötigt', 'Zugriff auf die Fotobibliothek wird benötigt.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      if (result.assets?.[0]) {
        const r = await updateProfilePicture(result.assets[0].uri);
        if (r.success) Alert.alert('Erfolg', 'Profilbild aktualisiert.');
        else Alert.alert('Fehler', r.error?.message || 'Upload fehlgeschlagen.');
      }
    } catch { Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.'); }
    finally { setUploadingImage(false); }
  };

  const handleSelectOrgLogo = async () => {
    if (!user || !org.isOrganizationActive || !org.activeOrganizationId || org.loadingOrgLogo) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Berechtigung benötigt', 'Zugriff auf die Fotobibliothek wird benötigt.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled) return;
    try {
      if (result.assets?.[0]) {
        const r = await org.updateOrganizationLogo(org.activeOrganizationId, result.assets[0].uri);
        if (r.success) Alert.alert('Erfolg', 'Logo aktualisiert.');
        else Alert.alert('Fehler', r.error?.message || 'Upload fehlgeschlagen.');
      }
    } catch { Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.'); }
  };

  // ── Visibility ──
  const handleUpdateVisibility = async (value) => {
    if (isUpdatingVisibility) return;
    setIsUpdatingVisibility(true);
    try {
      const result = await updateProfile({ show_in_list: !!value });
      if (!result.success) Alert.alert('Fehler', result.error?.message || 'Konnte Sichtbarkeit nicht ändern.');
    } finally { setIsUpdatingVisibility(false); }
  };

  // ── Loading ──
  if (overallLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <ProfileHeader
        isOrganizationActive={org.isOrganizationActive}
        activeOrganization={org.activeOrganization}
        displayName={displayName}
        hasFullAccount={account.hasFullAccount}
        user={user}
        profile={profile}
        uploadingImage={uploadingImage}
        loadingProfilePicture={loadingProfilePicture}
        loadingOrgLogo={org.loadingOrgLogo}
        authLoading={authLoading}
        isOrgContextLoading={org.isOrgContextLoading}
        onSelectProfilePicture={handleSelectProfilePicture}
        onSelectOrgLogo={handleSelectOrgLogo}
        onOpenProfileEdit={handleOpenProfileEdit}
        onOpenOrgEdit={org.handleOpenOrgEdit}
        onReloadProfile={() => loadUserProfile(user?.id)}
        onReloadOrgContext={org.handleReloadOrgContext}
      />

      {org.isOrganizationActive ? (
        <OrganizationManager
          activeOrganization={org.activeOrganization}
          activeOrganizationId={org.activeOrganizationId}
          organizationMembers={org.organizationMembers}
          isFetchingMembers={org.isFetchingMembers}
          orgMgmtError={org.orgMgmtError}
          memberManagementLoading={org.memberManagementLoading}
          isOrgContextLoading={org.isOrgContextLoading}
          authLoading={org.authLoading}
          currentUserId={user?.id}
          navigation={navigation}
          onSwitchToPersonal={org.handleSwitchToPersonal}
          onLeaveOrg={org.handleLeaveOrg}
          onDeleteOrg={org.handleDeleteOrg}
          onRemoveMember={org.handleRemoveMember}
          onMakeAdmin={org.handleMakeAdmin}
        />
      ) : (
        <PersonalProfileSection
          hasFullAccount={account.hasFullAccount}
          isTemporaryAccount={account.isTemporaryAccount}
          disablePreferences={disablePreferences}
          preferences={preferences}
          profile={profile}
          userOrganizations={org.userOrganizations}
          isOrgContextLoading={org.isOrgContextLoading}
          isConnected={isConnected}
          lastOfflineSaveTimestamp={lastOfflineSaveTimestamp}
          isSavingData={isSavingData}
          isUpdatingVisibility={isUpdatingVisibility}
          navigation={navigation}
          onSwitchToOrg={org.handleSwitchToOrg}
          onOpenProfileEdit={handleOpenProfileEdit}
          onOpenAboutMeModal={handleOpenAboutMeModal}
          onOpenAccountSettings={account.handleOpenAccountSettings}
          onOpenMakePermanentSettings={account.handleOpenMakePermanentSettings}
          onOpenCreateAccountModal={account.handleOpenCreateAccountModal}
          onSaveDataForOffline={saveDataForOffline}
          onUpdateVisibility={handleUpdateVisibility}
        />
      )}

      {/* Sign Out / Delete — personal context only */}
      {!org.isOrganizationActive && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={account.handleSignOut}
            disabled={account.isAccountSettingsLoading || loadingProfilePicture}
          >
            <Ionicons name="log-out-outline" size={22} style={[styles.settingIcon, styles.signOutIcon]} />
            <Text style={[styles.settingText, styles.signOutText]}>
              {account.hasFullAccount ? 'Abmelden' : 'App Zurücksetzen'}
            </Text>
          </TouchableOpacity>
          {account.hasFullAccount && (
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={() => account.handleDeleteAccount(org.userOrganizations)}
              disabled={account.isAccountSettingsLoading || loadingProfilePicture}
            >
              <Ionicons name="trash-outline" size={22} style={[styles.settingIcon, styles.deleteIcon]} />
              <Text style={[styles.settingText, styles.deleteButtonText]}>Account löschen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Modals ── */}
      <CreateAccountModal
        visible={account.showCreateAccountModal}
        onClose={() => account.setShowCreateAccountModal(false)}
        email={account.createEmail} onEmailChange={account.setCreateEmail}
        password={account.createPassword} onPasswordChange={account.setCreatePassword}
        confirmPassword={account.confirmCreatePassword} onConfirmPasswordChange={account.setConfirmCreatePassword}
        error={account.createFormError} isLoading={account.isCreateLoading}
        onSubmit={account.handleCreateAccount}
      />

      <ProfileEditModal
        visible={showProfileEditModal}
        onClose={() => setShowProfileEditModal(false)}
        displayName={editDisplayName} onDisplayNameChange={setEditDisplayName}
        preferences={editPreferences} onTogglePreference={togglePreference}
        categories={CATEGORIES}
        error={editFormError} isLoading={isEditLoading}
        onSave={handleSaveProfile}
      />

      <AboutMeModal
        visible={showAboutMeModal}
        onClose={() => setShowAboutMeModal(false)}
        aboutMe={editAboutMe} onAboutMeChange={setEditAboutMe}
        error={editFormError} isLoading={isEditLoading}
        onSave={handleSaveAboutMe}
      />

      {account.isMakingPermanent ? (
        <MakePermanentModal
          visible={account.showAccountSettingsModal && account.isMakingPermanent}
          onClose={() => { account.setIsMakingPermanent(false); account.setShowAccountSettingsModal(false); }}
          email={account.newEmail}
          newPassword={account.newPassword} onNewPasswordChange={account.setNewPassword}
          confirmNewPassword={account.confirmNewPassword} onConfirmNewPasswordChange={account.setConfirmNewPassword}
          error={account.accountSettingsError} isLoading={account.isAccountSettingsLoading}
          onSubmit={account.handleMakePermanent}
        />
      ) : (
        <AccountSettingsModal
          visible={account.showAccountSettingsModal}
          onClose={() => account.setShowAccountSettingsModal(false)}
          activeTab={account.activeTab} onTabChange={(tab) => { account.setActiveTab(tab); account.setAccountSettingsError(''); }}
          newEmail={account.newEmail} onNewEmailChange={account.setNewEmail}
          emailCurrentPassword={account.emailCurrentPassword} onEmailCurrentPasswordChange={account.setEmailCurrentPassword}
          newPassword={account.newPassword} onNewPasswordChange={account.setNewPassword}
          confirmNewPassword={account.confirmNewPassword} onConfirmNewPasswordChange={account.setConfirmNewPassword}
          error={account.accountSettingsError} isLoading={account.isAccountSettingsLoading}
          onUpdateEmail={account.handleUpdateEmail}
          onUpdatePassword={account.handleUpdatePassword}
        />
      )}

      <OrgEditModal
        visible={org.showOrgEditModal}
        onClose={() => org.setShowOrgEditModal(false)}
        orgName={org.editOrgName} onOrgNameChange={org.setEditOrgName}
        orgAboutMe={org.editOrgAboutMe} onOrgAboutMeChange={org.setEditOrgAboutMe}
        error={org.orgEditError} isLoading={org.isOrgEditLoading}
        onSave={org.handleSaveOrgDetails}
      />
    </ScrollView>
  );
};

export default ProfileScreen;
