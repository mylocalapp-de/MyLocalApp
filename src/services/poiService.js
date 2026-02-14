/**
 * poiService — Supabase CRUD operations for map POIs and map configuration.
 */

import { supabase } from '../lib/supabase';

// ─── Map Config ──────────────────────────────────────────────────────────────

export async function fetchMapConfig() {
  return supabase
    .from('map_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
}

// ─── Map POIs ────────────────────────────────────────────────────────────────

export async function fetchMapPois() {
  return supabase.from('map_pois').select('*');
}

export async function createPoi(poiData) {
  return supabase.from('map_pois').insert(poiData).select().single();
}

export async function deletePoi(poiId, organizationId) {
  return supabase
    .from('map_pois')
    .delete()
    .eq('id', poiId)
    .eq('organization_id', organizationId);
}

// ─── POI Categories ──────────────────────────────────────────────────────────

export async function fetchPoiCategories() {
  return supabase
    .from('map_poi_categories')
    .select('name')
    .order('display_order', { ascending: true });
}
