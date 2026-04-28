import type { NextFunction, Request, RequestHandler, Response } from 'express'

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

/**
 * Wraps an async route handler and forward rejected errors
 * @param {AsyncRouteHandler} handler - Async route handler to wrap
 * @returns {Object} The resulting async handler value
 */
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next)
  }
}
