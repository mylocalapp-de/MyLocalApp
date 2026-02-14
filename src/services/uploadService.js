/**
 * uploadService — Centralized image and file upload helpers for Supabase Storage.
 * Replaces the duplicated upload logic across Create/Edit Article/Event screens.
 */

import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload a single image (with base64 data) to a Supabase storage bucket.
 *
 * @param {Object} asset - ImagePicker asset with .uri, .base64, .mimeType
 * @param {string} [bucket='article_images'] - Storage bucket name
 * @param {string} [pathPrefix=''] - Optional path prefix (e.g. 'events/')
 * @returns {Promise<string|null>} Public URL or null on failure
 */
export async function uploadImage(asset, bucket = 'article_images', pathPrefix = '') {
  if (!asset || !asset.base64) return null;

  const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${uuidv4()}.${fileExt}`;
  const filePath = `${pathPrefix}${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, decode(asset.base64), {
      contentType: asset.mimeType ?? `image/${fileExt}`,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return urlData?.publicUrl ?? null;
}

/**
 * Upload multiple images in parallel.
 *
 * @param {Array} assets - Array of ImagePicker assets
 * @param {string} [bucket='article_images']
 * @param {string} [pathPrefix='']
 * @returns {Promise<string[]>} Array of public URLs (failed uploads filtered out)
 */
export async function uploadImages(assets, bucket = 'article_images', pathPrefix = '') {
  if (!assets || assets.length === 0) return [];

  const results = await Promise.all(
    assets.map(async (asset) => {
      try {
        return await uploadImage(asset, bucket, pathPrefix);
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

/**
 * Upload a single file (from DocumentPicker) to Supabase storage.
 *
 * @param {Object} asset - DocumentPicker asset with .uri, .name, .size, .mimeType
 * @param {string} [bucket='article_images']
 * @param {string} [pathPrefix='attachments/']
 * @returns {Promise<Object|null>} { url, name, size, mimeType } or null
 */
export async function uploadFile(asset, bucket = 'article_images', pathPrefix = 'attachments/') {
  if (!asset || !asset.uri) return null;

  try {
    const fileExt = asset.name?.split('.').pop()?.toLowerCase() ?? 'bin';
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${pathPrefix}${fileName}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: asset.mimeType ?? 'application/octet-stream',
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      url: urlData?.publicUrl,
      name: asset.name || fileName,
      size: asset.size || 0,
      mimeType: asset.mimeType || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

/**
 * Upload multiple files in parallel.
 *
 * @param {Array} assets
 * @param {string} [bucket='article_images']
 * @param {string} [pathPrefix='attachments/']
 * @returns {Promise<Object[]>} Array of { url, name, size, mimeType }
 */
export async function uploadFiles(assets, bucket = 'article_images', pathPrefix = 'attachments/') {
  if (!assets || assets.length === 0) return [];

  const results = await Promise.all(
    assets.map((asset) => uploadFile(asset, bucket, pathPrefix))
  );

  return results.filter(Boolean);
}

/**
 * Helper: get Ionicons name for a file mime type.
 */
export function getFileIcon(mimeType) {
  if (!mimeType) return 'document-outline';
  if (mimeType.includes('pdf')) return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive-outline';
  if (mimeType.includes('audio')) return 'musical-notes-outline';
  if (mimeType.includes('video')) return 'videocam-outline';
  return 'document-outline';
}

/**
 * Helper: format file size for display.
 */
export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
