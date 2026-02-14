/**
 * articleService — Supabase CRUD operations for articles and article_images.
 */

import { supabase } from '../lib/supabase';

/**
 * Fetch article filters/types from the database.
 * @param {Object} [opts]
 * @param {boolean} [opts.isPersonal=false]
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function fetchArticleTypes({ isPersonal = false } = {}) {
  const { data, error } = await supabase
    .from('article_filters')
    .select('name, is_highlighted, is_admin_only, enable_personal')
    .order('display_order', { ascending: true });

  if (error) return { data: [], error };

  const filtered = data
    .filter(item => !item.is_admin_only && (!isPersonal || item.enable_personal))
    .map(item => ({ name: item.name, is_highlighted: item.is_highlighted || false }));

  return { data: filtered, error: null };
}

/**
 * Create a new article.
 */
export async function createArticle(articleData) {
  return supabase.from('articles').insert(articleData).select().single();
}

/**
 * Update an existing article.
 */
export async function updateArticle(articleId, updates) {
  return supabase.from('articles').update(updates).eq('id', articleId).select().single();
}

/**
 * Save article images records.
 * @param {Array<{article_id, image_url, display_order}>} records
 */
export async function saveArticleImages(records) {
  if (!records || records.length === 0) return { error: null };
  return supabase.from('article_images').insert(records);
}

/**
 * Delete article images by IDs.
 */
export async function deleteArticleImages(imageIds) {
  if (!imageIds || imageIds.length === 0) return { error: null };
  return supabase.from('article_images').delete().in('id', imageIds);
}

/**
 * Save article attachment records.
 */
export async function saveArticleAttachments(records) {
  if (!records || records.length === 0) return { error: null };
  return supabase.from('article_attachments').insert(records);
}

/**
 * Delete article attachments by IDs.
 */
export async function deleteArticleAttachments(attachmentIds) {
  if (!attachmentIds || attachmentIds.length === 0) return { error: null };
  return supabase.from('article_attachments').delete().in('id', attachmentIds);
}

/**
 * Fetch article images for a given article.
 */
export async function fetchArticleImages(articleId) {
  return supabase
    .from('article_images')
    .select('id, image_url, display_order')
    .eq('article_id', articleId)
    .order('display_order', { ascending: true });
}

/**
 * Fetch article attachments for a given article.
 */
export async function fetchArticleAttachments(articleId) {
  return supabase
    .from('article_attachments')
    .select('id, file_url, file_name, file_size, mime_type, display_order')
    .eq('article_id', articleId)
    .order('display_order', { ascending: true });
}
