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
 * Location data response enriched with transform metadata
 */
export type LocationDataRouteResponse = LocationDataResponse & {
  imageGeoTransform: ImageGeoTransform
  roofMask: RoofMaskResult
}

/**
 * Builds a resolve-location response object
 * @param {string} locationId - Location identifier
 * @param {ResolveLocationResponse['status']} status - Value used for status
 * @returns {Object} The built resolve location response
 */
export function buildResolveLocationResponse(locationId: string, status: ResolveLocationResponse['status']) {
  return { locationId, status } satisfies ResolveLocationResponse
}

/**
 * Builds a location-status response object
 * @param {LocationStatusResponse['status']} status - Value used for status
 * @returns {Object} The built location status response
 */
export function buildLocationStatusResponse(status: LocationStatusResponse['status']) {
  return { status } satisfies LocationStatusResponse
}

/**
 * Builds a probe-location response object
 * @param {ProbeLocationResponse} result - Value used for result
 * @returns {ProbeLocationResponse} The built probe location response
 */
export function buildProbeLocationResponse(result: ProbeLocationResponse) {
  return result satisfies ProbeLocationResponse
}

/**
 * Builds a location-data response object
 * @param {BuildingInsightsDto} buildingInsights - Value used for building insights
 * @param {string} rgbImageUrl - Rgb image url value
 * @param {ImageryQuality | null} imageryQuality - Value used for imagery quality
 * @param {ImageGeoTransform} imageGeoTransform - Value used for image geo transform
 * @param {RoofMaskResult} roofMask - Value used for roof mask
 * @returns {LocationDataRouteResponse} The built location data response
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
 * Builds an overlay response object
 * @param {string} url - Url value
 * @returns {Object} The built overlay response
 */
export function buildOverlayResponse(url: string) {
  return { url }
}

/**
 * Builds a batch flux recompute response object
 * @param {FluxRecomputeResponse[]} results - Collection of results values
 * @returns {FluxRecomputeBatchResponse} The built flux recompute batch response
 */
export function buildFluxRecomputeBatchResponse(results: FluxRecomputeResponse[]): FluxRecomputeBatchResponse {
  return { results }
}
