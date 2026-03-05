import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase.js'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string }
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  req.user = { id: data.user.id, email: data.user.email ?? '' }
  next()
}
