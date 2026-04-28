import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors.js'

/**
 * Converts application errors into JSON responses
 * @param {any} err - Value used for err
 * @param {Object} _req - Req value
 * @param {Response<any, Record<string, any>, number>} res - Express response object
 * @param {NextFunction} _next - Value used for next
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  const status = err instanceof AppError ? err.statusCode : (err.status ?? 500)
  const message = err.message ?? 'Internal server error'
  res.status(status).json({ error: message })
}
