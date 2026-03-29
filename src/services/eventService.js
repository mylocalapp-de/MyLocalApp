/**
 * eventService — Supabase CRUD operations for events and event categories.
 */

import { supabase } from '../lib/supabase';

// ─── Event Categories ────────────────────────────────────────────────────────

export async function fetchEventCategories() {
  return supabase
    .from('event_categories')
    .select('name, is_highlighted, is_admin_only')
    .order('display_order', { ascending: true });
}

// ─── Events CRUD ─────────────────────────────────────────────────────────────

export async function fetchEvent(eventId) {
  return supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
}

export async function fetchEvents(filters = {}) {
  let query = supabase.from('events').select('*');

  if (filters.isPublished !== undefined) {
    query = query.eq('is_published', filters.isPublished);
  }
  if (filters.dateGte) {
    query = query.gte('date', filters.dateGte);
  }
  if (filters.dateLte) {
    query = query.lte('date', filters.dateLte);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.organizerId) {
    query = query.eq('organizer_id', filters.organizerId);
  }
  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }

  query = query.order('date', { ascending: true });
  return query;
}

export async function createEvent(eventData) {
  return supabase.from('events').insert(eventData).select().single();
}

export async function updateEvent(eventId, updates) {
  return supabase.from('events').update(updates).eq('id', eventId);
}

export async function deleteEvent(eventId) {
  return supabase.from('events').delete().eq('id', eventId);
}

// ─── Event Detail helpers ────────────────────────────────────────────────────

export async function fetchEventRaw(eventId) {
  return supabase.from('events').select('*').eq('id', eventId).single();
}

export async function fetchEventWithOrganizer(eventId) {
  return supabase
    .from('events')
    .select(`
      *,
      organizer:profiles ( display_name, avatar_url ),
      organization:organizations ( name, logo_url )
    `)
    .eq('id', eventId)
    .maybeSingle();
}

export async function fetchLinkedArticle(eventId) {
  return supabase
    .from('articles')
    .select('id')
    .eq('linked_event_id', eventId)
    .maybeSingle();
}

// ─── Event Reactions ─────────────────────────────────────────────────────────

export async function fetchEventReactions(eventId) {
  return supabase
    .from('event_reactions')
    .select('emoji, user_id')
    .eq('event_id', eventId);
}

export async function checkEventReaction(eventId, userId) {
  return supabase
    .from('event_reactions')
    .select('id, emoji')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
}

export async function deleteEventReaction(reactionId) {
  return supabase.from('event_reactions').delete().eq('id', reactionId);
}

export async function insertEventReaction({ eventId, userId, emoji }) {
  return supabase
    .from('event_reactions')
    .insert({ event_id: eventId, user_id: userId, emoji });
}

// ─── Event Comments ──────────────────────────────────────────────────────────

export async function fetchEventComments(eventId) {
  return supabase
    .from('event_comments')
    .select(`
      id, text, created_at, user_id,
      profiles ( display_name, avatar_url )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
}

export async function addEventComment({ eventId, userId, text }) {
  return supabase
    .from('event_comments')
    .insert({ event_id: eventId, user_id: userId, text })
    .select()
    .single();
}

export async function deleteEventComment(commentId) {
  return supabase.from('event_comments').delete().eq('id', commentId);
}

// ─── Event Attendance ────────────────────────────────────────────────────────

export async function fetchEventAttendees(eventId) {
  return supabase
    .from('event_attendees')
    .select('user_id, status, profiles ( display_name )')
    .eq('event_id', eventId);
}

export async function upsertEventAttendee({ eventId, userId, status }) {
  return supabase
    .from('event_attendees')
    .upsert(
      { event_id: eventId, user_id: userId, status },
      { onConflict: 'event_id,user_id' }
    );
}

export async function deleteEventAttendee(eventId, userId) {
  return supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
}

// ─── Event Detail Views & RPCs ───────────────────────────────────────────────

export async function fetchEventCommentsWithUsers(eventId) {
  return supabase
    .from('event_comments_with_users')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
}

export async function getEventReactionsRpc(eventId) {
  return supabase.rpc('get_event_reactions', { event_uuid: eventId });
}

export async function getEventAttendeesRpc(eventId) {
  return supabase.rpc('get_event_attendees', { event_uuid: eventId });
}

export async function fetchUserAttendanceStatus(eventId, userId) {
  return supabase
    .from('event_attendees')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
}

export async function fetchAttendeesWithUsers(eventId) {
  return supabase
    .from('event_attendees_with_users')
    .select('user_id, user_name, status')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
}

export async function deleteEventRpc(eventId, organizerId) {
  return supabase.rpc('delete_event', {
    p_event_id: eventId,
    p_organizer_id: organizerId,
  });
}

export async function deleteEventDirect(eventId, organizerId) {
  return supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('organizer_id', organizerId);
}
