import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { getSignedUrl } from './storageService.js'
import { loadReferenceGeoTransform } from './geoTiffService.js'
import type { PanelEdit } from '@shared/types'
import {
  buildPdfProjectResponse,
  mergeAnalysisConfig,
  mergeLayoutPreferences,
  normalizeProjectResponse,
  serializeJsonValue,
  type AnalysisConfigDto,
  type AnalysisResultsDto,
  type LayoutPreferencesDto
} from './viewModels/projectResponse.js'

async function findOwnedProject(userId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { location: true }
  })
}

export async function createProject(userId: string, name: string, locationId: string) {
  // Wrap in a transaction so the immutable quota-usage row lands atomically with
  // the Project itself. Counting from ProjectQuotaUsage means deleting a project
  // does not refund the user's daily slot.
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: { userId, name, locationId },
      include: { location: true }
    })
    await tx.projectQuotaUsage.create({
      data: { userId, projectId: project.id, createdAt: project.createdAt }
    })
    return normalizeProjectResponse(project)
  })
}

export async function listProjects(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { location: { select: { status: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return projects.map((project) => normalizeProjectResponse(project))
}

export async function getProject(userId: string, projectId: string) {
  const project = await findOwnedProject(userId, projectId)
  return project ? normalizeProjectResponse(project) : null
}

export async function saveLayout(
  userId: string,
  projectId: string,
  editedLayout: PanelEdit[],
  selectedPanelModelId?: string
) {
  const project = await findOwnedProject(userId, projectId)
  if (!project) return null

  const nextAnalysisConfig = mergeAnalysisConfig(
    project.analysisConfig,
    selectedPanelModelId ? { selectedPanelModelId } : {}
  )

  const nextStatus = project.status === 'analysis_saved' ? 'analysis_saved' : 'layout_saved'

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      editedLayout: serializeJsonValue(editedLayout),
      analysisConfig: serializeJsonValue(nextAnalysisConfig),
      status: nextStatus
    },
    include: { location: true }
  })
  return normalizeProjectResponse(updated)
}

export async function deleteProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) return null
  await prisma.project.delete({ where: { id: projectId } })
  return project
}

export async function updateLayoutPreferences(
  userId: string,
  projectId: string,
  partial: LayoutPreferencesDto
) {
  const project = await findOwnedProject(userId, projectId)
  if (!project) return null
  const next = mergeLayoutPreferences(project.layoutPreferences, partial)
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { layoutPreferences: serializeJsonValue(next) },
    include: { location: true }
  })
  return normalizeProjectResponse(updated)
}

export async function saveAnalysis(
  userId: string,
  projectId: string,
  analysisConfig: AnalysisConfigDto,
  analysisResults: AnalysisResultsDto
) {
  const project = await findOwnedProject(userId, projectId)
  if (!project) return null
  const nextAnalysisConfig = mergeAnalysisConfig(project.analysisConfig, analysisConfig)
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      analysisConfig: serializeJsonValue(nextAnalysisConfig),
      analysisResults: serializeJsonValue(analysisResults),
      status: 'analysis_saved'
    },
    include: { location: true }
  })
  return normalizeProjectResponse(updated)
}

export async function getPdfProjectData(userId: string, projectId: string) {
  const project = await findOwnedProject(userId, projectId)
  if (!project) return null

  const rgbPath = project.location?.rgbImageUrl
  const rgbSignedUrl = rgbPath ? await getSignedUrl(rgbPath) : null
  const imageGeoTransform = project.location
    ? await loadReferenceGeoTransform({
        id: project.location.id,
        dsmPath: project.location.dsmPath ?? null
      }).catch(() => null)
    : null

  return buildPdfProjectResponse(project, rgbSignedUrl, imageGeoTransform)
}
