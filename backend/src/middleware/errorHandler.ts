/**
 * Final Express error-to-response adapter.
 *
 * Converts thrown application and unexpected errors into the JSON error shape
 * consumed by the frontend while preserving AppError status codes.
 */

import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors.js'

/**
 * Logs the error and maps it to `{ error }` JSON with either the AppError
 * status code, an attached HTTP status, or a generic 500.
 *
 * @param err - Error thrown by a route, middleware, or async handler
 * @param _req - Unused request object required by Express error middleware
 * @param res - Response used to send the JSON error payload
 * @param _next - Unused continuation required by Express error middleware
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  const status = err instanceof AppError ? err.statusCode : (err.status ?? 500)
  const message = err.message ?? 'Internal server error'
  res.status(status).json({ error: message })
}
