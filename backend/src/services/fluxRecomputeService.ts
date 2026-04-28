import * as GeoTIFF from 'geotiff'
import * as locationService from './locationService.js'
import { downloadFromStorage } from './storageService.js'
import { parsePanelSpecs, type PanelSpecs } from './buildingInsightsService.js'
import { setupGeoTransform, latLngToPixel, metersToPixels } from '../geo/transforms.js'
import type { GeoTransform } from '../geo/transforms.js'
import { getRotatedCorners } from '../geo/panelGeometry.js'
import { computeMonthlyEnergy, preloadFluxRasters, computeMonthlyEnergyFromRasters } from '../geo/fluxSampler.js'
import type { FluxRecomputeResponse } from '@shared/types'
import type { GeoTIFFImage } from 'geotiff'
import { NotFoundError, AppError } from '../errors.js'

type FluxLocationData = {
  image: GeoTIFFImage
  geo: GeoTransform
  panelSpecs: PanelSpecs
}

type ValidatedLocation = Awaited<ReturnType<typeof locationService.getLocationDataForUser>>

/**
 * Validates that a location is ready for flux recomputation
 * @param {string} userId - Authenticated user identifier
 * @param {string} locationId - Location identifier
 * @returns {Promise} A promise resolving to the resulting value
 */
export async function validateFluxLocation(
  userId: string,
  locationId: string
): Promise<{ location: NonNullable<ValidatedLocation>; panelSpecs: PanelSpecs }> {
  const location = await locationService.getLocationDataForUser(userId, locationId)
  if (!location || location.status !== 'ready') {
    throw new NotFoundError('Location not found or not ready')
  }
  if (!location.monthlyFluxPath) {
    throw new NotFoundError('Monthly flux data not available')
  }
  const panelSpecs = parsePanelSpecs(location.buildingInsightsJson)
  if (!panelSpecs) {
    throw new AppError('Invalid building insights data for location', 500)
  }
  return { location, panelSpecs }
}

async function loadFluxData(monthlyFluxPath: string, panelSpecs: PanelSpecs): Promise<FluxLocationData> {
  const fluxBuffer = await downloadFromStorage(monthlyFluxPath)
  const tiff = await GeoTIFF.fromArrayBuffer(fluxBuffer)
  const image = await tiff.getImage()
  const geo = setupGeoTransform(image)
  return { image, geo, panelSpecs }
}

/**
 * Recompute monthly energy for a single moved panel
 * @param {string} monthlyFluxPath - Monthly flux path value
 * @param {PanelSpecs} panelSpecs - Value used for panel specs
 * @param {Object} panel - Panel value
 * @returns {Promise<FluxRecomputeResponse>} A promise resolving to the resulting value
 */
export async function recomputeSinglePanel(
  monthlyFluxPath: string,
  panelSpecs: PanelSpecs,
  panel: {
    panelId: string
    center: { lat: number; lng: number }
    rotation: number
    widthM?: number
    heightM?: number
    capacityWp?: number
  }
): Promise<FluxRecomputeResponse> {
  const { image, geo } = await loadFluxData(monthlyFluxPath, panelSpecs)
  const { px, py } = latLngToPixel(panel.center.lat, panel.center.lng, geo)
  const widthPx = metersToPixels(panel.widthM ?? panelSpecs.panelWidthMeters, geo)
  const heightPx = metersToPixels(panel.heightM ?? panelSpecs.panelHeightMeters, geo)
  const rotationRad = (panel.rotation * Math.PI) / 180
  const corners = getRotatedCorners(px, py, widthPx, heightPx, rotationRad)
  const monthlyEnergyDcKwh = await computeMonthlyEnergy(
    image,
    corners,
    panel.capacityWp ?? panelSpecs.panelCapacityWatts
  )
  return { panelId: panel.panelId, monthlyEnergyDcKwh }
}

/**
 * Recompute monthly energy for a batch of moved panels
 * @param {string} monthlyFluxPath - Monthly flux path value
 * @param {PanelSpecs} panelSpecs - Value used for panel specs
 * @param {Array} panels - Collection of panels values
 * @returns {Promise<FluxRecomputeResponse[]>} A promise resolving to the resulting value
 */
export async function recomputeBatchPanels(
  monthlyFluxPath: string,
  panelSpecs: PanelSpecs,
  panels: {
    panelId: string
    center: { lat: number; lng: number }
    rotation: number
    widthM?: number
    heightM?: number
    capacityWp?: number
  }[]
): Promise<FluxRecomputeResponse[]> {
  const { image, geo } = await loadFluxData(monthlyFluxPath, panelSpecs)
  const rasters = await preloadFluxRasters(image)
  const defaultWidthPx = metersToPixels(panelSpecs.panelWidthMeters, geo)
  const defaultHeightPx = metersToPixels(panelSpecs.panelHeightMeters, geo)

  return panels.map((panel) => {
    const { px, py } = latLngToPixel(panel.center.lat, panel.center.lng, geo)
    const rotationRad = (panel.rotation * Math.PI) / 180
    const wPx = panel.widthM ? metersToPixels(panel.widthM, geo) : defaultWidthPx
    const hPx = panel.heightM ? metersToPixels(panel.heightM, geo) : defaultHeightPx
    const corners = getRotatedCorners(px, py, wPx, hPx, rotationRad)
    const monthlyEnergyDcKwh = computeMonthlyEnergyFromRasters(
      rasters,
      corners,
      panel.capacityWp ?? panelSpecs.panelCapacityWatts
    )
    return { panelId: panel.panelId, monthlyEnergyDcKwh }
  })
}
