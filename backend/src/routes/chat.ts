/**
 * Project chat routing module.
 *
 * Accepts authenticated chat turns for a project and delegates streaming
 * response handling to the chat service.
 */

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

/** POST /api/projects/:id/chat through auth, body validation, and async handling; streams the assistant response. */
chatRouter.post(
  '/:id/chat',
  requireAuth,
  validate(chatRequestSchema),
  asyncHandler(async (req, res) => {
    await chatService.streamChat(req, res)
  })
)
