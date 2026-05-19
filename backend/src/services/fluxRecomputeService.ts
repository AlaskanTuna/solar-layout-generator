/**
 * Flux recomputation service for moved or edited solar panels.
 *
 * Loads monthly Solar API flux rasters, maps edited panel geometry into GeoTIFF
 * pixel space, and returns updated monthly DC energy estimates.
 */

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
 * Validates that an owned location has ready monthly flux data and usable panel specs.
 *
 * @param userId - Authenticated user that must own a project for the location
 * @param locationId - Location whose monthly flux raster will be sampled
 * @returns Location row and panel defaults needed for recomputation
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

/**
 * Downloads the monthly flux GeoTIFF and prepares the transform shared by all
 * panel recomputation paths. Keeping this in one helper avoids re-reading the
 * same raster metadata differently for single-panel and batch requests.
 *
 * @param monthlyFluxPath - Storage path of the monthly flux GeoTIFF
 * @param panelSpecs - Default panel dimensions and capacity from building insights
 * @returns Loaded GeoTIFF image, coordinate transform, and panel defaults
 */
async function loadFluxData(monthlyFluxPath: string, panelSpecs: PanelSpecs): Promise<FluxLocationData> {
  const fluxBuffer = await downloadFromStorage(monthlyFluxPath)
  const tiff = await GeoTIFF.fromArrayBuffer(fluxBuffer)
  const image = await tiff.getImage()
  const geo = setupGeoTransform(image)
  return { image, geo, panelSpecs }
}

/**
 * Recomputes monthly energy for one edited panel.
 *
 * @param monthlyFluxPath - Storage path of the monthly flux GeoTIFF
 * @param panelSpecs - Solar API defaults used when the request omits panel dimensions or capacity
 * @param panel - Edited panel center, rotation, and optional physical overrides
 * @returns Monthly DC energy for the requested panel
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
 * Recomputes monthly energy for a batch of edited panels using one raster preload.
 *
 * @param monthlyFluxPath - Storage path of the monthly flux GeoTIFF
 * @param panelSpecs - Solar API defaults used when a panel omits dimensions or capacity
 * @param panels - Edited panels to sample against the monthly flux raster
 * @returns Per-panel monthly DC energy results in request order
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
