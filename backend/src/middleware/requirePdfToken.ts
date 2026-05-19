/**
 * PDF export token authentication middleware.
 *
 * Validates short-lived PDF export tokens and attaches the token claims used
 * by the unauthenticated PDF data route.
 */

import type { Request, Response, NextFunction } from 'express'
import { verifyPdfToken, InvalidPdfTokenError } from '../services/pdfTokenService.js'

declare global {
  namespace Express {
    // Declared here because this middleware is the only writer of req.pdfToken.
    interface Request {
      pdfToken?: { userId: string; projectId: string }
    }
  }
}

/**
 * Extracts a PDF token from either the Bearer header or `?token=`.
 *
 * The header path is used by API clients; the query-string fallback supports
 * browser/PDF renderer navigations where custom headers are awkward.
 *
 * @param req - Request that may carry the export token in either supported location
 * @returns The raw token string, or `null` when no token is present
 */
function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const q = req.query.token
  if (typeof q === 'string' && q.length > 0) return q
  return null
}

/**
 * Verifies a PDF export token, ensures it matches the requested project id,
 * and stores the authorised user/project claims on `req.pdfToken`.
 *
 * @param req - Request carrying the PDF token and optional project route param
 * @param res - Response used for missing, invalid, or mismatched token failures
 * @param next - Continuation called after token validation succeeds
 */
export function requirePdfToken(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) {
    console.warn(`[PdfToken] Missing token for ${req.method} ${req.originalUrl}`)
    res.status(401).json({ error: 'Missing PDF export token' })
    return
  }

  try {
    const payload = verifyPdfToken(token)
    const pathProjectId = req.params.id
    if (pathProjectId && payload.projectId !== pathProjectId) {
      console.warn(`[PdfToken] Token/path project mismatch: token=${payload.projectId} path=${pathProjectId}`)
      res.status(403).json({ error: 'Token does not match requested project' })
      return
    }
    req.pdfToken = { userId: payload.sub, projectId: payload.projectId }
    next()
  } catch (err) {
    if (err instanceof InvalidPdfTokenError) {
      console.warn(`[PdfToken] Invalid token for ${req.method} ${req.originalUrl}: ${err.message}`)
      res.status(401).json({ error: 'Invalid PDF export token', reason: err.message })
      return
    }
    throw err
  }
}
