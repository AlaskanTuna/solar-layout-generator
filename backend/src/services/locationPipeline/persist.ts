import { prisma } from '../../config/prisma.js'
import type { BuildingInsightsApiResponse, ImageryQuality } from '../solarApiService.js'
import type { StoredLocationAssets } from './store.js'

function serializeJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Mark a location ready and persist pipeline outputs
 * @param {string} locationId - Location identifier
 * @param {ImageryQuality} imageryQuality - Value used for imagery quality
 * @param {BuildingInsightsApiResponse} buildingInsightsJson - Value used for building insights json
 * @param {StoredLocationAssets} storedAssets - Value used for stored assets
 */
export async function persistLocationPipelineSuccess(
  locationId: string,
  imageryQuality: ImageryQuality,
  buildingInsightsJson: BuildingInsightsApiResponse,
  storedAssets: StoredLocationAssets
): Promise<void> {
  await prisma.location.update({
    where: { id: locationId },
    data: {
      status: 'ready',
      imageryQuality,
      buildingInsightsJson: serializeJsonValue(buildingInsightsJson),
      rgbImageUrl: storedAssets.rgbImageUrl,
      monthlyFluxPath: storedAssets.monthlyFluxPath,
      maskPath: storedAssets.maskPath,
      annualFluxPath: storedAssets.annualFluxPath,
      dsmPath: storedAssets.dsmPath
    }
  })
}

/**
 * Mark a location failed after pipeline errors
 * @param {string} locationId - Location identifier
 */
export async function persistLocationPipelineFailure(locationId: string): Promise<void> {
  await prisma.location.update({
    where: { id: locationId },
    data: { status: 'failed' }
  })
}
