import type { RequestHandler } from 'express'

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
