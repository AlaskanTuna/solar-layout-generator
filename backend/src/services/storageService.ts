import { supabase } from '../config/supabase.js'

const BUCKET = 'geotiffs'

export async function uploadToStorage(storagePath: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`)
}

export async function downloadFromStorage(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw new Error(`Storage download failed for ${storagePath}: ${error.message}`)
  return data.arrayBuffer()
}

export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) throw new Error(`Failed to create signed URL for ${storagePath}: ${error.message}`)
  return data.signedUrl
}
