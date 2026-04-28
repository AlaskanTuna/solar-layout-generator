import * as GeoTIFF from 'geotiff'
import { downloadFromStorage } from './storageService.js'
import { setupGeoTransform } from '../geo/transforms.js'

/**
 * Geo transform and image dimensions for a loaded GeoTIFF
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
 * Base64 roof mask payload paired with its transform
 */
export type RoofMaskResult = {
  dataBase64: string
  geoTransform: ImageGeoTransform
}

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

function uniquePaths(paths: (string | null)[]): string[] {
  return paths.filter((path, index, array): path is string => Boolean(path) && array.indexOf(path) === index)
}

/**
 * Loads a reference transform for a location's GeoTIFF
 * @param {Object} location - Location record to process
 * @returns {Promise<ImageGeoTransform>} A promise resolving to the requested reference geo transform
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
 * Loads and encode a roof mask GeoTIFF
 * @param {Object} location - Location record to process
 * @returns {Promise<RoofMaskResult>} A promise resolving to the requested roof mask
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
