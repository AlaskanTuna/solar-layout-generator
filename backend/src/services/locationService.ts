import { prisma } from '../config/prisma.js'
import { runLocationPipeline } from './locationPipeline.js'

const COORDINATE_TOLERANCE = 0.0001

export async function resolveLocation(lat: number, lng: number, projectId?: string) {
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
      await prisma.project.update({
        where: { id: projectId },
        data: { locationId: existing.id }
      })
    }
    return { locationId: existing.id, status: existing.status }
  }

  // Cache miss — create new location and start pipeline
  const location = await prisma.location.create({
    data: { lat, lng }
  })

  if (projectId) {
    await prisma.project.update({
      where: { id: projectId },
      data: { locationId: location.id }
    })
  }

  // Run pipeline asynchronously (don't block HTTP response)
  runLocationPipeline(location.id, lat, lng).catch((err) => {
    console.error(`Pipeline error for location ${location.id}:`, err)
  })

  return { locationId: location.id, status: 'processing' as const }
}

export async function getLocationStatus(locationId: string) {
  return prisma.location.findUnique({
    where: { id: locationId },
    select: { status: true }
  })
}

export async function getLocationData(locationId: string) {
  return prisma.location.findUnique({
    where: { id: locationId }
  })
}
