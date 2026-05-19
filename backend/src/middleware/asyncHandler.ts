/**
 * Async Express route wrapper.
 *
 * Normalises promise-returning handlers so rejected errors flow into the
 * central error handler instead of being handled in every route body.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express'

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

/**
 * Wraps an async route handler and forwards rejected promises to Express.
 *
 * @param handler - Promise-returning route implementation
 * @returns Express request handler that delegates failures to `next`
 */
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next)
  }
}
