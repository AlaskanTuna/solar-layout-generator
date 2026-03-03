import { Router } from 'express'

export const tariffRouter = Router()

// GET /api/tariff/config
tariffRouter.get('/config', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})
