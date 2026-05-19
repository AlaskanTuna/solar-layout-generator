/**
 * Persistence stage for the location pipeline.
 *
 * Writes successful Solar API outputs onto the location row, or marks the row
 * failed when any earlier pipeline stage throws.
 */

import { prisma } from '../../config/prisma.js'
import type { BuildingInsightsApiResponse, ImageryQuality } from '../solarApiService.js'
import type { StoredLocationAssets } from './store.js'

function serializeJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Marks a location ready and persists all pipeline outputs.
 *
 * @param locationId - Location row being completed
 * @param imageryQuality - Solar API imagery quality used for the successful run
 * @param buildingInsightsJson - Enriched building insights stored for later route responses
 * @param storedAssets - Storage paths produced by the asset stage
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
 * Marks a location failed after pipeline errors.
 *
 * @param locationId - Location row whose pipeline failed
 */
export async function persistLocationPipelineFailure(locationId: string): Promise<void> {
  await prisma.location.update({
    where: { id: locationId },
    data: { status: 'failed' }
  })
}
