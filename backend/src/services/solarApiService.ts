import { env } from '../config/env.js'

const BASE_URL = 'https://solar.googleapis.com/v1'

export type ImageryQuality = 'HIGH' | 'BASE'

export type SolarApiOpts = {
  requiredQuality?: ImageryQuality
  expandedCoverage?: boolean
}

export type SolarCoordinate = {
  latitude: number
  longitude: number
}

export type SolarBoundingBox = {
  sw: SolarCoordinate
  ne: SolarCoordinate
}

export type BuildingInsightsApiResponse = {
  boundingBox?: SolarBoundingBox
  solarPotential?: {
    solarPanels?: Record<string, unknown>[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

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

/** Fetch the closest Solar API building insights record */
export async function fetchBuildingInsights(
  lat: number,
  lng: number,
  opts: SolarApiOpts = {}
): Promise<BuildingInsightsApiResponse> {
  const params = buildSolarParams(lat, lng, opts)
  const response = await fetch(`${BASE_URL}/buildingInsights:findClosest?${params}`)
  if (!response.ok) {
    throw new Error(`Solar API error: ${response.status} ${await response.text()}`)
  }
  const json = await response.json()
  if (!isRecord(json)) {
    throw new Error('Solar API returned invalid building insights payload')
  }
  return json
}

/** Fetch Solar API raster layer URLs for a location */
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

  const response = await fetch(`${BASE_URL}/dataLayers:get?${params}`)
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

// Probe a coordinate end-to-end at three tiers in priority order:
//   1. HIGH (no expansion) — best quality, focused radius
//   2. BASE (no expansion) — sometimes works, more focused than expanded
//   3. BASE + EXPANDED_COVERAGE — widest fallback, last resort
//
// Each probe checks BOTH buildingInsights AND dataLayers because the matrix
// (tests/smoke/m2-klang-matrix.ts) showed that buildingInsights can return 200
// while dataLayers 404s for the same coords. Probing only buildingInsights
// produced false positives that broke pipelines downstream (M-2 root cause)
//
// Note: EXPANDED_COVERAGE is rejected (400) by Solar API at HIGH and MEDIUM —
// it's only valid with BASE. Failed Solar API calls don't count toward the
// free quota, so the exhaustive probe is cheap
/** Available imagery quality options for a probed location */
export type ProbeResult = {
  availableQualities: ImageryQuality[]
  bestQuality: ImageryQuality | null
  expandedCoverage: boolean
}

const PROBE_RADIUS_METERS = 100

/** Probe the best Solar API quality available for a coordinate */
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

  if (
    bestQuality === null &&
    (await probeFullChain(lat, lng, { requiredQuality: 'BASE', expandedCoverage: true }))
  ) {
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
    const response = await fetch(`${baseUrl}?${params}`)
    return response.ok
  } catch {
    return false
  }
}

/** Derive a conservative data-layer radius from a bounding box */
export function calculateRadius(bbox: SolarBoundingBox): number {
  const diameter = haversineDistance(bbox.sw.latitude, bbox.sw.longitude, bbox.ne.latitude, bbox.ne.longitude)
  return Math.ceil(diameter / 2) + 10
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dPhi = ((lat2 - lat1) * Math.PI) / 180
  const dLambda = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Attach stable panel ids to a building insights payload */
export function enrichBuildingInsights(insights: BuildingInsightsApiResponse): BuildingInsightsApiResponse {
  const solarPotential = isRecord(insights.solarPotential) ? insights.solarPotential : {}
  const panels = Array.isArray(solarPotential.solarPanels)
    ? solarPotential.solarPanels.filter(isRecord)
    : []
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
