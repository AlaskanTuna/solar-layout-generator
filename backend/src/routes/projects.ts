import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createProjectSchema, saveLayoutSchema, saveAnalysisSchema } from '../validators/projects.js'
import * as projectService from '../services/projectService.js'

export const projectsRouter = Router()

// POST /api/projects
projectsRouter.post(
  '/',
  requireAuth,
  validate(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { name, locationId } = req.body
    const project = await projectService.createProject(req.user!.id, name, locationId)
    res.status(201).json(project)
  })
)

// GET /api/projects
projectsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projects = await projectService.listProjects(req.user!.id)
    res.json(projects)
  })
)

// GET /api/projects/:id
projectsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await projectService.getProject(req.user!.id, req.params.id as string)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json(project)
  })
)

// PATCH /api/projects/:id/layout
projectsRouter.patch(
  '/:id/layout',
  requireAuth,
  validate(saveLayoutSchema),
  asyncHandler(async (req, res) => {
    const updated = await projectService.saveLayout(req.user!.id, req.params.id as string, req.body.editedLayout)
    if (!updated) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json(updated)
  })
)

// PATCH /api/projects/:id/analysis
projectsRouter.patch(
  '/:id/analysis',
  requireAuth,
  validate(saveAnalysisSchema),
  asyncHandler(async (req, res) => {
    const updated = await projectService.saveAnalysis(
      req.user!.id,
      req.params.id as string,
      req.body.analysisConfig,
      req.body.analysisResults
    )
    if (!updated) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json(updated)
  })
)
