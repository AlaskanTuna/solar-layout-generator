import { prisma } from '../config/prisma.js'
import { runLocationPipeline } from './locationPipeline.js'
import { NotFoundError, AppError } from '../errors.js'
import { findBestQualityForLocation, type ImageryQuality } from './solarApiService.js'
import { getSignedUrl } from './storageService.js'
import { loadReferenceGeoTransform, loadRoofMask } from './geoTiffService.js'
import { getOrGenerateOverlay, resolveTifPath, type OverlayType } from './overlayService.js'
import { parseBuildingInsights } from './buildingInsightsService.js'
import {
  buildLocationDataResponse,
  buildLocationStatusResponse,
  buildOverlayResponse,
  buildProbeLocationResponse,
  buildResolveLocationResponse
} from './viewModels/locationResponse.js'

const COORDINATE_TOLERANCE = 0.0001

type ResolveLocationResult = {
  locationId: string
  status: 'processing' | 'ready' | 'failed'
}

async function linkOwnedProjectToLocation(userId: string, projectId: string, locationId: string): Promise<boolean> {
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { locationId }
  })
  return result.count > 0
}

/**
 * Resolves a location and kick off the pipeline when needed
 * @param {string} userId - Authenticated user identifier
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @param {string} projectId - Project identifier
 * @param {ImageryQuality} requiredQuality - Value used for required quality
 * @param {boolean} expandedCoverage - Whether expanded coverage
 * @returns {Promise<ResolveLocationResult>} A promise resolving to the resulting value
 */
export async function resolveLocation(
  userId: string,
  lat: number,
  lng: number,
  projectId?: string,
  requiredQuality: ImageryQuality = 'HIGH',
  expandedCoverage = false
): Promise<ResolveLocationResult> {
  // Check for existing location within coordinate tolerance
  const existing = await prisma.location.findFirst({
    where: {
      lat: { gte: lat - COORDINATE_TOLERANCE, lte: lat + COORDINATE_TOLERANCE },
      lng: { gte: lng - COORDINATE_TOLERANCE, lte: lng + COORDINATE_TOLERANCE }
    }
  })

  if (existing) {
    if (projectId) {
      const linked = await linkOwnedProjectToLocation(userId, projectId, existing.id)
      if (!linked) {
        throw new NotFoundError('Project not found')
      }
    }
    return { locationId: existing.id, status: existing.status }
  }

  // Cache miss — create new location and start pipeline
  if (!projectId) {
    // Shared-cache policy: allow warm-up even before a project is linked
    console.warn(`[LocationResolve] Cache miss without projectId for (${lat}, ${lng})`)
  }
  const location = await prisma.location.create({
    data: { lat, lng }
  })

  if (projectId) {
    const linked = await linkOwnedProjectToLocation(userId, projectId, location.id)
    if (!linked) {
      await prisma.location.delete({ where: { id: location.id } })
      throw new NotFoundError('Project not found')
    }
  }

  // Run pipeline asynchronously (don't block HTTP response)
  runLocationPipeline(location.id, lat, lng, requiredQuality, expandedCoverage).catch((err) => {
    console.error(`Pipeline error for location ${location.id}:`, err)
  })

  return { locationId: location.id, status: 'processing' as const }
}

/**
 * Resolves a location and build the API response
 * @param {string} userId - Authenticated user identifier
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @param {string} projectId - Project identifier
 * @param {ImageryQuality} requiredQuality - Value used for required quality
 * @param {boolean} expandedCoverage - Whether expanded coverage
 * @returns {Promise<{ locationId: string; status: LocationStatus; }>} A promise resolving to the resulting value
 */
export async function resolveLocationResponse(
  userId: string,
  lat: number,
  lng: number,
  projectId?: string,
  requiredQuality: ImageryQuality = 'HIGH',
  expandedCoverage = false
) {
  const result = await resolveLocation(userId, lat, lng, projectId, requiredQuality, expandedCoverage)
  return buildResolveLocationResponse(result.locationId, result.status)
}

/**
 * Probes which Solar API qualities are available
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @returns {Promise<ProbeLocationResponse>} A promise resolving to the resulting value
 */
export async function probeLocation(lat: number, lng: number) {
  const result = await findBestQualityForLocation(lat, lng)
  return buildProbeLocationResponse(result)
}

/**
 * Fetches the location status when the user can access it
 * @param {string} userId - Authenticated user identifier
 * @param {string} locationId - Location identifier
 * @returns {Promise<{ status: LocationStatus; }>} A promise resolving to the requested location status for user
 */
export async function getLocationStatusForUser(userId: string, locationId: string) {
  return prisma.location.findFirst({
    where: {
      id: locationId,
      OR: [{ projects: { some: { userId } } }, { projects: { none: {} } }]
    },
    select: { status: true }
  })
}

/**
 * Builds a location status response for the user
 * @param {string} userId - Authenticated user identifier
 * @param {string} locationId - Location identifier
 * @returns {Promise<{ status: LocationStatus; }>} A promise resolving to the requested location status response for user
 */
export async function getLocationStatusResponseForUser(userId: string, locationId: string) {
  const location = await getLocationStatusForUser(userId, locationId)
  return location ? buildLocationStatusResponse(location.status) : null
}

/**
 * Fetches the location row when the user owns the project
 * @param {string} userId - Authenticated user identifier
 * @param {string} locationId - Location identifier
 * @returns {Promise} A promise resolving to the requested location data for user
 */
export async function getLocationDataForUser(userId: string, locationId: string) {
  return prisma.location.findFirst({
    where: { id: locationId, projects: { some: { userId } } }
  })
}

/**
 * Builds the location data response for an owned project
 * @param {string} userId - Authenticated user identifier
 * @param {string} locationId - Location identifier
 * @returns {Promise<LocationDataRouteResponse>} A promise resolving to the requested location data response for user
 */
export async function getLocationDataResponseForUser(userId: string, locationId: string) {
  const location = await getLocationDataForUser(userId, locationId)
  if (!location) return null
  if (location.status !== 'ready') throw new AppError('Location data not ready', 409)
  if (!location.buildingInsightsJson || !location.rgbImageUrl || !location.maskPath) {
    throw new AppError('Location data is incomplete', 500)
  }

  const buildingInsights = parseBuildingInsights(location.buildingInsightsJson)
  if (!buildingInsights) {
    throw new AppError('Location data is incomplete', 500)
  }

  const rgbImageUrl = await getSignedUrl(location.rgbImageUrl)
  const [imageGeoTransform, roofMask] = await Promise.all([loadReferenceGeoTransform(location), loadRoofMask(location)])

  return buildLocationDataResponse(buildingInsights, rgbImageUrl, location.imageryQuality, imageGeoTransform, roofMask)
}

/**
 * Builds an overlay response for an owned project
 * @param {string} userId - Authenticated user identifier
 * @param {string} locationId - Location identifier
 * @param {OverlayType} overlayType - Value used for overlay type
 * @returns {Promise<{ url: string; }>} A promise resolving to the requested overlay response for user
 */
export async function getOverlayResponseForUser(userId: string, locationId: string, overlayType: OverlayType) {
  const location = await getLocationDataForUser(userId, locationId)
  if (!location || location.status !== 'ready') {
    throw new NotFoundError('Location not found or not ready')
  }

  const tifPath = resolveTifPath(overlayType, location)
  if (!tifPath) {
    throw new NotFoundError(`${overlayType} layer not available for this location`)
  }

  const url = await getOrGenerateOverlay(tifPath, overlayType, location.rgbImageUrl)
  return buildOverlayResponse(url)
}
