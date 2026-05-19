/**
 * Health-check routing module.
 *
 * Exposes the lightweight liveness endpoint used by hosting platforms,
 * monitors, and local development smoke checks.
 */

import { Router, type Router as ExpressRouter } from 'express'
import type { HealthResponse } from '@shared/types'

/**
 * Basic health check router
 */
export const healthRouter: ExpressRouter = Router()

/** GET /api/health/ without middleware; returns the service liveness status. */
healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = { status: 'ok' }
  res.json(body)
})
