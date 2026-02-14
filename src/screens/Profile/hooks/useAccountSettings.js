/**
 * useAccountSettings — State & logic for email/password change, account creation,
 * making temporary accounts permanent, and account deletion.
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';

export default function useAccountSettings() {
  const {
    user,
    profile,
    upgradeToFullAccount,
    updateEmail,
    updatePassword,
    signOut,
    deleteCurrentUserAccount,
  } = useAuth();

  const hasFullAccount = !!user?.id;
  const isTemporaryAccount = hasFullAccount && profile?.is_temporary === true;

  // Create account modal state
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmCreatePassword, setConfirmCreatePassword] = useState('');
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [createFormError, setCreateFormError] = useState('');

  // Account settings modal state
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('email');
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [accountSettingsError, setAccountSettingsError] = useState('');
  const [isAccountSettingsLoading, setIsAccountSettingsLoading] = useState(false);
  const [isMakingPermanent, setIsMakingPermanent] = useState(false);

  const handleOpenCreateAccountModal = () => {
    setCreateEmail('');
    setCreatePassword('');
    setConfirmCreatePassword('');
    setCreateFormError('');
    setShowCreateAccountModal(true);
  };

  const handleCreateAccount = async () => {
    if (!createEmail.trim() || !createEmail.includes('@')) {
      setCreateFormError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (!createPassword) {
      setCreateFormError('Bitte gib ein Passwort ein.');
      return;
    }
    if (createPassword.length < 6) {
      setCreateFormError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (createPassword !== confirmCreatePassword) {
      setCreateFormError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setIsCreateLoading(true);
    setCreateFormError('');

    try {
      const result = await upgradeToFullAccount(createEmail, createPassword);
      if (result.success) {
        Alert.alert('Erfolgreich', 'Dein Account wurde erstellt. Du bist jetzt eingeloggt.');
        setShowCreateAccountModal(false);
      } else {
        setCreateFormError(result.error?.message || 'Account konnte nicht erstellt werden.');
      }
    } catch (error) {
      setCreateFormError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsCreateLoading(false);
    }
  };

  const handleOpenAccountSettings = () => {
    if (!hasFullAccount) {
      Alert.alert('Fehler', 'Account-Einstellungen sind nur für eingeloggte Benutzer verfügbar.');
      return;
    }
    setIsMakingPermanent(false);
    setNewEmail(user.email || '');
    setEmailCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setActiveTab('email');
    setAccountSettingsError('');
    setShowAccountSettingsModal(true);
  };

  const handleOpenMakePermanentSettings = () => {
    if (!isTemporaryAccount) {
      Alert.alert('Fehler', 'Diese Funktion ist nur für temporäre Accounts.');
      return;
    }
    setIsMakingPermanent(true);
    setNewEmail(user?.email || '');
    setEmailCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setActiveTab('password');
    setAccountSettingsError('');
    setShowAccountSettingsModal(true);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAccountSettingsError('Bitte gib eine gültige neue E-Mail-Adresse ein.');
      return;
    }
    if (newEmail.trim() === user?.email) {
      setAccountSettingsError('Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden.');
      return;
    }
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    try {
      const result = await updateEmail(newEmail.trim(), emailCurrentPassword);
      if (result.success) {
        setShowAccountSettingsModal(false);
        Alert.alert('Erfolgreich', 'Deine E-Mail-Adresse wurde aktualisiert.');
      } else {
        setAccountSettingsError(result.error?.message || 'E-Mail konnte nicht geändert werden.');
      }
    } catch {
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setAccountSettingsError('Bitte gib ein neues Passwort ein.');
      return;
    }
    if (newPassword.length < 6) {
      setAccountSettingsError('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountSettingsError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    try {
      const result = await updatePassword(newPassword);
      if (result.success) {
        const needsEmailUpdate = isMakingPermanent && user?.email?.includes('@temp.mylocalapp.de') && newEmail.trim() && newEmail.trim() !== user.email;
        if (needsEmailUpdate) {
          if (!newEmail.trim() || !newEmail.includes('@')) {
            setAccountSettingsError('Bitte gib eine gültige neue E-Mail-Adresse ein.');
            setIsAccountSettingsLoading(false);
            return;
          }
          const emailResult = await updateEmail(newEmail.trim());
          if (!emailResult.success) {
            Alert.alert('Passwort gesetzt, E-Mail fehlgeschlagen', `Dein Passwort wurde festgelegt, aber die E-Mail konnte nicht geändert werden: ${emailResult.error?.message || 'Fehler'}.`);
          } else {
            Alert.alert('Erfolgreich', 'Dein Passwort wurde festgelegt und die E-Mail aktualisiert.');
          }
        } else {
          Alert.alert('Erfolgreich', isMakingPermanent ? 'Dein Passwort wurde festgelegt. Dein Account ist jetzt permanent.' : 'Dein Passwort wurde aktualisiert.');
        }
        setShowAccountSettingsModal(false);
        setIsMakingPermanent(false);
      } else {
        setAccountSettingsError(result.error?.message || 'Passwort konnte nicht geändert werden.');
      }
    } catch {
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };

  const handleMakePermanent = async () => {
    if (!newPassword) {
      setAccountSettingsError('Bitte gib ein neues Passwort ein.');
      return;
    }
    if (newPassword.length < 6) {
      setAccountSettingsError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountSettingsError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setIsAccountSettingsLoading(true);
    setAccountSettingsError('');
    try {
      const result = await upgradeToFullAccount(newEmail.trim(), newPassword);
      if (result.success) {
        Alert.alert('Erfolgreich', 'Dein Account ist jetzt permanent.');
        setIsMakingPermanent(false);
        setShowAccountSettingsModal(false);
      } else {
        setAccountSettingsError(result.error?.message || 'Konnte Account nicht permanent machen.');
      }
    } catch {
      setAccountSettingsError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsAccountSettingsLoading(false);
    }
  };

  const handleSignOut = async () => {
    const title = hasFullAccount ? 'Abmelden' : 'App Zurücksetzen';
    const message = hasFullAccount
      ? 'Möchtest du dich wirklich abmelden?'
      : 'Möchtest du die App wirklich zurücksetzen und dich abmelden?';
    const confirmText = hasFullAccount ? 'Abmelden' : 'Zurücksetzen & Abmelden';

    Alert.alert(title, message, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: confirmText,
        style: 'destructive',
        onPress: async () => {
          const { success, error } = await signOut();
          if (!success) {
            Alert.alert('Fehler', `Fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async (userOrganizations) => {
    if (!hasFullAccount) return;
    const isAdminAnywhere = userOrganizations?.some(org => org.role === 'admin');
    if (isAdminAnywhere) {
      Alert.alert('Fehler', 'Du kannst deinen Account nicht löschen, solange du Administrator in einer Organisation bist.');
      return;
    }
    Alert.alert(
      'Account löschen',
      'Warnung: Möchtest du deinen Account wirklich endgültig löschen? Alle deine Daten werden unwiderruflich entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen',
          style: 'destructive',
          onPress: async () => {
            setIsAccountSettingsLoading(true);
            try {
              const result = await deleteCurrentUserAccount();
              if (!result.success) {
                Alert.alert('Fehler', `Account konnte nicht gelöscht werden: ${result.error?.message || 'Unbekannter Fehler'}`);
                setIsAccountSettingsLoading(false);
              }
            } catch {
              Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
              setIsAccountSettingsLoading(false);
            }
          },
        },
      ]
    );
  };

  return {
    // State
    hasFullAccount,
    isTemporaryAccount,
    // Create account
    showCreateAccountModal, setShowCreateAccountModal,
    createEmail, setCreateEmail,
    createPassword, setCreatePassword,
    confirmCreatePassword, setConfirmCreatePassword,
    isCreateLoading,
    createFormError,
    handleOpenCreateAccountModal,
    handleCreateAccount,
    // Account settings
    showAccountSettingsModal, setShowAccountSettingsModal,
    activeTab, setActiveTab,
    newEmail, setNewEmail,
    emailCurrentPassword, setEmailCurrentPassword,
    newPassword, setNewPassword,
    confirmNewPassword, setConfirmNewPassword,
    accountSettingsError, setAccountSettingsError,
    isAccountSettingsLoading,
    isMakingPermanent, setIsMakingPermanent,
    handleOpenAccountSettings,
    handleOpenMakePermanentSettings,
    handleUpdateEmail,
    handleUpdatePassword,
    handleMakePermanent,
    handleSignOut,
    handleDeleteAccount,
  };
}
