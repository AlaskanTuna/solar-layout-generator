import { fetchLocationPipelineInputs } from './locationPipeline/fetch.js'
import { persistLocationPipelineFailure, persistLocationPipelineSuccess } from './locationPipeline/persist.js'
import { storeLocationPipelineAssets } from './locationPipeline/store.js'
import type { ImageryQuality } from './solarApiService.js'

export async function runLocationPipeline(
  locationId: string,
  lat: number,
  lng: number,
  requiredQuality: ImageryQuality = 'HIGH',
  expandedCoverage = false
): Promise<void> {
  try {
    console.info(
      `[Pipeline] start location=${locationId} lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} quality=${requiredQuality} expanded=${expandedCoverage}`
    )

    const fetchedInputs = await fetchLocationPipelineInputs(lat, lng, requiredQuality, expandedCoverage)
    const storedAssets = await storeLocationPipelineAssets(locationId, fetchedInputs.downloadedLayers)

    await persistLocationPipelineSuccess(locationId, requiredQuality, fetchedInputs.buildingInsightsJson, storedAssets)

    console.info(`[Pipeline] completed location=${locationId}`)
  } catch (error) {
    console.error(`[Pipeline] failed location=${locationId}`, error)
    await persistLocationPipelineFailure(locationId)
  }
}
