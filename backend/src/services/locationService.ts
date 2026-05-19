/**
 * Location orchestration service.
 *
 * Resolves shared location cache rows, starts the Solar API pipeline, enforces
 * project ownership, and builds location-related route responses.
 */

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

/** Coordinate cache window in decimal degrees, roughly 11 metres at the equator. */
const COORDINATE_TOLERANCE = 0.0001

/**
 * If a cached row has been stuck in `processing` longer than this, treat it as
 * dead-on-arrival: mark it failed and let the next resolve fall through to a
 * fresh pipeline run. Prevents one hung pipeline from poisoning the cache for
 * every future user picking that same coordinate.
 */
const STALE_PROCESSING_THRESHOLD_MS = 5 * 60_000

type ResolveLocationResult = {
  locationId: string
  status: 'processing' | 'ready' | 'failed'
}

/**
 * Links a project to a location only when the project belongs to the caller.
 *
 * Uses `updateMany` so the ownership check and write happen in a single query;
 * a zero count means the project either does not exist or is not owned by the user.
 *
 * @param userId - Authenticated project owner
 * @param projectId - Project to attach to the resolved location
 * @param locationId - Location row produced by cache lookup or pipeline creation
 * @returns `true` when the project was linked
 */
async function linkOwnedProjectToLocation(userId: string, projectId: string, locationId: string): Promise<boolean> {
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { locationId }
  })
  return result.count > 0
}

/**
 * Resolves a cached location or creates one and starts the async pipeline.
 *
 * @param userId - Authenticated user requesting the location
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @param projectId - Optional project to link once a location row is known
 * @param requiredQuality - Solar API imagery quality requested for a new pipeline run
 * @param expandedCoverage - Whether to request Solar API expanded coverage for BASE imagery
 * @returns Location id and current processing status
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
    const isStaleProcessing =
      existing.status === 'processing' &&
      Date.now() - existing.createdAt.getTime() > STALE_PROCESSING_THRESHOLD_MS

    if (isStaleProcessing) {
      const ageMs = Date.now() - existing.createdAt.getTime()
      console.warn(
        `[LocationResolve] Stale processing row ${existing.id} (age=${ageMs}ms); marking failed and creating a fresh row`
      )
      await prisma.location.update({ where: { id: existing.id }, data: { status: 'failed' } })
      // Fall through to the cache-miss path below so a fresh pipeline runs.
    } else {
      if (projectId) {
        const linked = await linkOwnedProjectToLocation(userId, projectId, existing.id)
        if (!linked) {
          throw new NotFoundError('Project not found')
        }
      }
      return { locationId: existing.id, status: existing.status }
    }
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
 * Resolves a location and wraps the result in the route response shape.
 *
 * @param userId - Authenticated user requesting the location
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @param projectId - Optional project to link once a location row is known
 * @param requiredQuality - Solar API imagery quality requested for a new pipeline run
 * @param expandedCoverage - Whether to request Solar API expanded coverage for BASE imagery
 * @returns Resolve-location response DTO
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
 * Probes which Solar API imagery qualities are available at a coordinate.
 *
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @returns Available quality tiers and the recommended quality selection
 */
export async function probeLocation(lat: number, lng: number) {
  const result = await findBestQualityForLocation(lat, lng)
  return buildProbeLocationResponse(result)
}

/**
 * Fetches location status when the user owns it or just created an orphan row.
 *
 * @param userId - Authenticated user polling location status
 * @param locationId - Location whose status should be returned
 * @returns Matching location status row, or `null` when access is not allowed
 */
export async function getLocationStatusForUser(userId: string, locationId: string) {
  // Allow status polling for: (a) locations linked to a project the user owns, OR
  // (b) freshly-created orphan locations (within the 5-min post-create window) so the
  // user who just kicked off the pipeline can poll before linkOwnedProjectToLocation
  // runs. The previous unscoped `{ projects: { none: {} } }` arm let any authenticated
  // user poll the status of any orphan location indefinitely (UUID guessing).
  const orphanWindowStart = new Date(Date.now() - 5 * 60_000)
  return prisma.location.findFirst({
    where: {
      id: locationId,
      OR: [{ projects: { some: { userId } } }, { projects: { none: {} }, createdAt: { gte: orphanWindowStart } }]
    },
    select: { status: true }
  })
}

/**
 * Builds a location status response for an accessible location.
 *
 * @param userId - Authenticated user polling location status
 * @param locationId - Location whose status should be returned
 * @returns Status response DTO, or `null` when access is not allowed
 */
export async function getLocationStatusResponseForUser(userId: string, locationId: string) {
  const location = await getLocationStatusForUser(userId, locationId)
  return location ? buildLocationStatusResponse(location.status) : null
}

/**
 * Fetches a full location row through project ownership.
 *
 * @param userId - Authenticated user that must own a linked project
 * @param locationId - Location whose stored assets should be loaded
 * @returns Location row, or `null` when no owned project links to it
 */
export async function getLocationDataForUser(userId: string, locationId: string) {
  return prisma.location.findFirst({
    where: { id: locationId, projects: { some: { userId } } }
  })
}

/**
 * Builds the workbench location-data response for an owned ready location.
 *
 * @param userId - Authenticated user that must own a linked project
 * @param locationId - Ready location whose Solar API artifacts should be returned
 * @returns Location data response DTO, or `null` when access is not allowed
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
 * Builds a signed overlay URL response for an owned ready location.
 *
 * @param userId - Authenticated user that must own a linked project
 * @param locationId - Ready location whose overlay source GeoTIFF should be rendered
 * @param overlayType - Overlay layer to resolve and generate when missing from cache
 * @returns Overlay response DTO containing a signed PNG URL
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
