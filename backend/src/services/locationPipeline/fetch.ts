import { env } from '../../config/env.js'
import { parseBuildingInsights } from '../buildingInsightsService.js'
import {
  calculateRadius,
  enrichBuildingInsights,
  fetchBuildingInsights,
  fetchDataLayers,
  type BuildingInsightsApiResponse,
  type DataLayersApiResponse,
  type ImageryQuality
} from '../solarApiService.js'

const LAYER_FILENAMES = {
  dsmUrl: 'dsm.tif',
  rgbUrl: 'rgb.tif',
  maskUrl: 'mask.tif',
  annualFluxUrl: 'annual_flux.tif',
  monthlyFluxUrl: 'monthly_flux.tif'
} as const

/**
 * Solar API layer keys downloaded by the pipeline
 */
export type SolarLayerKey = keyof typeof LAYER_FILENAMES

/**
 * One downloaded Solar API layer
 */
export type DownloadedLayer = {
  field: SolarLayerKey
  filename: (typeof LAYER_FILENAMES)[SolarLayerKey]
  buffer: Buffer
}

/**
 * Solar API inputs fetched for the location pipeline
 */
export type PipelineFetchResult = {
  buildingInsights: BuildingInsightsApiResponse
  buildingInsightsJson: BuildingInsightsApiResponse
  downloadedLayers: DownloadedLayer[]
}

async function downloadLayer(url: string, field: SolarLayerKey): Promise<DownloadedLayer> {
  const downloadUrl = new URL(url)
  downloadUrl.searchParams.set('key', env.GOOGLE_API_KEY)

  const response = await fetch(downloadUrl.toString())
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
 * Fetches building insights and downloadable layer assets
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @param {ImageryQuality} requiredQuality - Value used for required quality
 * @param {boolean} expandedCoverage - Whether expanded coverage
 * @returns {Promise<PipelineFetchResult>} A promise resolving to the resulting value
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
    downloadedLayers.push(await downloadLayer(url, field))
  }

  return {
    buildingInsights,
    buildingInsightsJson,
    downloadedLayers
  }
}

function getLayerUrl(dataLayers: DataLayersApiResponse, field: SolarLayerKey): string | null {
  return dataLayers[field] ?? null
}
