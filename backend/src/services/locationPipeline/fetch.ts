/**
 * Solar API fetch stage for the location pipeline.
 *
 * Retrieves building insights, resolves raster layer URLs, and downloads the
 * GeoTIFF assets needed by storage and frontend workbench responses.
 */

import { env } from '../../config/env.js'
import { parseBuildingInsights } from '../buildingInsightsService.js'
import {
  calculateRadius,
  DOWNLOAD_TIMEOUT_MS,
  enrichBuildingInsights,
  fetchBuildingInsights,
  fetchDataLayers,
  fetchWithTimeout,
  type BuildingInsightsApiResponse,
  type DataLayersApiResponse,
  type ImageryQuality
} from '../solarApiService.js'

/**
 * Mapping from Solar API data-layer response fields to the filenames we store
 * under each location prefix. These names are part of the storage contract used
 * by fallback loaders and overlay generation.
 */
const LAYER_FILENAMES = {
  dsmUrl: 'dsm.tif',
  rgbUrl: 'rgb.tif',
  maskUrl: 'mask.tif',
  annualFluxUrl: 'annual_flux.tif',
  monthlyFluxUrl: 'monthly_flux.tif'
} as const

/**
 * Solar API layer keys downloaded by the pipeline.
 */
export type SolarLayerKey = keyof typeof LAYER_FILENAMES

/**
 * One downloaded Solar API layer.
 */
export type DownloadedLayer = {
  field: SolarLayerKey
  filename: (typeof LAYER_FILENAMES)[SolarLayerKey]
  buffer: Buffer
}

/**
 * Solar API inputs fetched for the location pipeline.
 */
export type PipelineFetchResult = {
  buildingInsights: BuildingInsightsApiResponse
  buildingInsightsJson: BuildingInsightsApiResponse
  downloadedLayers: DownloadedLayer[]
}

/**
 * Downloads a signed Solar API layer URL with the project API key attached.
 *
 * @param url - Layer URL returned by `dataLayers:get`
 * @param field - Data-layer field being downloaded
 * @returns Layer bytes with the storage filename for this field
 */
async function downloadLayer(url: string, field: SolarLayerKey): Promise<DownloadedLayer> {
  const downloadUrl = new URL(url)
  downloadUrl.searchParams.set('key', env.GOOGLE_API_KEY)

  const response = await fetchWithTimeout(downloadUrl.toString(), DOWNLOAD_TIMEOUT_MS)
  if (!response.ok) {
    throw new Error(`Failed to download ${field}`)
  }

  return {
    field,
    filename: LAYER_FILENAMES[field],
    buffer: Buffer.from(await response.arrayBuffer())
  }
}

/**
 * Fetches building insights and all available downloadable layer assets.
 *
 * @param lat - Latitude in WGS84 degrees
 * @param lng - Longitude in WGS84 degrees
 * @param requiredQuality - Solar API imagery quality to request
 * @param expandedCoverage - Whether to request Solar API expanded coverage for BASE imagery
 * @returns Building metadata plus downloaded raster layer buffers
 */
export async function fetchLocationPipelineInputs(
  lat: number,
  lng: number,
  requiredQuality: ImageryQuality,
  expandedCoverage: boolean
): Promise<PipelineFetchResult> {
  const opts = { requiredQuality, expandedCoverage }
  const buildingInsights = await fetchBuildingInsights(lat, lng, opts)
  const parsedBuildingInsights = parseBuildingInsights(buildingInsights)
  if (!parsedBuildingInsights) {
    throw new Error('Solar API returned invalid building insights payload')
  }
  const buildingInsightsJson = enrichBuildingInsights(parsedBuildingInsights)
  const radius = calculateRadius(parsedBuildingInsights.boundingBox)
  const dataLayers = await fetchDataLayers(lat, lng, radius, opts)

  const downloadedLayers: DownloadedLayer[] = []
  for (const field of Object.keys(LAYER_FILENAMES) as SolarLayerKey[]) {
    const url = getLayerUrl(dataLayers, field)
    if (!url) continue
    const t0 = Date.now()
    downloadedLayers.push(await downloadLayer(url, field))
    console.info(`[Pipeline.fetch] ${field} downloaded in ${Date.now() - t0}ms`)
  }

  return {
    buildingInsights,
    buildingInsightsJson,
    downloadedLayers
  }
}

/**
 * Reads the URL for a known Solar API layer field.
 *
 * @param dataLayers - Raw `dataLayers:get` response with optional URLs
 * @param field - Layer field to resolve
 * @returns Signed URL for the field, or `null` when Solar API omitted the layer
 */
function getLayerUrl(dataLayers: DataLayersApiResponse, field: SolarLayerKey): string | null {
  return dataLayers[field] ?? null
}
