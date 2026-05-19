/**
 * Supabase Storage wrapper for generated Solar API assets.
 *
 * Centralises uploads, downloads, and signed URL creation for the shared
 * GeoTIFF/PNG bucket used by the location pipeline.
 */

import { supabase } from '../config/supabase.js'

const BUCKET = 'geotiffs'

/**
 * Uploads a blob to the shared storage bucket, replacing any existing object.
 *
 * @param storagePath - Bucket-relative object path
 * @param buffer - File contents to store
 * @param contentType - MIME type sent to Supabase Storage
 */
export async function uploadToStorage(storagePath: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`)
}

/**
 * Downloads a blob from the shared storage bucket.
 *
 * @param storagePath - Bucket-relative object path
 * @returns Raw object bytes as an ArrayBuffer
 */
export async function downloadFromStorage(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw new Error(`Storage download failed for ${storagePath}: ${error.message}`)
  return data.arrayBuffer()
}

/**
 * Creates a signed read URL for a storage object.
 *
 * @param storagePath - Bucket-relative object path
 * @param expiresIn - URL lifetime in seconds
 * @returns Temporary public URL for reading the object
 */
export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) throw new Error(`Failed to create signed URL for ${storagePath}: ${error.message}`)
  return data.signedUrl
}
