import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Defines the supabase constant
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
