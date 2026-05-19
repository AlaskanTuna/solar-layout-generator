/**
 * Google Solar API client.
 *
 * Wraps the two endpoints we use:
 *   - `buildingInsights:findClosest` — returns the building footprint, roof
 *     segments, and a default panel layout for a coordinate.
 *   - `dataLayers:get` — returns signed URLs for the raster layers (DSM, RGB,
 *     mask, annual flux, monthly flux, hourly shade) used by the workbench.
 *
 * The module also offers a probe helper (`findBestQualityForLocation`) that
 * walks HIGH → BASE → BASE+EXPANDED_COVERAGE looking for the best imagery
 * available, since Solar API coverage in Malaysia is uneven.
 *
 * All outbound calls are wrapped in `fetchWithTimeout` so a hung remote can
 * never block the location pipeline forever.
 */

import { env } from '../config/env.js'

const BASE_URL = 'https://solar.googleapis.com/v1'

/** Per-call timeout budgets so a hung Solar API request can never block the pipeline forever. */
export const PROBE_TIMEOUT_MS = 8_000
export const METADATA_TIMEOUT_MS = 20_000
export const DOWNLOAD_TIMEOUT_MS = 45_000

/**
 * Wraps fetch with an AbortController-based timeout. AbortError is rethrown as a
 * named timeout error so callers see something readable in logs and don't have
 * to do their own AbortError detection.
 */
export async function fetchWithTimeout(
  input: string | URL,
  timeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${input.toString()}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Imagery quality tiers exposed by the Solar API.
 *
 * HIGH is preferred (higher-resolution rasters, better building detection);
 * BASE is the fallback for less-covered areas. Some locations also need the
 * `EXPANDED_COVERAGE` experiment flag to return any data at all.
 */
export type ImageryQuality = 'HIGH' | 'BASE'

/**
 * Optional Solar API request modifiers shared across endpoints.
 */
export type SolarApiOpts = {
  /** Minimum imagery quality; defaults to `'HIGH'` */
  requiredQuality?: ImageryQuality
  /** Adds the `experiments=EXPANDED_COVERAGE` flag (BASE-only, broader area) */
  expandedCoverage?: boolean
}

/**
 * Coordinate format used by Solar API request and response payloads.
 */
export type SolarCoordinate = {
  latitude: number
  longitude: number
}

/**
 * Building bounding box returned by Solar API, in WGS84.
 */
export type SolarBoundingBox = {
  /** South-west corner */
  sw: SolarCoordinate
  /** North-east corner */
  ne: SolarCoordinate
}

/**
 * Raw Solar API `buildingInsights:findClosest` response, narrowed only enough
 * to drive our pipeline. Unknown fields are preserved via the index signature
 * so we don't lose data Google adds upstream.
 */
export type BuildingInsightsApiResponse = {
  boundingBox?: SolarBoundingBox
  solarPotential?: {
    solarPanels?: Record<string, unknown>[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Signed URLs returned by `dataLayers:get`. All URLs are time-limited and must
 * be downloaded promptly. `hourlyShadeUrls` is one URL per month when present.
 */
export type DataLayersApiResponse = {
  dsmUrl?: string
  rgbUrl?: string
  maskUrl?: string
  annualFluxUrl?: string
  monthlyFluxUrl?: string
  hourlyShadeUrls?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Builds the URLSearchParams shared by both buildingInsights and probe calls.
 * Centralised so the auth key and option defaults stay consistent.
 */
function buildSolarParams(lat: number, lng: number, opts: SolarApiOpts = {}): URLSearchParams {
  const { requiredQuality = 'HIGH', expandedCoverage = false } = opts
  const params = new URLSearchParams({
    'location.latitude': lat.toString(),
    'location.longitude': lng.toString(),
    requiredQuality,
    key: env.GOOGLE_API_KEY
  })
  if (expandedCoverage) params.set('experiments', 'EXPANDED_COVERAGE')
  return params
}

/**
 * Calls Solar API `buildingInsights:findClosest` for the given coordinate.
 *
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @param opts - Imagery quality and coverage options
 * @returns The closest building's Solar API record
 * @throws If the API returns a non-OK status or an unrecognised payload
 */
export async function fetchBuildingInsights(
  lat: number,
  lng: number,
  opts: SolarApiOpts = {}
): Promise<BuildingInsightsApiResponse> {
  const params = buildSolarParams(lat, lng, opts)
  const response = await fetchWithTimeout(`${BASE_URL}/buildingInsights:findClosest?${params}`, METADATA_TIMEOUT_MS)
  if (!response.ok) {
    throw new Error(`Solar API error: ${response.status} ${await response.text()}`)
  }
  const json = await response.json()
  if (!isRecord(json)) {
    throw new Error('Solar API returned invalid building insights payload')
  }
  return json
}

/**
 * Calls Solar API `dataLayers:get` for the given coordinate and radius.
 *
 * The response is normalised so missing fields become `undefined` rather than
 * silently typed-but-empty strings, and `hourlyShadeUrls` is filtered to only
 * keep string entries (defensive against API drift).
 *
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @param radiusMeters - Half-extent of the area to fetch, in metres
 * @param opts - Imagery quality and coverage options
 * @returns Signed URLs for each raster layer (any may be absent)
 * @throws If the API returns a non-OK status
 */
export async function fetchDataLayers(
  lat: number,
  lng: number,
  radiusMeters: number,
  opts: SolarApiOpts = {}
): Promise<DataLayersApiResponse> {
  const { requiredQuality = 'HIGH', expandedCoverage = false } = opts
  const params = new URLSearchParams({
    'location.latitude': lat.toString(),
    'location.longitude': lng.toString(),
    radiusMeters: radiusMeters.toString(),
    view: 'FULL_LAYERS',
    requiredQuality,
    key: env.GOOGLE_API_KEY
  })
  if (expandedCoverage) params.set('experiments', 'EXPANDED_COVERAGE')

  const response = await fetchWithTimeout(`${BASE_URL}/dataLayers:get?${params}`, METADATA_TIMEOUT_MS)
  if (!response.ok) {
    throw new Error(`DataLayers error: ${response.status} ${await response.text()}`)
  }
  const json = (await response.json()) as Partial<DataLayersApiResponse>
  return {
    dsmUrl: typeof json.dsmUrl === 'string' ? json.dsmUrl : undefined,
    rgbUrl: typeof json.rgbUrl === 'string' ? json.rgbUrl : undefined,
    maskUrl: typeof json.maskUrl === 'string' ? json.maskUrl : undefined,
    annualFluxUrl: typeof json.annualFluxUrl === 'string' ? json.annualFluxUrl : undefined,
    monthlyFluxUrl: typeof json.monthlyFluxUrl === 'string' ? json.monthlyFluxUrl : undefined,
    hourlyShadeUrls: Array.isArray(json.hourlyShadeUrls)
      ? json.hourlyShadeUrls.filter((value): value is string => typeof value === 'string')
      : undefined
  }
}

// Probe in priority order: HIGH, then BASE, then BASE with EXPANDED_COVERAGE
// Check both endpoints because buildingInsights can succeed while dataLayers fails
// EXPANDED_COVERAGE only works with BASE, and failed calls do not count toward quota
/**
 * Result of probing a coordinate for available imagery quality.
 */
export type ProbeResult = {
  /** All quality tiers the location supports */
  availableQualities: ImageryQuality[]
  /** Best quality observed, or `null` if no probe succeeded */
  bestQuality: ImageryQuality | null
  /** `true` if `EXPANDED_COVERAGE` was required to get any data */
  expandedCoverage: boolean
}

const PROBE_RADIUS_METERS = 100

/**
 * Discovers the best imagery quality available at a coordinate by trying
 * HIGH → BASE → BASE+EXPANDED_COVERAGE in order.
 *
 * Each probe hits both buildingInsights and dataLayers because Solar API can
 * succeed on one and fail on the other. Failed probes do not count against
 * Google's quota, so the cost of being thorough is only latency.
 *
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @returns Available qualities, the best one found, and whether EXPANDED_COVERAGE was needed
 */
export async function findBestQualityForLocation(lat: number, lng: number): Promise<ProbeResult> {
  const available: ImageryQuality[] = []
  let bestQuality: ImageryQuality | null = null
  let expandedCoverage = false

  if (await probeFullChain(lat, lng, { requiredQuality: 'HIGH', expandedCoverage: false })) {
    available.push('HIGH')
    bestQuality = 'HIGH'
  }

  const baseNoExpansionWorks =
    bestQuality === null && (await probeFullChain(lat, lng, { requiredQuality: 'BASE', expandedCoverage: false }))
  if (baseNoExpansionWorks) {
    if (!available.includes('BASE')) available.push('BASE')
    bestQuality = 'BASE'
    expandedCoverage = false
  }

  if (bestQuality === null && (await probeFullChain(lat, lng, { requiredQuality: 'BASE', expandedCoverage: true }))) {
    if (!available.includes('BASE')) available.push('BASE')
    bestQuality = 'BASE'
    expandedCoverage = true
  }

  return { availableQualities: available, bestQuality, expandedCoverage }
}

/** Probe both endpoints before accepting a quality combination */
async function probeFullChain(lat: number, lng: number, opts: SolarApiOpts): Promise<boolean> {
  if (!(await probeEndpoint(`${BASE_URL}/buildingInsights:findClosest`, lat, lng, opts))) return false
  return probeEndpoint(`${BASE_URL}/dataLayers:get`, lat, lng, opts, PROBE_RADIUS_METERS)
}

/**
 * Issues a single HEAD-like probe against a Solar API endpoint, swallowing
 * timeouts and network errors as "not available" rather than re-raising.
 */
async function probeEndpoint(
  baseUrl: string,
  lat: number,
  lng: number,
  opts: SolarApiOpts,
  radiusMeters?: number
): Promise<boolean> {
  const params = buildSolarParams(lat, lng, opts)
  if (typeof radiusMeters === 'number') {
    params.set('radiusMeters', radiusMeters.toString())
    params.set('view', 'FULL_LAYERS')
  }
  try {
    const response = await fetchWithTimeout(`${baseUrl}?${params}`, PROBE_TIMEOUT_MS)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Derives a conservative `radiusMeters` for `fetchDataLayers` from a Solar API
 * bounding box. The radius is half the diagonal (in metres) plus a 10 m buffer
 * so the data layer fetch always fully encloses the building.
 *
 * @param bbox - Building bounding box from buildingInsights
 * @returns Suggested radius in metres
 */
export function calculateRadius(bbox: SolarBoundingBox): number {
  const diameter = haversineDistance(bbox.sw.latitude, bbox.sw.longitude, bbox.ne.latitude, bbox.ne.longitude)
  return Math.ceil(diameter / 2) + 10
}

/**
 * Great-circle distance between two WGS84 coordinates using the Haversine
 * formula.
 *
 * `R = 6_371_000` is the mean Earth radius in metres. At Malaysian latitudes
 * the resulting distance is accurate to well under a metre over the distances
 * we deal with (building bounding boxes), which is far better than the Solar
 * API's pixel resolution.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dPhi = ((lat2 - lat1) * Math.PI) / 180
  const dLambda = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Adds stable, deterministic `id` fields (`panel_0`, `panel_1`, …) to every
 * panel returned by Solar API.
 *
 * The raw API response identifies panels only by array position, which is
 * fragile across re-fetches. Stable ids let the frontend match Google's
 * default layout against user-edited layouts persisted in our database.
 *
 * @param insights - Raw buildingInsights response
 * @returns A new insights object with `id` attached to each panel
 */
export function enrichBuildingInsights(insights: BuildingInsightsApiResponse): BuildingInsightsApiResponse {
  const solarPotential = isRecord(insights.solarPotential) ? insights.solarPotential : {}
  const panels = Array.isArray(solarPotential.solarPanels) ? solarPotential.solarPanels.filter(isRecord) : []
  const enriched = panels.map((panel, idx) => ({
    ...panel,
    id: `panel_${idx}`
  }))
  return {
    ...insights,
    solarPotential: {
      ...solarPotential,
      solarPanels: enriched
    }
  }
}
