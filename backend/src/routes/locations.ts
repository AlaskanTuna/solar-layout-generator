/**
 * Location and raster-data routing module.
 *
 * Handles Solar API location resolution, imagery probing, data retrieval,
 * overlay generation, and per-panel flux recomputation for authenticated users.
 */

import { Router, type Router as ExpressRouter } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  resolveLocationSchema,
  probeLocationSchema,
  fluxRecomputeSchema,
  fluxRecomputeBatchSchema
} from '../validators/locations.js'
import * as locationService from '../services/locationService.js'
import { validateFluxLocation, recomputeSinglePanel, recomputeBatchPanels } from '../services/fluxRecomputeService.js'
import { NotFoundError, BadRequestError } from '../errors.js'
import type { OverlayType } from '../services/overlayService.js'

/**
 * Location resolution and flux recompute routes
 */
export const locationsRouter: ExpressRouter = Router()

/** POST /api/locations/resolve through auth, body validation, and async handling; returns location metadata. */
locationsRouter.post(
  '/resolve',
  requireAuth,
  validate(resolveLocationSchema),
  asyncHandler(async (req, res) => {
    const { lat, lng, projectId, requiredQuality, expandedCoverage } = req.body
    const result = await locationService.resolveLocation(
      req.user!.id,
      lat,
      lng,
      projectId,
      requiredQuality,
      expandedCoverage
    )
    res.json(result)
  })
)

/** GET /api/locations/probe through auth and async handling; returns Solar API quality for a lat/lng query. */
locationsRouter.get(
  '/probe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = probeLocationSchema.safeParse(req.query)
    if (!parsed.success) {
      throw new BadRequestError('Invalid lat/lng query parameters')
    }
    const { lat, lng } = parsed.data
    res.json(await locationService.probeLocation(lat, lng))
  })
)

/** GET /api/locations/:id/status through auth and async handling; returns status for an owned location. */
locationsRouter.get(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocationStatusResponseForUser(req.user!.id, req.params.id as string)
    if (!location) throw new NotFoundError('Location not found')
    res.json(location)
  })
)

/** GET /api/locations/:id/data through auth and async handling; returns workbench data for an owned location. */
locationsRouter.get(
  '/:id/data',
  requireAuth,
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocationDataResponseForUser(req.user!.id, req.params.id as string)
    if (!location) throw new NotFoundError('Location not found')
    res.json(location)
  })
)

/** GET /api/locations/:locationId/overlay/:type through auth and async handling; returns a signed PNG URL. */
locationsRouter.get(
  '/:locationId/overlay/:type',
  requireAuth,
  asyncHandler(async (req, res) => {
    const overlayType = req.params.type as string
    if (overlayType !== 'annual-flux' && overlayType !== 'dsm' && overlayType !== 'mask') {
      throw new BadRequestError('Invalid overlay type. Must be "annual-flux", "dsm", or "mask".')
    }
    res.json(
      await locationService.getOverlayResponseForUser(
        req.user!.id,
        req.params.locationId as string,
        overlayType as OverlayType
      )
    )
  })
)

/** POST /api/locations/:locationId/panels/recompute through auth, validation, async; returns one panel's flux. */
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

/** POST /api/locations/:locationId/panels/recompute-batch through auth, validation, async; returns flux results. */
locationsRouter.post(
  '/:locationId/panels/recompute-batch',
  requireAuth,
  validate(fluxRecomputeBatchSchema),
  asyncHandler(async (req, res) => {
    const { location, panelSpecs } = await validateFluxLocation(req.user!.id, req.params.locationId as string)

    const results = await recomputeBatchPanels(location.monthlyFluxPath!, panelSpecs, req.body.panels)
    res.json({ results })
  })
)
