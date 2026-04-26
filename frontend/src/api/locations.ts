import { apiFetch } from './client'
import type {
  ResolveLocationRequest,
  ResolveLocationResponse,
  LocationStatusResponse,
  LocationDataResponse,
  ProbeLocationResponse,
  FluxRecomputeRequest,
  FluxRecomputeResponse,
  FluxRecomputeBatchRequest,
  FluxRecomputeBatchResponse
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
  roofMask: {
    dataBase64: string
    geoTransform: LocationImageGeoTransform
  }
}

export function resolveLocation(req: ResolveLocationRequest) {
  return apiFetch<ResolveLocationResponse>('/locations/resolve', {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

export function probeLocation(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() })
  return apiFetch<ProbeLocationResponse>(`/locations/probe?${params}`)
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

export function recomputeFluxBatch(locationId: string, req: FluxRecomputeBatchRequest) {
  return apiFetch<FluxRecomputeBatchResponse>(`/locations/${locationId}/panels/recompute-batch`, {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

export function getOverlayUrl(locationId: string, type: 'annual-flux' | 'dsm' | 'mask') {
  return apiFetch<{ url: string }>(`/locations/${locationId}/overlay/${type}`)
}
