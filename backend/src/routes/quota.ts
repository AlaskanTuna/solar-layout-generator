/**
 * User quota routing module.
 *
 * Provides the authenticated user's current project quota, tier, usage, and
 * reset time for frontend gating.
 */

import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { getQuotaSummary } from '../services/userService.js'

/**
 * Quota summary route
 */
export const quotaRouter: ExpressRouter = Router()

/** GET /api/quota/ through auth and async handling; returns the user's project quota summary. */
quotaRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await getQuotaSummary(req.user!.id)
    res.json(summary)
  })
)
