import { Router } from 'express'

export const projectsRouter = Router()

// POST /api/projects
projectsRouter.post('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// GET /api/projects
projectsRouter.get('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// GET /api/projects/:id
projectsRouter.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// PATCH /api/projects/:id/layout
projectsRouter.patch('/:id/layout', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// PATCH /api/projects/:id/analysis
projectsRouter.patch('/:id/analysis', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})
