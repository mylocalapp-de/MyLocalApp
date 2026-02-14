/**
 * eventArticleService — Supabase operations for creating/editing event+article combos.
 */

import { supabase } from '../lib/supabase';

/**
 * Create an event with a linked article in one transaction.
 * If the article insert fails, the event is rolled back (deleted).
 */
export async function createEventArticle({ eventData, articleData }) {
  // Step 1: Insert event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();

  if (eventError) return { data: null, error: eventError };

  // Step 2: Insert linked article
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .insert({ ...articleData, linked_event_id: event.id })
    .select()
    .single();

  if (articleError) {
    // Rollback: delete the event
    await supabase.from('events').delete().eq('id', event.id);
    return { data: null, error: articleError };
  }

  return { data: { event, article }, error: null };
}

/**
 * Update an event and its linked article.
 */
export async function updateEventArticle({ eventId, linkedArticleId, eventUpdates, articleUpdates }) {
  // Update event
  const { error: eventError } = await supabase
    .from('events')
    .update(eventUpdates)
    .eq('id', eventId);

  if (eventError) return { error: eventError };

  // Update linked article if it exists
  if (linkedArticleId && articleUpdates) {
    const { error: articleError } = await supabase
      .from('articles')
      .update(articleUpdates)
      .eq('id', linkedArticleId);

    if (articleError) {
      console.error('Error updating linked article:', articleError);
      // Don't fail entirely — event is updated
    }
  }

  return { error: null };
}

/**
 * Fetch linked article ID for an event.
 */
export async function fetchLinkedArticleId(eventId) {
  return supabase
    .from('articles')
    .select('id')
    .eq('linked_event_id', eventId)
    .maybeSingle();
}

/**
 * Check organization membership for authorization.
 */
export async function checkOrgMembership(organizationId, userId) {
  return supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
}
