/**
 * dmService — Supabase operations for Direct Messages (user-to-user and org DMs).
 */

import { supabase } from '../lib/supabase';

// ─── Conversation Listing ────────────────────────────────────────────────────

export async function fetchDmConversations({ isOrgContext = false, organizationId = null } = {}) {
  let query = supabase
    .from('dm_conversation_list')
    .select('*');

  if (isOrgContext && organizationId) {
    query = query.eq('is_org_conversation', true).eq('organization_id', organizationId);
  }

  query = query.order('last_message_at', { ascending: false });
  return query;
}

// ─── Direct Messages ─────────────────────────────────────────────────────────

export async function fetchDirectMessages(conversationId) {
  return supabase
    .from('direct_messages')
    .select(`
      id,
      sender_id,
      text,
      image_url,
      created_at,
      sender:profiles ( display_name )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
}

export async function sendDirectMessage({ conversationId, senderId, text, imageUrl }) {
  return supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      text: text || null,
      image_url: imageUrl || null,
    })
    .select();
}

// ─── Conversation RPC helpers ────────────────────────────────────────────────

export async function findOrCreateUserDmConversation(otherUserId) {
  return supabase.rpc('find_or_create_user_dm_conversation', {
    p_other_user_id: otherUserId,
  });
}

export async function findOrCreateOrgDmConversation(organizationId) {
  return supabase.rpc('find_or_create_org_dm_conversation', {
    p_organization_id: organizationId,
  });
}

// ─── User Search & Organization listing ──────────────────────────────────────

export async function searchUsersByDisplayName(searchQuery) {
  return supabase.rpc('search_users_by_display_name', {
    p_search_query: searchQuery,
  });
}

export async function getOrganizationsWithMembers() {
  return supabase.rpc('get_organizations_with_members');
}

export async function getPublicUsers(excludeUserId) {
  return supabase.rpc('get_public_users', {
    p_exclude_user_id: excludeUserId,
  });
}

// ─── Real-time subscription for DM conversation ─────────────────────────────

export function subscribeToDmConversation(conversationId, callback) {
  const channel = supabase
    .channel(`public:direct_messages:conversation_id=eq.${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      callback
    )
    .subscribe();
  return channel;
}

export function subscribeToDmListChanges(callback) {
  const channel = supabase
    .channel('dm-list-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      callback
    )
    .subscribe();
  return channel;
}

export function removeChannel(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}
