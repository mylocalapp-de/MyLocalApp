import { supabase } from '../lib/supabase';

const DEFAULT_PREFERENCES = {
  comments: true,
  direct_messages: true,
  filter_aktuell: false,
  filter_schwarzes_brett: false,
  filter_mitfahrboerse: false,
  filter_veranstaltungen: false,
  filter_hilfe: false,
  org_articles: false,
};

/**
 * Fetch notification preferences + all organizations with per-org defaults.
 * Returns { ...prefs, organizations: [{ id, name }] }.
 * Per-org keys (org_articles_<uuid>) default to the master `org_articles` value
 * when not explicitly set.
 */
export async function fetchNotificationPreferences(userId) {
  // Fetch prefs and orgs in parallel
  const [prefsResult, orgsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single(),
    supabase
      .from('organizations')
      .select('id, name')
      .eq('is_verein', true)
      .order('name'),
  ]);

  if (prefsResult.error) throw prefsResult.error;

  const raw = prefsResult.data?.notification_preferences || {};
  const prefs = { ...DEFAULT_PREFERENCES, ...raw };
  const organizations = orgsResult.data || [];

  // Fill in per-org defaults: if no explicit key exists, inherit from master toggle
  for (const org of organizations) {
    const orgKey = `org_articles_${org.id}`;
    if (prefs[orgKey] === undefined || prefs[orgKey] === null) {
      prefs[orgKey] = prefs.org_articles;
    }
  }

  return { ...prefs, organizations };
}

export async function updateNotificationPreferences(userId, preferences) {
  // Strip the transient `organizations` array before persisting
  const { organizations, ...prefsToSave } = preferences;

  const { error } = await supabase
    .from('profiles')
    .update({ notification_preferences: prefsToSave })
    .eq('id', userId);

  if (error) throw error;
  return preferences;
}
