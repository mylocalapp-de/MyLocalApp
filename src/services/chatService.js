/**
 * chatService — Supabase operations for chat groups, messages, reactions, comments,
 * push notification subscriptions, and real-time channel management.
 */

import { supabase } from '../lib/supabase';

// ─── Chat Group Tags / Filters ───────────────────────────────────────────────

export async function fetchChatGroupTags() {
  return supabase
    .from('chat_group_tags')
    .select('name, is_highlighted, is_admin_only')
    .order('display_order', { ascending: true });
}

// ─── Chat Group Listings ─────────────────────────────────────────────────────

export async function fetchChatGroupListings() {
  return supabase
    .from('chat_group_listings')
    .select('*')
    .neq('type', 'bot');
}

// ─── Chat Groups CRUD ────────────────────────────────────────────────────────

export async function fetchOrgBroadcastGroups(organizationId) {
  return supabase
    .from('chat_groups')
    .select('id, name, description, tags, type, organization_id')
    .eq('type', 'broadcast')
    .eq('organization_id', organizationId);
}

export async function createChatGroup(groupData) {
  return supabase.from('chat_groups').insert(groupData).select().single();
}

export async function updateChatGroup(groupId, organizationId, updates) {
  return supabase
    .from('chat_groups')
    .update(updates)
    .eq('id', groupId)
    .eq('organization_id', organizationId);
}

export async function deleteChatGroup(groupId, organizationId) {
  return supabase
    .from('chat_groups')
    .delete()
    .eq('id', groupId)
    .eq('organization_id', organizationId);
}

// ─── Chat Messages ───────────────────────────────────────────────────────────

export async function fetchChatMessages(chatGroupId) {
  return supabase
    .from('chat_messages_with_users')
    .select('*')
    .eq('chat_group_id', chatGroupId)
    .order('created_at', { ascending: true });
}

export async function sendChatMessage({ chatGroupId, text, imageUrl, userId }) {
  return supabase
    .from('chat_messages')
    .insert({
      chat_group_id: chatGroupId,
      text: text || null,
      image_url: imageUrl || null,
      user_id: userId || null,
    })
    .select();
}

// ─── Message Comments ────────────────────────────────────────────────────────

export async function fetchMessageComments(messageIds) {
  return supabase
    .from('message_comments')
    .select(`
      id,
      message_id,
      user_id,
      text,
      created_at,
      profiles ( display_name )
    `)
    .in('message_id', messageIds)
    .order('created_at', { ascending: true });
}

export async function addMessageComment({ messageId, userId, text }) {
  return supabase
    .from('message_comments')
    .insert({ message_id: messageId, user_id: userId, text });
}

// ─── Message Reactions ───────────────────────────────────────────────────────

export async function fetchReactionsForMessages(messageIds) {
  return supabase.rpc('get_reactions_for_messages', { message_ids: messageIds });
}

export async function addMessageReaction({ messageId, userId, emoji }) {
  return supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
}

// ─── Push Notification Subscriptions ─────────────────────────────────────────

export async function checkAnonymousSubscription(chatGroupId, expoPushToken) {
  return supabase
    .from('anonymous_push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('chat_group_id', chatGroupId)
    .eq('expo_push_token', expoPushToken);
}

export async function checkAuthenticatedSubscription(userId, chatGroupId) {
  return supabase
    .from('push_notification_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('chat_group_id', chatGroupId);
}

export async function deleteAnonymousSubscription(chatGroupId, expoPushToken) {
  return supabase
    .from('anonymous_push_subscriptions')
    .delete()
    .eq('chat_group_id', chatGroupId)
    .eq('expo_push_token', expoPushToken);
}

export async function deleteAuthenticatedSubscription(userId, chatGroupId) {
  return supabase
    .from('push_notification_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('chat_group_id', chatGroupId);
}

export async function insertAuthenticatedSubscription({ userId, chatGroupId, expoPushToken }) {
  return supabase
    .from('push_notification_subscriptions')
    .insert({ user_id: userId, chat_group_id: chatGroupId, expo_push_token: expoPushToken });
}

export async function insertAnonymousSubscription({ chatGroupId, expoPushToken }) {
  return supabase
    .from('anonymous_push_subscriptions')
    .insert({ chat_group_id: chatGroupId, expo_push_token: expoPushToken });
}

// ─── Real-time Channel Helpers ───────────────────────────────────────────────

/**
 * Subscribe to a Supabase real-time channel.
 * Returns the channel object (caller must handle cleanup with removeChannel).
 */
export function subscribeToChannel(channelName, config, callback) {
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', config, callback)
    .subscribe();
  return channel;
}

export function removeChannel(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}
