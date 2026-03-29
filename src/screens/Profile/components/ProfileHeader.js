/**
 * ProfileHeader — Avatar, name, badges, edit/reload buttons.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';

const { height } = Dimensions.get('window');

const ProfileHeader = ({
  isOrganizationActive,
  activeOrganization,
  displayName,
  hasFullAccount,
  user,
  profile,
  uploadingImage,
  loadingProfilePicture,
  loadingOrgLogo,
  authLoading,
  isOrgContextLoading,
  onSelectProfilePicture,
  onSelectOrgLogo,
  onOpenProfileEdit,
  onOpenOrgEdit,
  onReloadProfile,
  onReloadOrgContext,
}) => {
  const currentOrgName = isOrganizationActive && activeOrganization ? activeOrganization.name : null;
  const currentOrgLogoUrl = isOrganizationActive && activeOrganization ? activeOrganization.logo_url : null;
  const currentUserRole = isOrganizationActive && activeOrganization ? activeOrganization.currentUserRole : null;
  const headerTitle = isOrganizationActive
    ? `Organisation: ${currentOrgName || '... '}`
    : (displayName || 'Dein Profil');
  const avatarInitial = isOrganizationActive ? (currentOrgName?.charAt(0) || 'O') : (displayName?.charAt(0) || '?');
  const userAvatarUrl = !isOrganizationActive ? profile?.avatar_url : null;

  return (
    <View style={styles.profileHeader}>
      <TouchableOpacity
        onPress={isOrganizationActive ? onSelectOrgLogo : onSelectProfilePicture}
        disabled={uploadingImage || loadingProfilePicture || loadingOrgLogo}
        style={styles.avatarContainer}
      >
        {userAvatarUrl && !isOrganizationActive ? (
          <Image source={{ uri: userAvatarUrl }} style={styles.avatarImage} />
        ) : isOrganizationActive ? (
          currentOrgLogoUrl ? (
            <Image source={{ uri: currentOrgLogoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, styles.orgAvatar]}>
              <Text style={styles.avatarLetter}>{avatarInitial}</Text>
            </View>
          )
        ) : (
          <View style={[styles.avatar]}>
            <Text style={styles.avatarLetter}>{avatarInitial}</Text>
          </View>
        )}

        {!isOrganizationActive && !uploadingImage && !loadingProfilePicture && (
          <View style={styles.avatarEditIcon}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
          </View>
        )}
        {isOrganizationActive && !loadingOrgLogo && (
          <View style={styles.avatarEditIcon}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
          </View>
        )}

        {(uploadingImage || loadingProfilePicture) && !isOrganizationActive && (
          <View style={styles.avatarLoadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        {loadingOrgLogo && isOrganizationActive && (
          <View style={styles.avatarLoadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.profileInfo}>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
        {hasFullAccount && !isOrganizationActive && (() => {
          const email = user?.email || '';
          const isPseudo = email.includes('@users.mylocalapp.de') || email.includes('@user.mylocalapp.de') || email.includes('@temp.mylocalapp.de');
          if (isPseudo) {
            const rawDate = profile?.created_at || user?.created_at;
            const since = rawDate ? new Date(rawDate).toLocaleDateString('de-DE') : null;
            return <Text style={styles.email}>{since ? `Mitglied seit ${since}` : 'Username-Account'}</Text>;
          }
          return <Text style={styles.email}>{email}</Text>;
        })()}
        {!hasFullAccount && (
          <Text style={styles.accountStatus}>Lokaler Account (nicht synchronisiert)</Text>
        )}
        {isOrganizationActive && currentUserRole && (
          <Text style={styles.roleText}>Deine Rolle: {currentUserRole === 'admin' ? 'Administrator' : 'Mitglied'}</Text>
        )}
      </View>

      <View style={styles.headerActions}>
        {!isOrganizationActive && (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onReloadProfile}
            disabled={authLoading || loadingProfilePicture}
          >
            <Ionicons name="refresh-outline" size={22} color="#4285F4" />
          </TouchableOpacity>
        )}
        {isOrganizationActive && (
          <>
            <TouchableOpacity style={styles.headerIconButton} onPress={onOpenOrgEdit}>
              <Ionicons name="pencil" size={20} color="#34A853" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={onReloadOrgContext}
              disabled={isOrgContextLoading}
            >
              <Ionicons name="refresh-outline" size={22} color="#17a2b8" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

export default ProfileHeader;
