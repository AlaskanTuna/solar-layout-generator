import { prisma } from '../config/prisma.js'
import { runLocationPipeline } from './locationPipeline.js'

const COORDINATE_TOLERANCE = 0.0001

type ResolveLocationResult =
  | {
      locationId: string
      status: 'processing' | 'ready' | 'failed'
    }
  | {
      error: 'PROJECT_NOT_FOUND'
    }

async function linkOwnedProjectToLocation(userId: string, projectId: string, locationId: string): Promise<boolean> {
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { locationId }
  })
  return result.count > 0
}

export async function resolveLocation(
  userId: string,
  lat: number,
  lng: number,
  projectId?: string
): Promise<ResolveLocationResult> {
  // Check for existing location within coordinate tolerance
  const existing = await prisma.location.findFirst({
    where: {
      lat: { gte: lat - COORDINATE_TOLERANCE, lte: lat + COORDINATE_TOLERANCE },
      lng: { gte: lng - COORDINATE_TOLERANCE, lte: lng + COORDINATE_TOLERANCE }
    }
  })

  if (existing) {
    // Cache hit — link project if provided
    if (projectId) {
      const linked = await linkOwnedProjectToLocation(userId, projectId, existing.id)
      if (!linked) {
        return { error: 'PROJECT_NOT_FOUND' }
      }
    }
    return { locationId: existing.id, status: existing.status }
  }

  // Cache miss — create new location and start pipeline
  const location = await prisma.location.create({
    data: { lat, lng }
  })

  if (projectId) {
    const linked = await linkOwnedProjectToLocation(userId, projectId, location.id)
    if (!linked) {
      await prisma.location.delete({ where: { id: location.id } })
      return { error: 'PROJECT_NOT_FOUND' }
    }
  }

  // Run pipeline asynchronously (don't block HTTP response)
  runLocationPipeline(location.id, lat, lng).catch((err) => {
    console.error(`Pipeline error for location ${location.id}:`, err)
  })

  return { locationId: location.id, status: 'processing' as const }
}

export async function getLocationStatusForUser(userId: string, locationId: string) {
  return prisma.location.findFirst({
    where: { id: locationId, projects: { some: { userId } } },
    select: { status: true }
  })
}

export async function getLocationDataForUser(userId: string, locationId: string) {
  return prisma.location.findFirst({
    where: { id: locationId, projects: { some: { userId } } }
  })
}
