/**
 * Supabase bearer-token authentication middleware.
 *
 * Verifies API requests against Supabase Auth and attaches the authenticated
 * user identity to Express requests for downstream route ownership checks.
 */

import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase.js'

declare global {
  namespace Express {
    // Declared here because this middleware is the source of truth for req.user.
    interface Request {
      user?: { id: string; email: string }
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <token>` session and stores the Supabase
 * user id/email on `req.user`.
 *
 * @param req - Incoming request carrying a Supabase access token
 * @param res - Response used for unauthorised JSON failures
 * @param next - Continuation called after successful authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn(`[Auth] Missing bearer token for ${req.method} ${req.originalUrl}`)
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    console.warn(`[Auth] Invalid session for ${req.method} ${req.originalUrl}`)
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  req.user = { id: data.user.id, email: data.user.email ?? '' }
  console.info(`[Auth] user=${req.user.id} ${req.method} ${req.originalUrl}`)
  next()
}
