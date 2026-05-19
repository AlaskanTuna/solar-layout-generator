/**
 * Zod request-body validation middleware factory.
 *
 * Parses incoming JSON bodies through route-specific schemas and replaces
 * `req.body` with the typed, validated data consumed by handlers.
 */

import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

/**
 * Builds middleware that validates `req.body` against a Zod schema.
 *
 * @param schema - Route-specific schema for the expected request payload
 * @returns Express middleware that sends 400 on validation failure
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten() })
      return
    }
    req.body = result.data
    next()
  }
}
