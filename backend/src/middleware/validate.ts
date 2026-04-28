import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

/**
 * Validates req.body against a Zod schema
 * @param {ZodSchema<T>} schema - Value used for schema
 * @returns {Function} The resulting validate value
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
