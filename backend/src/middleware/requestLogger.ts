import type { RequestHandler } from 'express'

/**
 * Log inbound and completed HTTP requests
 * @param {Object} req - Incoming Express request object
 * @param {Response<any, Record<string, any>, number>} res - Express response object
 * @param {NextFunction} next - Express middleware continuation callback
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
