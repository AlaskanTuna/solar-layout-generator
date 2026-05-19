/**
 * HTTP request logging middleware.
 *
 * Emits one log line when a request arrives and another when the response
 * finishes, including duration, status code, and authenticated user id.
 */

import type { RequestHandler } from 'express'

/**
 * Records request start time and logs the completed response on `finish`.
 *
 * @param req - Incoming request whose method, URL, and user are logged
 * @param res - Response that emits the completion event
 * @param next - Continuation called immediately after listener registration
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now()

  console.info(`[HTTP] --> ${req.method} ${req.originalUrl}`)

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const userId = req.user?.id ?? 'anonymous'
    console.info(`[HTTP] <-- ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms user=${userId}`)
  })

  next()
}
