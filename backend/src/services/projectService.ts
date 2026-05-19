/**
 * Project persistence service.
 *
 * Handles project ownership checks, quota accounting, layout and analysis saves,
 * and PDF export payload assembly.
 */

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

/**
 * Creates a project and records daily quota usage in the same transaction.
 *
 * @param userId - Authenticated project owner
 * @param name - User-facing project name
 * @param locationId - Location row the project starts from
 * @returns Normalized project response for the created project
 */
export async function createProject(userId: string, name: string, locationId: string) {
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

/**
 * Lists projects owned by a user, newest first.
 *
 * @param userId - Authenticated project owner
 * @returns Normalized project responses with location status included
 */
export async function listProjects(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { location: { select: { status: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return projects.map((project) => normalizeProjectResponse(project))
}

/**
 * Fetches a single project owned by a user.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project to load
 * @returns Normalized project response, or `null` when not found
 */
export async function getProject(userId: string, projectId: string) {
  const project = await findOwnedProject(userId, projectId)
  return project ? normalizeProjectResponse(project) : null
}

/**
 * Saves the edited panel layout and optionally updates the selected panel model.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project receiving the saved layout
 * @param editedLayout - Panel geometry and selection state from the workbench
 * @param selectedPanelModelId - Optional analysis panel model to merge into config
 * @returns Normalized updated project, or `null` when not found
 */
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

/**
 * Deletes a project owned by the user.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project to delete
 * @returns Deleted project row, or `null` when not found
 */
export async function deleteProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) return null
  await prisma.project.delete({ where: { id: projectId } })
  return project
}

/**
 * Merges partial layout preferences into a project.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project receiving preference changes
 * @param partial - Preference fields to merge with the stored value
 * @returns Normalized updated project, or `null` when not found
 */
export async function updateLayoutPreferences(userId: string, projectId: string, partial: LayoutPreferencesDto) {
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

/**
 * Saves analysis inputs and computed results on a project.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project receiving analysis data
 * @param analysisConfig - Analysis settings to merge with any stored config
 * @param analysisResults - Computed financial and energy results to persist
 * @returns Normalized updated project, or `null` when not found
 */
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

/**
 * Builds the project payload used by PDF export.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project to render into the PDF
 * @returns PDF-ready project response, or `null` when not found
 */
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
