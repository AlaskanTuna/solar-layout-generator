import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const TOKEN_TTL_SECONDS = 60
const TOKEN_TYPE = 'pdf-export' as const

/**
 * Claims stored inside a PDF export token
 */
export type PdfTokenPayload = {
  sub: string
  projectId: string
  type: typeof TOKEN_TYPE
}

/**
 * Signed PDF token response
 */
export type SignedPdfToken = {
  token: string
  expiresAt: string
}

/**
 * Sign a short-lived PDF export token
 * @param {string} userId - Authenticated user identifier
 * @param {string} projectId - Project identifier
 * @returns {SignedPdfToken} The resulting sign pdf token value
 */
export function signPdfToken(userId: string, projectId: string): SignedPdfToken {
  const token = jwt.sign({ sub: userId, projectId, type: TOKEN_TYPE } satisfies PdfTokenPayload, env.PDF_TOKEN_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS
  })
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString()
  return { token, expiresAt }
}

/**
 * Error thrown when a PDF token cannot be verified
 */
export class InvalidPdfTokenError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'InvalidPdfTokenError'
  }
}

/**
 * Verify and decode a PDF export token
 * @param {string} token - Token value
 * @returns {PdfTokenPayload} The resulting verify pdf token value
 */
export function verifyPdfToken(token: string): PdfTokenPayload {
  let decoded: unknown
  try {
    decoded = jwt.verify(token, env.PDF_TOKEN_SECRET, { algorithms: ['HS256'] })
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new InvalidPdfTokenError('Token expired')
    if (err instanceof jwt.JsonWebTokenError) throw new InvalidPdfTokenError('Token signature invalid')
    throw new InvalidPdfTokenError('Token verification failed')
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('sub' in decoded) ||
    !('projectId' in decoded) ||
    !('type' in decoded)
  ) {
    throw new InvalidPdfTokenError('Token payload shape invalid')
  }

  const { sub, projectId, type } = decoded as Record<string, unknown>
  if (typeof sub !== 'string' || typeof projectId !== 'string' || type !== TOKEN_TYPE) {
    throw new InvalidPdfTokenError('Token claims invalid')
  }

  return { sub, projectId, type: TOKEN_TYPE }
}
