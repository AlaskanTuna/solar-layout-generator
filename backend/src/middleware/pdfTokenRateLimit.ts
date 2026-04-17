import type { Request, Response, NextFunction } from 'express'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 10

const hits = new Map<string, number[]>()

export function pdfTokenRateLimit(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const recent = (hits.get(userId) ?? []).filter((ts) => ts > cutoff)

  if (recent.length >= MAX_REQUESTS) {
    const oldestInWindow = recent[0]
    const resetAt = oldestInWindow !== undefined ? new Date(oldestInWindow + WINDOW_MS).toISOString() : undefined
    console.warn(`[PdfTokenRateLimit] user=${userId} blocked at ${recent.length}/${MAX_REQUESTS}`)
    res.status(429).json({
      error: 'Too many PDF export requests',
      limit: MAX_REQUESTS,
      windowHours: 1,
      resetAt
    })
    return
  }

  recent.push(now)
  hits.set(userId, recent)
  next()
}
