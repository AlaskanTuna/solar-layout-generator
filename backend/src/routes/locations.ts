import { Router } from 'express'
import * as GeoTIFF from 'geotiff'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { resolveLocationSchema, fluxRecomputeSchema } from '../validators/locations.js'
import * as locationService from '../services/locationService.js'
import { downloadFromStorage, getSignedUrl } from '../services/storageService.js'
import { parsePanelSpecs } from '../services/buildingInsightsService.js'
import { setupGeoTransform, latLngToPixel, metersToPixels } from '../geo/transforms.js'
import { getRotatedCorners } from '../geo/panelGeometry.js'
import { computeMonthlyEnergy } from '../geo/fluxSampler.js'
import type {
  ResolveLocationResponse,
  LocationStatusResponse,
  LocationDataResponse,
  FluxRecomputeResponse
} from '@shared/types'

export const locationsRouter = Router()

// POST /api/locations/resolve
locationsRouter.post(
  '/resolve',
  requireAuth,
  validate(resolveLocationSchema),
  asyncHandler(async (req, res) => {
    const { lat, lng, projectId } = req.body
    const result = await locationService.resolveLocation(req.user!.id, lat, lng, projectId)
    if ('error' in result) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const response: ResolveLocationResponse = {
      locationId: result.locationId,
      status: result.status
    }
    res.json(response)
  })
)

// GET /api/locations/:id/status
locationsRouter.get(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocationStatusForUser(req.user!.id, req.params.id as string)
    if (!location) {
      res.status(404).json({ error: 'Location not found' })
      return
    }

    const response: LocationStatusResponse = { status: location.status }
    res.json(response)
  })
)

// GET /api/locations/:id/data
locationsRouter.get(
  '/:id/data',
  requireAuth,
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocationDataForUser(req.user!.id, req.params.id as string)
    if (!location) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
    if (location.status !== 'ready') {
      res.status(409).json({ error: 'Location data not ready', status: location.status })
      return
    }

    let rgbImageUrl = ''
    if (location.rgbImageUrl) {
      rgbImageUrl = await getSignedUrl(location.rgbImageUrl)
    }

    const response: LocationDataResponse = {
      buildingInsights: location.buildingInsightsJson as Record<string, unknown>,
      rgbImageUrl
    }
    res.json(response)
  })
)

// POST /api/locations/:locationId/panels/recompute
locationsRouter.post(
  '/:locationId/panels/recompute',
  requireAuth,
  validate(fluxRecomputeSchema),
  asyncHandler(async (req, res) => {
    const { panelId, center, rotation } = req.body

    const location = await locationService.getLocationDataForUser(req.user!.id, req.params.locationId as string)
    if (!location || location.status !== 'ready') {
      res.status(404).json({ error: 'Location not found or not ready' })
      return
    }
    if (!location.monthlyFluxPath) {
      res.status(404).json({ error: 'Monthly flux data not available' })
      return
    }

    const panelSpecs = parsePanelSpecs(location.buildingInsightsJson)
    if (!panelSpecs) {
      res.status(500).json({ error: 'Invalid building insights data for location' })
      return
    }

    const fluxBuffer = await downloadFromStorage(location.monthlyFluxPath)
    const tiff = await GeoTIFF.fromArrayBuffer(fluxBuffer)
    const image = await tiff.getImage()
    const geo = setupGeoTransform(image)

    const { px, py } = latLngToPixel(center.lat, center.lng, geo)
    const widthPx = metersToPixels(panelSpecs.panelWidthMeters, geo)
    const heightPx = metersToPixels(panelSpecs.panelHeightMeters, geo)

    const rotationRad = (rotation * Math.PI) / 180
    const corners = getRotatedCorners(px, py, widthPx, heightPx, rotationRad)
    const monthlyEnergyDcKwh = await computeMonthlyEnergy(image, corners, panelSpecs.panelCapacityWatts)

    const response: FluxRecomputeResponse = { panelId, monthlyEnergyDcKwh }
    res.json(response)
  })
)
