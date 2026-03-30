import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createProjectSchema, saveLayoutSchema, saveAnalysisSchema } from '../validators/projects.js'
import * as projectService from '../services/projectService.js'

export const projectsRouter: ExpressRouter = Router()

// POST /api/projects
projectsRouter.post(
  '/',
  requireAuth,
  validate(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { name, locationId } = req.body
    console.info(`[ProjectCreate] user=${req.user!.id} location=${locationId} name="${name}"`)
    const project = await projectService.createProject(req.user!.id, name, locationId)
    res.status(201).json(project)
  })
)

// GET /api/projects
projectsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    console.info(`[ProjectList] user=${req.user!.id}`)
    const projects = await projectService.listProjects(req.user!.id)
    res.json(projects)
  })
)

// GET /api/projects/:id
projectsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    console.info(`[ProjectGet] user=${req.user!.id} project=${req.params.id as string}`)
    const project = await projectService.getProject(req.user!.id, req.params.id as string)
    if (!project) {
      console.warn(`[ProjectGet] not found user=${req.user!.id} project=${req.params.id as string}`)
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json(project)
  })
)

// DELETE /api/projects/:id
projectsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    console.info(`[ProjectDelete] user=${req.user!.id} project=${req.params.id as string}`)
    const deleted = await projectService.deleteProject(req.user!.id, req.params.id as string)
    if (!deleted) {
      console.warn(`[ProjectDelete] not found user=${req.user!.id} project=${req.params.id as string}`)
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json({ success: true })
  })
)

// PATCH /api/projects/:id/layout
projectsRouter.patch(
  '/:id/layout',
  requireAuth,
  validate(saveLayoutSchema),
  asyncHandler(async (req, res) => {
    console.info(
      `[ProjectSaveLayout] user=${req.user!.id} project=${req.params.id as string} panels=${req.body.editedLayout.length}`
    )
    const updated = await projectService.saveLayout(
      req.user!.id,
      req.params.id as string,
      req.body.editedLayout,
      req.body.selectedPanelModelId
    )
    if (!updated) {
      console.warn(`[ProjectSaveLayout] not found user=${req.user!.id} project=${req.params.id as string}`)
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
    console.info(`[ProjectSaveAnalysis] user=${req.user!.id} project=${req.params.id as string}`)
    const updated = await projectService.saveAnalysis(
      req.user!.id,
      req.params.id as string,
      req.body.analysisConfig,
      req.body.analysisResults
    )
    if (!updated) {
      console.warn(`[ProjectSaveAnalysis] not found user=${req.user!.id} project=${req.params.id as string}`)
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json(updated)
  })
)
