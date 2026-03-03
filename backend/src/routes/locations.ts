import { Router } from 'express'

export const locationsRouter = Router()

// POST /api/locations/resolve
locationsRouter.post('/resolve', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// GET /api/locations/:id/status
locationsRouter.get('/:id/status', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// GET /api/locations/:id/data
locationsRouter.get('/:id/data', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// POST /api/locations/:locationId/panels/recompute
locationsRouter.post('/:locationId/panels/recompute', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})
