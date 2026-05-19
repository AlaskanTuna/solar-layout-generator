/**
 * Location API client.
 *
 * A "Location" is the immutable Google Solar API record for a coordinate:
 * building insights JSON, GeoTIFF storage paths, and the RGB satellite image.
 * Each Location is fetched once and cached in Supabase, then reused by every
 * Project that references it.
 *
 * Endpoints:
 *   - `resolveLocation`      — kick off Solar API fetch + storage for a coordinate
 *   - `probeLocation`        — cheap check for what imagery quality is available
 *   - `getLocationStatus`    — poll while the resolve pipeline runs
 *   - `getLocationData`      — once ready, fetch building insights + transforms
 *   - `recomputeFlux`        — re-sample monthly DC energy for one moved panel
 *   - `recomputeFluxBatch`   — same, batched (preloads GeoTIFF bands once)
 *   - `getOverlayUrl`        — signed URL for a coloured overlay PNG
 */

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

/**
 * Pixel-to-latlng transform parameters for the Location's reference GeoTIFF.
 * Mirrors the backend `GeoTransform` plus the rendered image dimensions so
 * the workbench canvas can map between panel positions and pixel coordinates.
 */
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

/**
 * Full location data payload returned by `getLocationData`. Extends
 * `LocationDataResponse` (building insights + RGB image URL) with the geo
 * transform and decoded roof mask the workbench needs for panel placement
 * and obstacle avoidance.
 */
export type LocationDataWithGeoTransform = LocationDataResponse & {
  imageGeoTransform: LocationImageGeoTransform
  roofMask: {
    dataBase64: string
    geoTransform: LocationImageGeoTransform
  }
}

/**
 * Kicks off Solar API fetch + storage for a coordinate. Returns immediately
 * with a Location id; poll `getLocationStatus` until it reports `ready`.
 */
export function resolveLocation(req: ResolveLocationRequest) {
  return apiFetch<ResolveLocationResponse>('/locations/resolve', {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

/**
 * Cheap availability probe for a coordinate. Reports which imagery qualities
 * (HIGH / BASE) work without consuming Solar API quota.
 */
export function probeLocation(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() })
  return apiFetch<ProbeLocationResponse>(`/locations/probe?${params}`)
}

/**
 * Poll endpoint for an in-flight resolve pipeline. Returns
 * `'processing' | 'ready' | 'failed'`.
 */
export function getLocationStatus(id: string) {
  return apiFetch<LocationStatusResponse>(`/locations/${id}/status`)
}

/**
 * Fetches the ready Location's full payload: building insights JSON, RGB
 * image URL, geo transform, and decoded roof mask. Only valid once the
 * status endpoint reports `ready`.
 */
export function getLocationData(id: string) {
  return apiFetch<LocationDataWithGeoTransform>(`/locations/${id}/data`)
}

/**
 * Recomputes monthly DC energy for a single panel after it has been moved or
 * rotated in the workbench. Avoids an expensive Solar API recall.
 */
export function recomputeFlux(locationId: string, req: FluxRecomputeRequest) {
  return apiFetch<FluxRecomputeResponse>(`/locations/${locationId}/panels/recompute`, {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

/**
 * Batched variant of `recomputeFlux` — preloads the GeoTIFF bands once and
 * samples every panel against them, so a group drag updates all panels with
 * a single backend round-trip.
 */
export function recomputeFluxBatch(locationId: string, req: FluxRecomputeBatchRequest) {
  return apiFetch<FluxRecomputeBatchResponse>(`/locations/${locationId}/panels/recompute-batch`, {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

/**
 * Fetches a time-limited signed URL for a coloured overlay PNG (annual flux,
 * DSM elevation, or roof mask). The backend generates the PNG on first
 * request and caches it.
 */
export function getOverlayUrl(locationId: string, type: 'annual-flux' | 'dsm' | 'mask') {
  return apiFetch<{ url: string }>(`/locations/${locationId}/overlay/${type}`)
}
