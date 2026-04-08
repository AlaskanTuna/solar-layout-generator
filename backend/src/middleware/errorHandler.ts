import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  const status = err instanceof AppError ? err.statusCode : (err.status ?? 500)
  const message = err.message ?? 'Internal server error'
  res.status(status).json({ error: message })
}
