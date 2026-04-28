import { prisma } from '../../config/prisma.js'
import type { BuildingInsightsApiResponse, ImageryQuality } from '../solarApiService.js'
import type { StoredLocationAssets } from './store.js'

function serializeJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

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

export async function persistLocationPipelineFailure(locationId: string): Promise<void> {
  await prisma.location.update({
    where: { id: locationId },
    data: { status: 'failed' }
  })
}
