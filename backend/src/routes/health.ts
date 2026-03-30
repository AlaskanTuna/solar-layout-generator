import { Router, type Router as ExpressRouter } from 'express'
import type { HealthResponse } from '@shared/types'

export const healthRouter: ExpressRouter = Router()

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = { status: 'ok' }
  res.json(body)
})
