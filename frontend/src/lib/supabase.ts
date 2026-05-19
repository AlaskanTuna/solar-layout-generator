/**
 * Browser-side Supabase client factory.
 *
 * `createClient` is lazy because import.meta.env is only safe to read inside
 * the Vite-built bundle, and the singleton pattern avoids creating multiple
 * Realtime websocket connections from React's strict-mode double-mount.
 */

import { createClient } from '@supabase/supabase-js'

let supabaseClient: ReturnType<typeof createClient> | null = null

/**
 * Returns the singleton Supabase client, creating it on first call.
 *
 * @throws If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing —
 *   the app cannot run without these and failing loudly is better than
 *   producing confusing auth errors later.
 */
export function getSupabase() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY — set them in the root .env')
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}
