/**
 * calendarService — Supabase operations for the CalendarScreen.
 */

import { supabase } from '../lib/supabase';

export async function fetchEventListings() {
  return supabase
    .from('event_listings')
    .select('*');
}

export async function fetchEventCategoriesForCalendar() {
  return supabase
    .from('event_categories')
    .select('name, is_highlighted')
    .order('display_order', { ascending: true });
}
