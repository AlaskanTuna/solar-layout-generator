import { fetchLocationPipelineInputs } from './locationPipeline/fetch.js'
import { persistLocationPipelineFailure, persistLocationPipelineSuccess } from './locationPipeline/persist.js'
import { storeLocationPipelineAssets } from './locationPipeline/store.js'
import type { ImageryQuality } from './solarApiService.js'

/**
 * Run the full location pipeline and persist the outcome
 * @param {string} locationId - Location identifier
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @param {ImageryQuality} requiredQuality - Value used for required quality
 * @param {boolean} expandedCoverage - Whether expanded coverage
 */
export async function runLocationPipeline(
  locationId: string,
  lat: number,
  lng: number,
  requiredQuality: ImageryQuality = 'HIGH',
  expandedCoverage = false
): Promise<void> {
  const t0 = Date.now()
  try {
    console.info(
      `[Pipeline] start location=${locationId} lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} quality=${requiredQuality} expanded=${expandedCoverage}`
    )

    const tFetch = Date.now()
    const fetchedInputs = await fetchLocationPipelineInputs(lat, lng, requiredQuality, expandedCoverage)
    console.info(`[Pipeline] location=${locationId} fetch ${Date.now() - tFetch}ms`)

    const tStore = Date.now()
    const storedAssets = await storeLocationPipelineAssets(locationId, fetchedInputs.downloadedLayers)
    console.info(`[Pipeline] location=${locationId} store ${Date.now() - tStore}ms`)

    const tPersist = Date.now()
    await persistLocationPipelineSuccess(locationId, requiredQuality, fetchedInputs.buildingInsightsJson, storedAssets)
    console.info(`[Pipeline] location=${locationId} persist ${Date.now() - tPersist}ms`)

    console.info(`[Pipeline] completed location=${locationId} totalMs=${Date.now() - t0}`)
  } catch (error) {
    console.error(`[Pipeline] failed location=${locationId} totalMs=${Date.now() - t0}`, error)
    await persistLocationPipelineFailure(locationId)
  }
}
