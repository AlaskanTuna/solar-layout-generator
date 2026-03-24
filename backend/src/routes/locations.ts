import { Router } from 'express'
import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { resolveLocationSchema, fluxRecomputeSchema, fluxRecomputeBatchSchema } from '../validators/locations.js'
import * as locationService from '../services/locationService.js'
import { downloadFromStorage, getSignedUrl, uploadToStorage } from '../services/storageService.js'
import { parsePanelSpecs } from '../services/buildingInsightsService.js'
import { setupGeoTransform, latLngToPixel, metersToPixels } from '../geo/transforms.js'
import { getRotatedCorners } from '../geo/panelGeometry.js'
import { computeMonthlyEnergy, preloadFluxRasters, computeMonthlyEnergyFromRasters } from '../geo/fluxSampler.js'
import type {
  ResolveLocationResponse,
  LocationStatusResponse,
  LocationDataResponse,
  FluxRecomputeResponse,
  FluxRecomputeBatchResponse
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
  roofMask: {
    dataBase64: string
    geoTransform: LocationImageGeoTransformResponse
  }
}

async function loadReferenceGeoTransform(location: {
  id: string
  dsmPath: string | null
}): Promise<LocationImageGeoTransformResponse> {
  const candidatePaths = [`locations/${location.id}/rgb.tif`, location.dsmPath].filter((path): path is string =>
    Boolean(path)
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

async function loadRoofMask(location: {
  id: string
  maskPath: string | null
}): Promise<LocationDataRouteResponse['roofMask']> {
  const candidatePaths = [location.maskPath, `locations/${location.id}/mask.tif`].filter(
    (path, index, array): path is string => Boolean(path) && array.indexOf(path) === index
  )

  let lastError: unknown = null

  for (const storagePath of candidatePaths) {
    try {
      const buffer = await downloadFromStorage(storagePath)
      const tiff = await GeoTIFF.fromArrayBuffer(buffer)
      const image = await tiff.getImage()
      const geo = setupGeoTransform(image)
      const raster = await image.readRasters({ interleave: true })
      const maskBytes = Uint8Array.from(raster as ArrayLike<number>, (value) => (Number(value) > 0 ? 1 : 0))

      return {
        dataBase64: Buffer.from(maskBytes).toString('base64'),
        geoTransform: {
          ...geo,
          imageWidth: image.getWidth(),
          imageHeight: image.getHeight()
        }
      }
    } catch (error) {
      lastError = error
      console.warn(`[LocationData] failed to load roof mask path=${storagePath}`, error)
    }
  }

  throw new Error(
    `Failed to load roof mask for location ${location.id}: ${lastError instanceof Error ? lastError.message : 'unknown error'}`
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
      console.warn(
        `[LocationData] not ready user=${req.user!.id} location=${req.params.id as string} status=${location.status}`
      )
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

    if (!location.maskPath) {
      console.error(`[LocationData] missing maskPath for ready location=${location.id}`)
      res.status(500).json({ error: 'Location roof mask is missing' })
      return
    }

    const rgbImageUrl = await getSignedUrl(location.rgbImageUrl)
    const [imageGeoTransform, roofMask] = await Promise.all([
      loadReferenceGeoTransform(location),
      loadRoofMask(location)
    ])
    console.info(
      `[LocationData] user=${req.user!.id} location=${location.id} signedImage=true monthlyFlux=${Boolean(location.monthlyFluxPath)}`
    )

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
    if (overlayType !== 'annual-flux' && overlayType !== 'dsm') {
      res.status(400).json({ error: 'Invalid overlay type. Must be "annual-flux" or "dsm".' })
      return
    }

    const location = await locationService.getLocationDataForUser(req.user!.id, req.params.locationId as string)
    if (!location || location.status !== 'ready') {
      res.status(404).json({ error: 'Location not found or not ready' })
      return
    }

    const tifPath = overlayType === 'annual-flux' ? location.annualFluxPath : location.dsmPath
    if (!tifPath) {
      res.status(404).json({ error: `${overlayType} layer not available for this location` })
      return
    }

    // Check for cached PNG
    const cachedPngPath = tifPath.replace('.tif', '_overlay.png')
    try {
      const cachedUrl = await getSignedUrl(cachedPngPath)
      res.json({ url: cachedUrl })
      return
    } catch {
      // No cached PNG, generate it
    }

    // Download and convert GeoTIFF to colorized PNG
    const tifBuffer = await downloadFromStorage(tifPath)
    const tiff = await GeoTIFF.fromArrayBuffer(tifBuffer)
    const image = await tiff.getImage()
    const width = image.getWidth()
    const height = image.getHeight()
    const rasters = await image.readRasters({ samples: [0] })
    const data = rasters[0] as Float32Array

    // Find min/max for normalization (skip nodata/zero values)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0) {
        if (data[i] < min) min = data[i]
        if (data[i] > max) max = data[i]
      }
    }
    if (min === Infinity) {
      min = 0
      max = 1
    }

    // Colorize: annual-flux uses blue→cyan→yellow→red heatmap, DSM uses grayscale
    const pixels = Buffer.alloc(width * height * 4)
    for (let i = 0; i < data.length; i++) {
      const offset = i * 4
      if (data[i] <= 0) {
        pixels[offset] = 0
        pixels[offset + 1] = 0
        pixels[offset + 2] = 0
        pixels[offset + 3] = 0
        continue
      }
      const ratio = Math.max(0, Math.min(1, (data[i] - min) / (max - min)))

      if (overlayType === 'annual-flux') {
        let r: number, g: number, b: number
        if (ratio < 0.33) {
          const t = ratio / 0.33
          r = Math.round(30 * (1 - t) + 0 * t)
          g = Math.round(58 * (1 - t) + 180 * t)
          b = Math.round(138 * (1 - t) + 220 * t)
        } else if (ratio < 0.66) {
          const t = (ratio - 0.33) / 0.33
          r = Math.round(0 * (1 - t) + 245 * t)
          g = Math.round(180 * (1 - t) + 200 * t)
          b = Math.round(220 * (1 - t) + 50 * t)
        } else {
          const t = (ratio - 0.66) / 0.34
          r = Math.round(245 * (1 - t) + 220 * t)
          g = Math.round(200 * (1 - t) + 50 * t)
          b = Math.round(50 * (1 - t) + 30 * t)
        }
        pixels[offset] = r
        pixels[offset + 1] = g
        pixels[offset + 2] = b
        pixels[offset + 3] = 220
      } else {
        const v = Math.round(ratio * 255)
        pixels[offset] = v
        pixels[offset + 1] = v
        pixels[offset + 2] = v
        pixels[offset + 3] = 255
      }
    }

    // Resize to match RGB image dimensions
    let targetWidth = width
    let targetHeight = height
    if (location.rgbImageUrl) {
      try {
        const rgbTifPath = location.rgbImageUrl.replace('.png', '.tif')
        const rgbBuffer = await downloadFromStorage(rgbTifPath)
        const rgbTiff = await GeoTIFF.fromArrayBuffer(rgbBuffer)
        const rgbImage = await rgbTiff.getImage()
        targetWidth = rgbImage.getWidth()
        targetHeight = rgbImage.getHeight()
      } catch {
        // Fall back to native GeoTIFF dimensions
      }
    }

    const pngBuffer = await sharp(pixels, { raw: { width, height, channels: 4 } })
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .png()
      .toBuffer()

    // Cache in storage
    try {
      await uploadToStorage(cachedPngPath, pngBuffer, 'image/png')
    } catch {
      // Non-fatal
    }

    const signedUrl = await getSignedUrl(cachedPngPath)
    res.json({ url: signedUrl })
  })
)

// POST /api/locations/:locationId/panels/recompute
locationsRouter.post(
  '/:locationId/panels/recompute',
  requireAuth,
  validate(fluxRecomputeSchema),
  asyncHandler(async (req, res) => {
    const { panelId, center, rotation, widthM, heightM, capacityWp } = req.body
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
    const widthPx = metersToPixels(widthM ?? panelSpecs.panelWidthMeters, geo)
    const heightPx = metersToPixels(heightM ?? panelSpecs.panelHeightMeters, geo)

    const rotationRad = (rotation * Math.PI) / 180
    const corners = getRotatedCorners(px, py, widthPx, heightPx, rotationRad)
    const monthlyEnergyDcKwh = await computeMonthlyEnergy(
      image,
      corners,
      capacityWp ?? panelSpecs.panelCapacityWatts
    )

    const response: FluxRecomputeResponse = { panelId, monthlyEnergyDcKwh }
    console.info(`[FluxRecompute] success panel=${panelId} months=${monthlyEnergyDcKwh.length}`)
    res.json(response)
  })
)

// POST /api/locations/:locationId/panels/recompute-batch
locationsRouter.post(
  '/:locationId/panels/recompute-batch',
  requireAuth,
  validate(fluxRecomputeBatchSchema),
  asyncHandler(async (req, res) => {
    const { panels } = req.body
    console.info(
      `[FluxRecomputeBatch] user=${req.user!.id} location=${req.params.locationId as string} panels=${panels.length}`
    )

    const location = await locationService.getLocationDataForUser(req.user!.id, req.params.locationId as string)
    if (!location || location.status !== 'ready') {
      console.warn(
        `[FluxRecomputeBatch] unavailable user=${req.user!.id} location=${req.params.locationId as string} status=${location?.status ?? 'missing'}`
      )
      res.status(404).json({ error: 'Location not found or not ready' })
      return
    }
    if (!location.monthlyFluxPath) {
      console.error(`[FluxRecomputeBatch] missing monthly flux data for location=${location.id}`)
      res.status(404).json({ error: 'Monthly flux data not available' })
      return
    }

    const panelSpecs = parsePanelSpecs(location.buildingInsightsJson)
    if (!panelSpecs) {
      console.error(`[FluxRecomputeBatch] invalid building insights for location=${location.id}`)
      res.status(500).json({ error: 'Invalid building insights data for location' })
      return
    }

    // Download and parse GeoTIFF once, pre-read all 12 bands
    const fluxBuffer = await downloadFromStorage(location.monthlyFluxPath)
    const tiff = await GeoTIFF.fromArrayBuffer(fluxBuffer)
    const image = await tiff.getImage()
    const geo = setupGeoTransform(image)
    const rasters = await preloadFluxRasters(image)

    const defaultWidthPx = metersToPixels(panelSpecs.panelWidthMeters, geo)
    const defaultHeightPx = metersToPixels(panelSpecs.panelHeightMeters, geo)

    // Process each panel from pre-loaded rasters (no additional I/O)
    const results: FluxRecomputeResponse[] = []
    for (const panel of panels) {
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
      results.push({ panelId: panel.panelId, monthlyEnergyDcKwh })
    }

    const response: FluxRecomputeBatchResponse = { results }
    console.info(`[FluxRecomputeBatch] success panels=${results.length}`)
    res.json(response)
  })
)
