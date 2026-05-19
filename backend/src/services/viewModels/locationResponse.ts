/**
 * Location response view-model builders.
 *
 * Keeps route handlers and services returning shared API shapes consistently
 * while preserving backend-only transform and mask metadata.
 */

import type { ImageryQuality } from '@prisma/client'
import type {
  FluxRecomputeBatchResponse,
  FluxRecomputeResponse,
  LocationDataResponse,
  LocationStatusResponse,
  ProbeLocationResponse,
  ResolveLocationResponse
} from '@shared/types'
import type { ImageGeoTransform, RoofMaskResult } from '../geoTiffService.js'
import type { BuildingInsightsDto } from '../buildingInsightsService.js'

/**
 * Location data response enriched with transform metadata.
 */
export type LocationDataRouteResponse = LocationDataResponse & {
  imageGeoTransform: ImageGeoTransform
  roofMask: RoofMaskResult
}

/**
 * Builds a resolve-location response object.
 *
 * @param locationId - Location row created or found by the resolver
 * @param status - Current pipeline status for the location
 * @returns Shared resolve-location API response
 */
export function buildResolveLocationResponse(locationId: string, status: ResolveLocationResponse['status']) {
  return { locationId, status } satisfies ResolveLocationResponse
}

/**
 * Builds a location-status response object.
 *
 * @param status - Current pipeline status for the location
 * @returns Shared status API response
 */
export function buildLocationStatusResponse(status: LocationStatusResponse['status']) {
  return { status } satisfies LocationStatusResponse
}

/**
 * Builds a probe-location response object.
 *
 * @param result - Solar API quality probe result
 * @returns Shared probe API response
 */
export function buildProbeLocationResponse(result: ProbeLocationResponse) {
  return result satisfies ProbeLocationResponse
}

/**
 * Builds a location-data response object for the workbench.
 *
 * @param buildingInsights - Validated Solar API building metadata
 * @param rgbImageUrl - Signed PNG URL for the satellite RGB layer
 * @param imageryQuality - Solar API imagery quality used for the location, if known
 * @param imageGeoTransform - GeoTIFF transform for aligning frontend canvas coordinates
 * @param roofMask - Binary roof mask and transform for placement constraints
 * @returns Shared location-data API response with backend transform metadata
 */
export function buildLocationDataResponse(
  buildingInsights: BuildingInsightsDto,
  rgbImageUrl: string,
  imageryQuality: ImageryQuality | null,
  imageGeoTransform: ImageGeoTransform,
  roofMask: RoofMaskResult
): LocationDataRouteResponse {
  return {
    buildingInsights,
    rgbImageUrl,
    imageryQuality,
    imageGeoTransform,
    roofMask
  }
}

/**
 * Builds an overlay response object.
 *
 * @param url - Signed PNG URL for the requested overlay layer
 * @returns Overlay API response
 */
export function buildOverlayResponse(url: string) {
  return { url }
}

/**
 * Builds a batch flux recompute response object.
 *
 * @param results - Per-panel flux recompute results in request order
 * @returns Shared batch recompute API response
 */
export function buildFluxRecomputeBatchResponse(results: FluxRecomputeResponse[]): FluxRecomputeBatchResponse {
  return { results }
}
