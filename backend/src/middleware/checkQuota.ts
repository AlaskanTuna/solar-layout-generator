import type { Request, Response, NextFunction } from 'express'
import { getQuotaSummary } from '../services/userService.js'

export async function checkQuota(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const summary = await getQuotaSummary(req.user.id)
    if (summary.limit !== null && summary.used >= summary.limit) {
      console.warn(
        `[Quota] user=${req.user.id} tier=${summary.tier} used=${summary.used}/${summary.limit} — blocked`
      )
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
