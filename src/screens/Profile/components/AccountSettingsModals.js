/**
 * AccountSettingsModals — Create Account, Account Settings (Email/Password),
 * Make Permanent, Profile Edit, About Me, and Org Edit modals.
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';

// ── Create Account Modal ──
export const CreateAccountModal = ({
  visible, onClose,
  email, onEmailChange,
  password, onPasswordChange,
  confirmPassword, onConfirmPasswordChange,
  error, isLoading, onSubmit,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Account erstellen</Text>
        <Text style={styles.modalSubtitle}>Sichere deine Daten und nutze die App auf mehreren Geräten.</Text>
        <TextInput style={styles.input} placeholder="E-Mail" value={email} onChangeText={onEmailChange} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <TextInput style={styles.input} placeholder="Passwort (min. 6 Zeichen)" value={password} onChangeText={onPasswordChange} secureTextEntry autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Passwort bestätigen" value={confirmPassword} onChangeText={onConfirmPasswordChange} secureTextEntry autoCapitalize="none" />
        {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}>
            <Text style={styles.modalButtonText}>Abbrechen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onSubmit} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Erstellen</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ── Account Settings Modal (Email/Password tabs — or Username/Contact for username-accounts) ──
export const AccountSettingsModal = ({
  visible, onClose,
  activeTab, onTabChange,
  // Email-account props
  newEmail, onNewEmailChange,
  emailCurrentPassword, onEmailCurrentPasswordChange,
  newPassword, onNewPasswordChange,
  confirmNewPassword, onConfirmNewPasswordChange,
  error, isLoading,
  onUpdateEmail, onUpdatePassword,
  // Username-account props
  isUsernameAccount,
  newUsername, onNewUsernameChange,
  newContact, onNewContactChange,
  verifyMethod,
  onUpdateUsername, onUpdateContact,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Account Einstellungen</Text>
        <View style={styles.tabContainer}>
          {isUsernameAccount ? (
            <>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'username' && styles.tabButtonActive]} onPress={() => onTabChange('username')}>
                <Text style={[styles.tabText, activeTab === 'username' && styles.tabTextActive]}>Nutzername ändern</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'contact' && styles.tabButtonActive]} onPress={() => onTabChange('contact')}>
                <Text style={[styles.tabText, activeTab === 'contact' && styles.tabTextActive]}>Kontakt ändern</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'password' && styles.tabButtonActive]} onPress={() => onTabChange('password')}>
                <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>Passwort ändern</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'email' && styles.tabButtonActive]} onPress={() => onTabChange('email')}>
                <Text style={[styles.tabText, activeTab === 'email' && styles.tabTextActive]}>E-Mail ändern</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'password' && styles.tabButtonActive]} onPress={() => onTabChange('password')}>
                <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>Passwort ändern</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {/* ── Username-account: Nutzername ändern ── */}
        {activeTab === 'username' && (
          <>
            <Text style={styles.inputLabel}>Neuer Nutzername</Text>
            <TextInput style={styles.input} placeholder="Nutzername (3–20 Zeichen)" value={newUsername} onChangeText={onNewUsernameChange} autoCapitalize="none" autoCorrect={false} />
            {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onUpdateUsername} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Nutzername aktualisieren</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
        {/* ── Username-account: Kontakt ändern ── */}
        {activeTab === 'contact' && (
          <>
            <Text style={styles.inputLabel}>{verifyMethod === 'phone' ? 'Neue Telefonnummer' : 'Neue Kontakt-E-Mail'}</Text>
            <TextInput
              style={styles.input}
              placeholder={verifyMethod === 'phone' ? 'Telefonnummer' : 'Kontakt-E-Mail'}
              value={newContact}
              onChangeText={onNewContactChange}
              keyboardType={verifyMethod === 'phone' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
            />
            {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onUpdateContact} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>{verifyMethod === 'phone' ? 'Telefonnummer aktualisieren' : 'Kontakt-E-Mail aktualisieren'}</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
        {/* ── Email-account: E-Mail ändern ── */}
        {activeTab === 'email' && (
          <>
            <Text style={styles.inputLabel}>Neue E-Mail-Adresse</Text>
            <TextInput style={styles.input} placeholder="Neue E-Mail" value={newEmail} onChangeText={onNewEmailChange} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.inputLabel}>Aktuelles Passwort zur Bestätigung</Text>
            <TextInput style={styles.input} placeholder="Aktuelles Passwort" value={emailCurrentPassword} onChangeText={onEmailCurrentPasswordChange} secureTextEntry autoCapitalize="none" />
            {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onUpdateEmail} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>E-Mail aktualisieren</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
        {/* ── Email-account: Passwort ändern ── */}
        {activeTab === 'password' && (
          <>
            <Text style={styles.inputLabel}>Neues Passwort (min. 6 Zeichen)</Text>
            <TextInput style={styles.input} placeholder="Neues Passwort" value={newPassword} onChangeText={onNewPasswordChange} secureTextEntry autoCapitalize="none" />
            <Text style={styles.inputLabel}>Neues Passwort bestätigen</Text>
            <TextInput style={styles.input} placeholder="Neues Passwort bestätigen" value={confirmNewPassword} onChangeText={onConfirmNewPasswordChange} secureTextEntry autoCapitalize="none" />
            {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onUpdatePassword} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Passwort aktualisieren</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  </Modal>
);

// ── Make Permanent Modal ──
export const MakePermanentModal = ({
  visible, onClose,
  email,
  newPassword, onNewPasswordChange,
  confirmNewPassword, onConfirmNewPasswordChange,
  error, isLoading, onSubmit,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Account dauerhaft sichern</Text>
        <Text style={styles.inputLabel}>E-Mail-Adresse</Text>
        <TextInput style={[styles.input, { backgroundColor: '#e0e0e0' }]} value={email} editable={false} />
        <Text style={styles.inputLabel}>Neues Passwort (min. 6 Zeichen)</Text>
        <TextInput style={styles.input} placeholder="Neues Passwort" secureTextEntry value={newPassword} onChangeText={onNewPasswordChange} autoCapitalize="none" />
        <Text style={styles.inputLabel}>Passwort bestätigen</Text>
        <TextInput style={styles.input} placeholder="Passwort bestätigen" secureTextEntry value={confirmNewPassword} onChangeText={onConfirmNewPasswordChange} autoCapitalize="none" />
        {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onSubmit} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Passwort festlegen & Sichern</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ── Profile Edit Modal (Name + Preferences) ──
export const ProfileEditModal = ({
  visible, onClose,
  displayName, onDisplayNameChange,
  preferences, onTogglePreference,
  categories,
  error, isLoading, onSave,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Profil bearbeiten</Text>
        <Text style={styles.inputLabel}>Anzeigename</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={onDisplayNameChange} placeholder="Dein Name oder Spitzname" autoCapitalize="words" />
        <Text style={styles.inputLabel}>Interessen</Text>
        <View style={styles.categoriesContainerModal}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.id} style={[styles.categoryItemModal, preferences.includes(cat.id) && styles.categoryItemModalSelected]} onPress={() => onTogglePreference(cat.id)}>
              <Ionicons name={cat.icon} size={20} color={preferences.includes(cat.id) ? '#fff' : '#4285F4'} style={styles.categoryIconModal} />
              <Text style={[styles.categoryTextModal, preferences.includes(cat.id) && styles.categoryTextModalSelected]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onSave} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Speichern</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ── About Me Modal ──
export const AboutMeModal = ({
  visible, onClose,
  aboutMe, onAboutMeChange,
  error, isLoading, onSave,
  onSelectProfilePicture, uploadingImage, isOrganizationActive,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <Text style={styles.modalTitle}>Über mich bearbeiten</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Profile picture upload shortcut — only in personal context */}
            {!isOrganizationActive && onSelectProfilePicture && (
              <TouchableOpacity
                style={styles.avatarUploadRow}
                onPress={() => {
                  onClose();
                  setTimeout(() => onSelectProfilePicture(), 300);
                }}
                disabled={uploadingImage}
              >
                <Ionicons name="camera-outline" size={22} color="#4285F4" />
                <Text style={styles.avatarUploadText}>
                  {uploadingImage ? 'Wird hochgeladen…' : 'Profilbild ändern'}
                </Text>
              </TouchableOpacity>
            )}

            <TextInput style={[styles.input, styles.textArea]} value={aboutMe} onChangeText={onAboutMeChange} placeholder="Erzähl etwas über dich..." multiline numberOfLines={6} textAlignVertical="top" />
            {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
          </ScrollView>
          <View style={[styles.modalActions, { marginTop: 12 }]}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonText}>Abbrechen</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onSave} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Speichern</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// ── Org Edit Modal ──
export const OrgEditModal = ({
  visible, onClose,
  orgName, onOrgNameChange,
  orgAboutMe, onOrgAboutMeChange,
  error, isLoading, onSave,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Organisation bearbeiten</Text>
        <Text style={styles.inputLabel}>Organisationsname</Text>
        <TextInput style={styles.input} value={orgName} onChangeText={onOrgNameChange} placeholder="Neuer Name" autoCapitalize="words" />
        <Text style={styles.inputLabel}>Über die Organisation (optional)</Text>
        <TextInput style={[styles.input, styles.textArea]} value={orgAboutMe} onChangeText={onOrgAboutMeChange} placeholder="Beschreibe deine Organisation..." multiline numberOfLines={4} />
        {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose} disabled={isLoading}><Text style={styles.modalButtonTextCancel}>Abbrechen</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.saveButton, isLoading && styles.buttonDisabled]} onPress={onSave} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Speichern</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
