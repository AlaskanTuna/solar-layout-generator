import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requirePdfToken } from '../middleware/requirePdfToken.js'
import { pdfTokenRateLimit } from '../middleware/pdfTokenRateLimit.js'
import { checkQuota } from '../middleware/checkQuota.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createProjectSchema, saveLayoutSchema, saveAnalysisSchema } from '../validators/projects.js'
import * as projectService from '../services/projectService.js'
import { signPdfToken } from '../services/pdfTokenService.js'
import { getSignedUrl } from '../services/storageService.js'
import { loadReferenceGeoTransform } from '../services/geoTiffService.js'
import { NotFoundError } from '../errors.js'

export const projectsRouter: ExpressRouter = Router()

// POST /api/projects
projectsRouter.post(
  '/',
  requireAuth,
  checkQuota,
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
      throw new NotFoundError('Project not found')
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
      throw new NotFoundError('Project not found')
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
      throw new NotFoundError('Project not found')
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
      throw new NotFoundError('Project not found')
    }
    res.json(updated)
  })
)

// POST /api/projects/:id/pdf-token — session-auth'd, returns short-lived token for the PDF service
projectsRouter.post(
  '/:id/pdf-token',
  requireAuth,
  pdfTokenRateLimit,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string
    const project = await projectService.getProject(req.user!.id, projectId)
    if (!project) {
      console.warn(`[PdfToken] project not found user=${req.user!.id} project=${projectId}`)
      throw new NotFoundError('Project not found')
    }
    const { token, expiresAt } = signPdfToken(req.user!.id, projectId)
    console.info(`[PdfToken] issued user=${req.user!.id} project=${projectId} expiresAt=${expiresAt}`)
    res.json({ token, expiresAt })
  })
)

// GET /api/projects/:id/pdf-data — pdf-token-auth'd, returns project+location bundle for the print view
projectsRouter.get(
  '/:id/pdf-data',
  requirePdfToken,
  asyncHandler(async (req, res) => {
    const { userId, projectId } = req.pdfToken!
    const project = await projectService.getProject(userId, projectId)
    if (!project) {
      console.warn(`[PdfData] project not found user=${userId} project=${projectId}`)
      throw new NotFoundError('Project not found')
    }
    // Supabase Storage paths need a signed URL to render in the print view.
    const rgbPath = project.location?.rgbImageUrl
    const rgbSignedUrl = rgbPath ? await getSignedUrl(rgbPath) : null
    // Include imageGeoTransform so the print view can place panels with the same
    // proj4 math WorkbenchPage uses (matches sizes exactly).
    const imageGeoTransform = project.location
      ? await loadReferenceGeoTransform({
          id: project.location.id,
          dsmPath: project.location.dsmPath ?? null
        }).catch(() => null)
      : null
    res.json({ ...project, rgbSignedUrl, imageGeoTransform })
  })
)
