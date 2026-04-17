import type { Request, Response, NextFunction } from 'express'
import { verifyPdfToken, InvalidPdfTokenError } from '../services/pdfTokenService.js'

declare global {
  namespace Express {
    interface Request {
      pdfToken?: { userId: string; projectId: string }
    }
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const q = req.query.token
  if (typeof q === 'string' && q.length > 0) return q
  return null
}

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
