/**
 * profileService — Supabase operations for user profiles, organizations lookup,
 * and related queries used across profile view screens.
 */

import { supabase } from '../lib/supabase';

// ─── Profile Fetching ────────────────────────────────────────────────────────

export async function fetchProfile(userId) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
}

export async function fetchProfileAvatars(userIds) {
  return supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', userIds);
}

export async function updateProfile(userId, updates) {
  return supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
}

// ─── Organization Membership Check ──────────────────────────────────────────

export async function checkOrgMembership(organizationId, userId) {
  return supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
}

// ─── Organization Profile View ──────────────────────────────────────────────

export async function fetchOrganization(organizationId) {
  return supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();
}

export async function fetchOrganizationLogo(organizationId) {
  return supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', organizationId)
    .single();
}

// ─── User articles / events for profile views ───────────────────────────────

export async function fetchUserArticles(userId) {
  return supabase
    .from('articles')
    .select('*')
    .eq('author_id', userId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });
}

export async function fetchUserEvents(userId) {
  return supabase
    .from('events')
    .select('*')
    .eq('organizer_id', userId)
    .eq('is_published', true)
    .order('date', { ascending: false });
}

export async function fetchOrgArticles(organizationId) {
  return supabase
    .from('articles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });
}

export async function fetchOrgEvents(organizationId) {
  return supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .order('date', { ascending: false });
}

// ─── Verification ────────────────────────────────────────────────────────────

export async function updateVerificationStatus(userId, isVerified) {
  return supabase
    .from('profiles')
    .update({ is_verified: isVerified })
    .eq('id', userId);
}

// ─── Organization Setup ─────────────────────────────────────────────────────

export async function updateProfileDisplayName(userId, displayName) {
  return supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId);
}

export async function createOrganization(orgData) {
  return supabase.from('organizations').insert(orgData).select().single();
}
