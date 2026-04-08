import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { resolveLocationSchema, fluxRecomputeSchema, fluxRecomputeBatchSchema } from '../validators/locations.js'
import * as locationService from '../services/locationService.js'
import { getSignedUrl } from '../services/storageService.js'
import { loadReferenceGeoTransform, loadRoofMask } from '../services/geoTiffService.js'
import { resolveTifPath, getOrGenerateOverlay } from '../services/overlayService.js'
import { validateFluxLocation, recomputeSinglePanel, recomputeBatchPanels } from '../services/fluxRecomputeService.js'
import { NotFoundError, BadRequestError, AppError } from '../errors.js'
import type { OverlayType } from '../services/overlayService.js'
import type {
  ResolveLocationResponse,
  LocationStatusResponse,
  LocationDataResponse,
  FluxRecomputeBatchResponse
} from '@shared/types'
import type { ImageGeoTransform, RoofMaskResult } from '../services/geoTiffService.js'

export const locationsRouter: ExpressRouter = Router()

type LocationDataRouteResponse = LocationDataResponse & {
  imageGeoTransform: ImageGeoTransform
  roofMask: RoofMaskResult
}

// POST /api/locations/resolve
locationsRouter.post(
  '/resolve',
  requireAuth,
  validate(resolveLocationSchema),
  asyncHandler(async (req, res) => {
    const { lat, lng, projectId } = req.body
    const result = await locationService.resolveLocation(req.user!.id, lat, lng, projectId)
    const response: ResolveLocationResponse = { locationId: result.locationId, status: result.status }
    res.json(response)
  })
)

// GET /api/locations/:id/status
locationsRouter.get(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocationStatusForUser(req.user!.id, req.params.id as string)
    if (!location) throw new NotFoundError('Location not found')
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
    if (!location) throw new NotFoundError('Location not found')
    if (location.status !== 'ready') throw new AppError('Location data not ready', 409)
    if (!location.buildingInsightsJson || !location.rgbImageUrl || !location.maskPath) {
      throw new AppError('Location data is incomplete', 500)
    }

    const rgbImageUrl = await getSignedUrl(location.rgbImageUrl)
    const [imageGeoTransform, roofMask] = await Promise.all([
      loadReferenceGeoTransform(location),
      loadRoofMask(location)
    ])

    const response: LocationDataRouteResponse = {
      buildingInsights: location.buildingInsightsJson as Record<string, unknown>,
      rgbImageUrl,
      imageGeoTransform,
      roofMask
    }
    res.json(response)
  })
)

// GET /api/locations/:locationId/overlay/:type
locationsRouter.get(
  '/:locationId/overlay/:type',
  requireAuth,
  asyncHandler(async (req, res) => {
    const overlayType = req.params.type as string
    if (overlayType !== 'annual-flux' && overlayType !== 'dsm' && overlayType !== 'mask') {
      throw new BadRequestError('Invalid overlay type. Must be "annual-flux", "dsm", or "mask".')
    }

    const location = await locationService.getLocationDataForUser(req.user!.id, req.params.locationId as string)
    if (!location || location.status !== 'ready') throw new NotFoundError('Location not found or not ready')

    const tifPath = resolveTifPath(overlayType as OverlayType, location)
    if (!tifPath) throw new NotFoundError(`${overlayType} layer not available for this location`)

    const url = await getOrGenerateOverlay(tifPath, overlayType as OverlayType, location.rgbImageUrl)
    res.json({ url })
  })
)

// POST /api/locations/:locationId/panels/recompute
locationsRouter.post(
  '/:locationId/panels/recompute',
  requireAuth,
  validate(fluxRecomputeSchema),
  asyncHandler(async (req, res) => {
    const { location, panelSpecs } = await validateFluxLocation(req.user!.id, req.params.locationId as string)

    const { panelId, center, rotation, widthM, heightM, capacityWp } = req.body
    const result = await recomputeSinglePanel(location.monthlyFluxPath!, panelSpecs, {
      panelId,
      center,
      rotation,
      widthM,
      heightM,
      capacityWp
    })
    res.json(result)
  })
)

// POST /api/locations/:locationId/panels/recompute-batch
locationsRouter.post(
  '/:locationId/panels/recompute-batch',
  requireAuth,
  validate(fluxRecomputeBatchSchema),
  asyncHandler(async (req, res) => {
    const { location, panelSpecs } = await validateFluxLocation(req.user!.id, req.params.locationId as string)

    const results = await recomputeBatchPanels(location.monthlyFluxPath!, panelSpecs, req.body.panels)
    const response: FluxRecomputeBatchResponse = { results }
    res.json(response)
  })
)
