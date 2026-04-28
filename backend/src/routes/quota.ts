import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { getQuotaSummary } from '../services/userService.js'

export const quotaRouter: ExpressRouter = Router()

quotaRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await getQuotaSummary(req.user!.id)
    res.json(summary)
  })
)
