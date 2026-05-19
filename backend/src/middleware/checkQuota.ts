/**
 * Project creation quota middleware.
 *
 * Checks the authenticated user's current daily project usage before allowing
 * routes that create quota-counted projects to continue.
 */

import type { Request, Response, NextFunction } from 'express'
import { getQuotaSummary } from '../services/userService.js'

/**
 * Blocks authenticated users whose daily project count has reached their tier limit.
 *
 * @param req - Authenticated request whose `req.user.id` is checked
 * @param res - Response used for unauthorised and quota-exceeded failures
 * @param next - Continuation called when the user has remaining quota
 */
export async function checkQuota(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const summary = await getQuotaSummary(req.user.id)
    if (summary.limit !== null && summary.used >= summary.limit) {
      console.warn(`[Quota] user=${req.user.id} tier=${summary.tier} used=${summary.used}/${summary.limit} — blocked`)
      res.status(429).json({
        error: 'Daily project limit reached',
        tier: summary.tier,
        used: summary.used,
        limit: summary.limit,
        resetsAt: summary.resetsAt
      })
      return
    }
    next()
  } catch (err) {
    next(err)
  }
}
