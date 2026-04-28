import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'
import { downloadFromStorage, getSignedUrl, uploadToStorage } from './storageService.js'

/**
 * Overlay layers that can be rendered for a location
 */
export type OverlayType = 'annual-flux' | 'dsm' | 'mask'

type ColorStop = { pos: number; r: number; g: number; b: number }

function lerpColor(ratio: number, stops: ColorStop[]): [number, number, number] {
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio <= stops[i + 1].pos) {
      const t = (ratio - stops[i].pos) / (stops[i + 1].pos - stops[i].pos)
      return [
        Math.round(stops[i].r + t * (stops[i + 1].r - stops[i].r)),
        Math.round(stops[i].g + t * (stops[i + 1].g - stops[i].g)),
        Math.round(stops[i].b + t * (stops[i + 1].b - stops[i].b))
      ]
    }
  }
  const last = stops[stops.length - 1]
  return [last.r, last.g, last.b]
}

const fluxStops: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 0 },
  { pos: 0.25, r: 128, g: 0, b: 128 },
  { pos: 0.5, r: 220, g: 30, b: 30 },
  { pos: 0.75, r: 250, g: 220, b: 50 },
  { pos: 1.0, r: 255, g: 255, b: 255 }
]

const dsmStops: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 180 },
  { pos: 0.25, r: 0, g: 180, b: 220 },
  { pos: 0.5, r: 0, g: 200, b: 0 },
  { pos: 0.75, r: 240, g: 240, b: 0 },
  { pos: 1.0, r: 220, g: 0, b: 0 }
]

const maskStops: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 0 },
  { pos: 1.0, r: 34, g: 197, b: 94 }
]

function getStopsForType(type: OverlayType): ColorStop[] {
  return type === 'annual-flux' ? fluxStops : type === 'dsm' ? dsmStops : maskStops
}

/**
 * Resolves the storage path for a given overlay type
 * @param {OverlayType} overlayType - Value used for overlay type
 * @param {Object} location - Location record to process
 * @returns {string} The resolved tif path
 */
export function resolveTifPath(
  overlayType: OverlayType,
  location: { annualFluxPath: string | null; dsmPath: string | null; maskPath: string | null }
): string | null {
  return overlayType === 'annual-flux'
    ? location.annualFluxPath
    : overlayType === 'dsm'
      ? location.dsmPath
      : location.maskPath
}

/**
 * Get a cached overlay PNG or generate one from the source GeoTIFF
 * @param {string} tifPath - Tif path value
 * @param {OverlayType} overlayType - Value used for overlay type
 * @param {string | null} rgbImageUrl - Rgb image url value
 * @returns {Promise<string>} A promise resolving to the requested or generate overlay
 */
export async function getOrGenerateOverlay(
  tifPath: string,
  overlayType: OverlayType,
  rgbImageUrl: string | null
): Promise<string> {
  const cachedPngPath = tifPath.replace('.tif', '_overlay.png')

  try {
    const cachedUrl = await getSignedUrl(cachedPngPath)
    return cachedUrl
  } catch {
    // No cached PNG, generate it
  }

  const tifBuffer = await downloadFromStorage(tifPath)
  const tiff = await GeoTIFF.fromArrayBuffer(tifBuffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const rasters = await image.readRasters({ samples: [0] })
  const data = rasters[0] as Float32Array

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

  const stops = getStopsForType(overlayType)
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
    const [r, g, b] = lerpColor(ratio, stops)
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
    pixels[offset + 3] = overlayType === 'mask' ? 150 : 230
  }

  let targetWidth = width
  let targetHeight = height
  if (rgbImageUrl) {
    try {
      const rgbTifPath = rgbImageUrl.replace('.png', '.tif')
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

  try {
    await uploadToStorage(cachedPngPath, pngBuffer, 'image/png')
  } catch {
    // Non-fatal
  }

  return getSignedUrl(cachedPngPath)
}
