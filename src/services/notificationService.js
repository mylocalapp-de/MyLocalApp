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

export async function fetchNotificationPreferences(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return { ...DEFAULT_PREFERENCES, ...data?.notification_preferences };
}

export async function updateNotificationPreferences(userId, preferences) {
  const { error } = await supabase
    .from('profiles')
    .update({ notification_preferences: preferences })
    .eq('id', userId);

  if (error) throw error;
  return preferences;
}
