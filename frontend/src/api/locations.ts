import { apiFetch } from './client'
import type {
  ResolveLocationRequest,
  ResolveLocationResponse,
  LocationStatusResponse,
  LocationDataResponse,
  FluxRecomputeRequest,
  FluxRecomputeResponse
} from '@shared/types'

export type LocationImageGeoTransform = {
  originX: number
  originY: number
  resX: number
  resY: number
  fromCRS: string
  toCRS: string
  imageWidth: number
  imageHeight: number
}

export type LocationDataWithGeoTransform = LocationDataResponse & {
  imageGeoTransform: LocationImageGeoTransform
}

export function resolveLocation(req: ResolveLocationRequest) {
  return apiFetch<ResolveLocationResponse>('/locations/resolve', {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

export function getLocationStatus(id: string) {
  return apiFetch<LocationStatusResponse>(`/locations/${id}/status`)
}

export function getLocationData(id: string) {
  return apiFetch<LocationDataWithGeoTransform>(`/locations/${id}/data`)
}

export function recomputeFlux(locationId: string, req: FluxRecomputeRequest) {
  return apiFetch<FluxRecomputeResponse>(`/locations/${locationId}/panels/recompute`, {
    method: 'POST',
    body: JSON.stringify(req)
  })
}
