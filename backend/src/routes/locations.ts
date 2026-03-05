import { Router } from 'express'
import * as GeoTIFF from 'geotiff'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { resolveLocationSchema, fluxRecomputeSchema } from '../validators/locations.js'
import * as locationService from '../services/locationService.js'
import { downloadFromStorage, getSignedUrl } from '../services/storageService.js'
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
locationsRouter.post('/resolve', requireAuth, validate(resolveLocationSchema), async (req, res) => {
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

// GET /api/locations/:id/status
locationsRouter.get('/:id/status', requireAuth, async (req, res) => {
  const location = await locationService.getLocationStatusForUser(req.user!.id, req.params.id as string)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }
  const response: LocationStatusResponse = { status: location.status }
  res.json(response)
})

// GET /api/locations/:id/data
locationsRouter.get('/:id/data', requireAuth, async (req, res) => {
  const location = await locationService.getLocationDataForUser(req.user!.id, req.params.id as string)
  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }
  if (location.status !== 'ready') {
    res.status(409).json({ error: 'Location data not ready', status: location.status })
    return
  }

  // Generate signed URL for RGB image
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

// POST /api/locations/:locationId/panels/recompute
locationsRouter.post('/:locationId/panels/recompute', requireAuth, validate(fluxRecomputeSchema), async (req, res) => {
  const { center, rotation } = req.body

  // Load location data
  const location = await locationService.getLocationDataForUser(req.user!.id, req.params.locationId as string)
  if (!location || location.status !== 'ready') {
    res.status(404).json({ error: 'Location not found or not ready' })
    return
  }
  if (!location.monthlyFluxPath) {
    res.status(404).json({ error: 'Monthly flux data not available' })
    return
  }

  // Extract panel dimensions from building insights
  const insights = location.buildingInsightsJson as Record<string, unknown>
  const solarPotential = insights.solarPotential as Record<string, unknown>
  const panelWidthMeters = solarPotential.panelWidthMeters as number
  const panelHeightMeters = solarPotential.panelHeightMeters as number
  const panelCapacityWatts = solarPotential.panelCapacityWatts as number

  // Download monthly flux GeoTIFF from Supabase Storage
  const fluxBuffer = await downloadFromStorage(location.monthlyFluxPath)

  // Open GeoTIFF and setup transforms
  const tiff = await GeoTIFF.fromArrayBuffer(fluxBuffer)
  const image = await tiff.getImage()
  const geo = setupGeoTransform(image)

  // Convert center lat/lng to pixel coordinates
  const { px, py } = latLngToPixel(center.lat, center.lng, geo)

  // Convert panel dimensions from meters to pixels
  const widthPx = metersToPixels(panelWidthMeters, geo)
  const heightPx = metersToPixels(panelHeightMeters, geo)

  // Compute rotated corners
  const rotationRad = (rotation * Math.PI) / 180
  const corners = getRotatedCorners(px, py, widthPx, heightPx, rotationRad)

  // Sample 12 monthly flux bands
  const monthlyEnergyDcKwh = await computeMonthlyEnergy(image, corners, panelCapacityWatts)

  const response: FluxRecomputeResponse = { monthlyEnergyDcKwh }
  res.json(response)
})
