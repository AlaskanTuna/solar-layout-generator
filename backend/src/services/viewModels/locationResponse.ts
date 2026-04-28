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

export type LocationDataRouteResponse = LocationDataResponse & {
  imageGeoTransform: ImageGeoTransform
  roofMask: RoofMaskResult
}

export function buildResolveLocationResponse(locationId: string, status: ResolveLocationResponse['status']) {
  return { locationId, status } satisfies ResolveLocationResponse
}

export function buildLocationStatusResponse(status: LocationStatusResponse['status']) {
  return { status } satisfies LocationStatusResponse
}

export function buildProbeLocationResponse(result: ProbeLocationResponse) {
  return result satisfies ProbeLocationResponse
}

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

export function buildOverlayResponse(url: string) {
  return { url }
}

export function buildFluxRecomputeBatchResponse(results: FluxRecomputeResponse[]): FluxRecomputeBatchResponse {
  return { results }
}
