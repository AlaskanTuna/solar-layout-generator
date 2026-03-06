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

type LocationImageGeoTransformResponse = {
  originX: number
  originY: number
  resX: number
  resY: number
  fromCRS: string
  toCRS: string
  imageWidth: number
  imageHeight: number
}

type LocationDataRouteResponse = LocationDataResponse & {
  imageGeoTransform: LocationImageGeoTransformResponse
}

async function loadReferenceGeoTransform(location: {
  id: string
  dsmPath: string | null
}): Promise<LocationImageGeoTransformResponse> {
  const candidatePaths = [`locations/${location.id}/rgb.tif`, location.dsmPath].filter(
    (path): path is string => Boolean(path)
  )

  let lastError: unknown = null

  for (const storagePath of candidatePaths) {
    try {
      const buffer = await downloadFromStorage(storagePath)
      const tiff = await GeoTIFF.fromArrayBuffer(buffer)
      const image = await tiff.getImage()
      const geo = setupGeoTransform(image)

      return {
        ...geo,
        imageWidth: image.getWidth(),
        imageHeight: image.getHeight()
      }
    } catch (error) {
      lastError = error
      console.warn(`[LocationData] failed to load reference GeoTIFF path=${storagePath}`, error)
    }
  }

  throw new Error(
    `Failed to load reference GeoTIFF for location ${location.id}: ${
      lastError instanceof Error ? lastError.message : 'unknown error'
    }`
  )
}

// POST /api/locations/resolve
locationsRouter.post(
  '/resolve',
  requireAuth,
  validate(resolveLocationSchema),
  asyncHandler(async (req, res) => {
    const { lat, lng, projectId } = req.body
    console.info(
      `[LocationResolve] user=${req.user!.id} project=${projectId ?? 'none'} lat=${lat.toFixed(6)} lng=${lng.toFixed(6)}`
    )
    const result = await locationService.resolveLocation(req.user!.id, lat, lng, projectId)
    if ('error' in result) {
      console.warn(`[LocationResolve] project not found user=${req.user!.id} project=${projectId ?? 'none'}`)
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
      console.warn(`[LocationStatus] not found user=${req.user!.id} location=${req.params.id as string}`)
      res.status(404).json({ error: 'Location not found' })
      return
    }

    console.info(`[LocationStatus] user=${req.user!.id} location=${req.params.id as string} status=${location.status}`)
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
      console.warn(`[LocationData] not found user=${req.user!.id} location=${req.params.id as string}`)
      res.status(404).json({ error: 'Location not found' })
      return
    }
    if (location.status !== 'ready') {
      console.warn(`[LocationData] not ready user=${req.user!.id} location=${req.params.id as string} status=${location.status}`)
      res.status(409).json({ error: 'Location data not ready', status: location.status })
      return
    }
    if (!location.buildingInsightsJson) {
      console.error(`[LocationData] missing buildingInsightsJson for ready location=${location.id}`)
      res.status(500).json({ error: 'Location building insights are missing' })
      return
    }
    if (!location.rgbImageUrl) {
      console.error(`[LocationData] missing rgbImageUrl for ready location=${location.id}`)
      res.status(500).json({ error: 'Location rooftop image is missing' })
      return
    }

    const rgbImageUrl = await getSignedUrl(location.rgbImageUrl)
    const imageGeoTransform = await loadReferenceGeoTransform(location)
    console.info(
      `[LocationData] user=${req.user!.id} location=${location.id} signedImage=true monthlyFlux=${Boolean(location.monthlyFluxPath)}`
    )

    const response: LocationDataRouteResponse = {
      buildingInsights: location.buildingInsightsJson as Record<string, unknown>,
      rgbImageUrl,
      imageGeoTransform
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
    console.info(
      `[FluxRecompute] user=${req.user!.id} location=${req.params.locationId as string} panel=${panelId} rotation=${rotation.toFixed(2)}`
    )

    const location = await locationService.getLocationDataForUser(req.user!.id, req.params.locationId as string)
    if (!location || location.status !== 'ready') {
      console.warn(
        `[FluxRecompute] unavailable user=${req.user!.id} location=${req.params.locationId as string} status=${location?.status ?? 'missing'}`
      )
      res.status(404).json({ error: 'Location not found or not ready' })
      return
    }
    if (!location.monthlyFluxPath) {
      console.error(`[FluxRecompute] missing monthly flux data for location=${location.id}`)
      res.status(404).json({ error: 'Monthly flux data not available' })
      return
    }

    const panelSpecs = parsePanelSpecs(location.buildingInsightsJson)
    if (!panelSpecs) {
      console.error(`[FluxRecompute] invalid building insights for location=${location.id}`)
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
    console.info(`[FluxRecompute] success panel=${panelId} months=${monthlyEnergyDcKwh.length}`)
    res.json(response)
  })
)
