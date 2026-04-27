import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import type { PanelEdit } from '@shared/types'

export async function createProject(userId: string, name: string, locationId: string) {
  // Wrap in a transaction so the immutable quota-usage row lands atomically with
  // the Project itself. Counting from ProjectQuotaUsage means deleting a project
  // does not refund the user's daily slot.
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { userId, name, locationId } })
    await tx.projectQuotaUsage.create({
      data: { userId, projectId: project.id, createdAt: project.createdAt }
    })
    return project
  })
}

export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    include: { location: { select: { status: true } } },
    orderBy: { createdAt: 'desc' }
  })
}

export async function getProject(userId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { location: true }
  })
}

export async function saveLayout(
  userId: string,
  projectId: string,
  editedLayout: PanelEdit[],
  selectedPanelModelId?: string
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) return null

  const existingConfig = (project.analysisConfig as Record<string, unknown>) ?? {}
  const nextAnalysisConfig = selectedPanelModelId ? { ...existingConfig, selectedPanelModelId } : existingConfig

  // Preserve analysis_saved status — only set layout_saved if not already completed
  const nextStatus = project.status === 'analysis_saved' ? 'analysis_saved' : 'layout_saved'

  return prisma.project.update({
    where: { id: projectId },
    data: {
      editedLayout: editedLayout as unknown as Prisma.InputJsonValue,
      analysisConfig: nextAnalysisConfig as Prisma.InputJsonValue,
      status: nextStatus
    },
    include: { location: true }
  })
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
  partial: Record<string, unknown>
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) return null
  const existing = (project.layoutPreferences as Record<string, unknown>) ?? {}
  const next = { ...existing, ...partial }
  return prisma.project.update({
    where: { id: projectId },
    data: { layoutPreferences: next as Prisma.InputJsonValue },
    include: { location: true }
  })
}

export async function saveAnalysis(
  userId: string,
  projectId: string,
  analysisConfig: Record<string, unknown>,
  analysisResults: Record<string, unknown>
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) return null
  const existingConfig = (project.analysisConfig as Record<string, unknown>) ?? {}
  const nextAnalysisConfig = { ...existingConfig, ...analysisConfig }
  return prisma.project.update({
    where: { id: projectId },
    data: {
      analysisConfig: nextAnalysisConfig as Prisma.InputJsonValue,
      analysisResults: analysisResults as Prisma.InputJsonValue,
      status: 'analysis_saved'
    },
    include: { location: true }
  })
}
