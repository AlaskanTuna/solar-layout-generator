import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/** Service-role Supabase client used by the backend for storage uploads + admin auth lookups. Bypasses RLS. */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
