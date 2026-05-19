/**
 * GeoTIFF loading helpers for location responses.
 *
 * Reads stored Solar API rasters to expose map transforms and compact roof-mask
 * data to the frontend workbench.
 */

import * as GeoTIFF from 'geotiff'
import { downloadFromStorage } from './storageService.js'
import { setupGeoTransform } from '../geo/transforms.js'

/**
 * Geo transform and image dimensions for a loaded GeoTIFF.
 */
export type ImageGeoTransform = {
  originX: number
  originY: number
  resX: number
  resY: number
  fromCRS: string
  toCRS: string
  imageWidth: number
  imageHeight: number
}

/**
 * Base64 roof mask payload paired with its transform.
 */
export type RoofMaskResult = {
  dataBase64: string
  geoTransform: ImageGeoTransform
}

/**
 * Attempts each possible storage path for a GeoTIFF, returning the first image
 * that can be downloaded and handled. Some older rows only have convention-based
 * paths while newer rows persist explicit path columns, so callers provide both.
 *
 * @param candidatePaths - Ordered storage paths to try
 * @param locationId - Location used in the final failure message
 * @param label - Log label identifying which raster is being loaded
 * @param handler - Reader that converts the opened GeoTIFF image into caller-specific data
 * @returns The handler result from the first successfully loaded image
 */
async function loadGeoTIFFWithFallback<T>(
  candidatePaths: string[],
  locationId: string,
  label: string,
  handler: (image: GeoTIFF.GeoTIFFImage) => Promise<T>
): Promise<T> {
  let lastError: unknown = null

  for (const storagePath of candidatePaths) {
    try {
      const buffer = await downloadFromStorage(storagePath)
      const tiff = await GeoTIFF.fromArrayBuffer(buffer)
      const image = await tiff.getImage()
      return await handler(image)
    } catch (error) {
      lastError = error
      console.warn(`[${label}] failed to load GeoTIFF path=${storagePath}`, error)
    }
  }

  throw new Error(
    `Failed to load ${label} for location ${locationId}: ${
      lastError instanceof Error ? lastError.message : 'unknown error'
    }`
  )
}

/**
 * Removes nulls and duplicate storage paths while preserving the caller's
 * preferred fallback order.
 *
 * @param paths - Candidate storage paths, including nullable database fields
 * @returns Unique non-empty paths in first-seen order
 */
function uniquePaths(paths: (string | null)[]): string[] {
  return paths.filter((path, index, array): path is string => Boolean(path) && array.indexOf(path) === index)
}

/**
 * Loads a reference transform from the location's RGB GeoTIFF, falling back to DSM.
 *
 * @param location - Location row containing its id and optional DSM path
 * @returns Coordinate transform plus image dimensions for frontend georeferencing
 */
export async function loadReferenceGeoTransform(location: {
  id: string
  dsmPath: string | null
}): Promise<ImageGeoTransform> {
  const candidatePaths = uniquePaths([`locations/${location.id}/rgb.tif`, location.dsmPath])

  return loadGeoTIFFWithFallback(candidatePaths, location.id, 'LocationData', (image) => {
    const geo = setupGeoTransform(image)
    return Promise.resolve({
      ...geo,
      imageWidth: image.getWidth(),
      imageHeight: image.getHeight()
    })
  })
}

/**
 * Loads and encodes a roof mask GeoTIFF as compact binary mask bytes.
 *
 * @param location - Location row containing its id and optional mask path
 * @returns Base64 mask bytes paired with the mask raster transform
 */
export async function loadRoofMask(location: { id: string; maskPath: string | null }): Promise<RoofMaskResult> {
  const candidatePaths = uniquePaths([location.maskPath, `locations/${location.id}/mask.tif`])

  return loadGeoTIFFWithFallback(candidatePaths, location.id, 'RoofMask', async (image) => {
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
  })
}
