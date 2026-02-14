/**
 * OrganizationManager — Members list, invite code, quick links, leave/delete org.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Clipboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';

const OrganizationManager = ({
  activeOrganization,
  activeOrganizationId,
  organizationMembers,
  isFetchingMembers,
  orgMgmtError,
  memberManagementLoading,
  isOrgContextLoading,
  authLoading,
  currentUserId,
  navigation,
  onSwitchToPersonal,
  onLeaveOrg,
  onDeleteOrg,
  onRemoveMember,
  onMakeAdmin,
}) => {
  if (!activeOrganization || !activeOrganization.currentUserRole) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#4285F4" />
      </View>
    );
  }

  const isAdmin = activeOrganization.currentUserRole === 'admin';

  const copyInviteCode = () => {
    if (activeOrganization.invite_code) {
      Clipboard.setString(activeOrganization.invite_code);
      Alert.alert('Kopiert!', 'Einladungscode wurde in die Zwischenablage kopiert.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Organisationsdetails</Text>

      {activeOrganization.invite_code && (
        <View style={styles.inviteCodeContainer}>
          <Text style={styles.inviteLabel}>Einladungscode:</Text>
          <Text style={styles.inviteCodeText}>{activeOrganization.invite_code}</Text>
          <TouchableOpacity onPress={copyInviteCode} style={styles.copyButton}>
            <Ionicons name="copy-outline" size={20} color="#4285F4" />
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.membersTitle}>Mitglieder ({organizationMembers.length})</Text>
      {isFetchingMembers ? (
        <ActivityIndicator color="#4285F4" style={{ marginVertical: 10 }} />
      ) : orgMgmtError ? (
        <Text style={styles.errorText}>{orgMgmtError}</Text>
      ) : organizationMembers.length > 0 ? (
        <View style={styles.memberListContainer}>
          {organizationMembers.map(item => (
            <View key={item.user_id} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {item.display_name || 'Unbekannter Benutzer'}
                  {item.user_id === currentUserId ? ' (Du)' : ''}
                </Text>
                <Text style={styles.memberRole}>{item.role === 'admin' ? 'Admin' : 'Mitglied'}</Text>
              </View>
              {isAdmin && item.user_id !== currentUserId && (
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={[styles.memberActionButton, styles.removeButton]}
                    onPress={() => onRemoveMember(item.user_id, item.display_name)}
                    disabled={memberManagementLoading}
                  >
                    <Text style={styles.memberActionButtonTextRemove}>Entfernen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.memberActionButton, styles.makeAdminButton]}
                    onPress={() => onMakeAdmin(item.user_id, item.display_name)}
                    disabled={memberManagementLoading}
                  >
                    <Text style={styles.memberActionButtonTextAdmin}>Admin ernennen</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noMembersText}>Keine Mitglieder gefunden.</Text>
      )}

      {memberManagementLoading && <ActivityIndicator size="small" color="#666" style={{ marginVertical: 5 }} />}

      <View style={styles.linkListContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('CreateArticle')} style={styles.linkItem}>
          <Text style={styles.linkText}>Neuen Artikel erstellen</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ManageBroadcastGroups')} style={styles.linkItem}>
          <Text style={styles.linkText}>Chatgruppen verwalten</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} style={styles.linkItem}>
          <Text style={styles.linkText}>Neues Event erstellen</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('CreatePoi')} style={styles.linkItem}>
          <Text style={styles.linkText}>Neuen Marker auf der Karte setzen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.separator} />

      <TouchableOpacity
        style={[styles.button, styles.switchButton]}
        onPress={onSwitchToPersonal}
        disabled={isOrgContextLoading}
      >
        {isOrgContextLoading ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          <Text style={styles.switchButtonText}>Zu persönlichem Account wechseln</Text>
        )}
      </TouchableOpacity>

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.button, styles.leaveButton]}
          onPress={() => onDeleteOrg(activeOrganizationId, activeOrganization.name)}
          disabled={isOrgContextLoading || authLoading}
        >
          {(isOrgContextLoading || authLoading) ? (
            <ActivityIndicator size="small" color="#dc3545" />
          ) : (
            <Text style={styles.leaveButtonText}>Organisation löschen</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.leaveButton]}
          onPress={() => onLeaveOrg(activeOrganizationId, activeOrganization.name)}
          disabled={isOrgContextLoading || authLoading}
        >
          {(isOrgContextLoading || authLoading) ? (
            <ActivityIndicator size="small" color="#dc3545" />
          ) : (
            <Text style={styles.leaveButtonText}>Organisation verlassen</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default OrganizationManager;
