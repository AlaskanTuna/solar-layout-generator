/**
 * In-memory rate limiter for PDF export token issuance.
 *
 * Protects the export-token endpoint from rapid repeated requests per user.
 * This is intentionally scoped to token creation, not PDF data reads.
 */

import type { Request, Response, NextFunction } from 'express'

// Keep the PDF token issuance window human-readable in API responses.
const WINDOW_MS = 60 * 60 * 1000 // 1 hour
// Ten exports per hour is enough for normal retries without allowing bulk token minting.
const MAX_REQUESTS = 10

const hits = new Map<string, number[]>()

/**
 * Allows at most `MAX_REQUESTS` PDF token issuances per authenticated user
 * within the rolling `WINDOW_MS` interval.
 *
 * @param req - Authenticated request whose `req.user.id` keys the bucket
 * @param res - Response used for 401 and 429 JSON failures
 * @param next - Continuation called when the request is within quota
 */
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
