import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { chatRequestSchema } from '../validators/chat.js'
import * as chatService from '../services/chat/index.js'

/**
 * Project chat streaming routes
 */
export const chatRouter: ExpressRouter = Router()

chatRouter.post(
  '/:id/chat',
  requireAuth,
  validate(chatRequestSchema),
  asyncHandler(async (req, res) => {
    await chatService.streamChat(req, res)
  })
)
