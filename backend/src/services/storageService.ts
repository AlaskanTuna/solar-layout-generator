import { supabase } from '../config/supabase.js'

const BUCKET = 'geotiffs'

/**
 * Upload a blob to the shared storage bucket
 * @param {string} storagePath - Storage path value
 * @param {Buffer} buffer - Value used for buffer
 * @param {string} contentType - Content type value
 */
export async function uploadToStorage(storagePath: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`)
}

/**
 * Download a blob from the shared storage bucket
 * @param {string} storagePath - Storage path value
 * @returns {Promise<ArrayBuffer>} A promise resolving to the resulting value
 */
export async function downloadFromStorage(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw new Error(`Storage download failed for ${storagePath}: ${error.message}`)
  return data.arrayBuffer()
}

/**
 * Creates a signed read URL for a storage object
 * @param {string} storagePath - Storage path value
 * @param {number} expiresIn - Value used for expires in
 * @returns {Promise<string>} A promise resolving to the requested signed url
 */
export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) throw new Error(`Failed to create signed URL for ${storagePath}: ${error.message}`)
  return data.signedUrl
}
