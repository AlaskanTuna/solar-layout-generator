import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import type { PanelEdit } from '@shared/types'

export async function createProject(userId: string, name: string, locationId: string) {
  return prisma.project.create({
    data: { userId, name, locationId }
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

export async function saveLayout(userId: string, projectId: string, editedLayout: PanelEdit[]) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) return null
  return prisma.project.update({
    where: { id: projectId },
    data: {
      editedLayout: editedLayout as unknown as Prisma.InputJsonValue,
      status: 'layout_saved'
    },
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
  return prisma.project.update({
    where: { id: projectId },
    data: {
      analysisConfig: analysisConfig as Prisma.InputJsonValue,
      analysisResults: analysisResults as Prisma.InputJsonValue,
      status: 'analysis_saved'
    },
    include: { location: true }
  })
}
