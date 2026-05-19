/**
 * Overlay PNG generation for the workbench raster layers.
 *
 * The Google Solar API exposes annual flux, DSM elevation, and roof mask as
 * single-band GeoTIFFs. The workbench renders these as semi-transparent PNG
 * overlays on top of the satellite RGB image. This module converts a raw
 * GeoTIFF band into a coloured PNG with the right alpha and dimensions, then
 * caches the PNG in Supabase Storage so subsequent requests skip the work.
 *
 * Pipeline (per overlay request):
 *   1. Try to return the cached `<tif>_overlay.png` via signed URL.
 *   2. On cache miss: download the GeoTIFF, read band 0, find min/max ignoring
 *      zeros (background pixels).
 *   3. Map each pixel value through the type-specific colour ramp.
 *   4. Resize to match the satellite RGB image's dimensions so the overlay
 *      and base layer align in the workbench canvas.
 *   5. Encode as PNG via sharp and upload to storage.
 */

import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'
import { downloadFromStorage, getSignedUrl, uploadToStorage } from './storageService.js'

/**
 * Overlay layers that can be rendered for a location.
 *
 * - `annual-flux` — yearly solar irradiance (kWh/kW/year per pixel)
 * - `dsm`         — digital surface model (elevation in metres)
 * - `mask`        — roof segmentation mask (binary: roof vs not-roof)
 */
export type OverlayType = 'annual-flux' | 'dsm' | 'mask'

/** Single colour-ramp anchor: a position in `[0, 1]` and an RGB triplet. */
type ColorStop = { pos: number; r: number; g: number; b: number }

/**
 * Linearly interpolates an RGB colour between the two surrounding stops on a
 * colour ramp.
 *
 * `ratio` is a normalised value in `[0, 1]` (typically the pixel's value
 * rescaled from the GeoTIFF's [min, max] band range). The function walks the
 * stops in order until it finds the segment containing `ratio`, then
 * interpolates each channel by the local fraction `t`.
 *
 * @param ratio - Normalised position along the ramp in `[0, 1]`
 * @param stops - Ordered colour stops (must include `pos: 0` and `pos: 1`)
 * @returns `[r, g, b]` channel values in `[0, 255]`
 */
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

/**
 * Colour ramp for annual flux overlay.
 *
 * Black (low irradiance) → purple → red → yellow → white (high irradiance).
 * A heat-style ramp chosen so high-yield roof areas pop visually against the
 * darker low-yield zones and the satellite RGB underneath.
 */
const fluxStops: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 0 },
  { pos: 0.25, r: 128, g: 0, b: 128 },
  { pos: 0.5, r: 220, g: 30, b: 30 },
  { pos: 0.75, r: 250, g: 220, b: 50 },
  { pos: 1.0, r: 255, g: 255, b: 255 }
]

/**
 * Colour ramp for DSM elevation overlay.
 *
 * Blue (low) → cyan → green → yellow → red (high). Classic terrain-style
 * gradient so users can read relative heights at a glance.
 */
const dsmStops: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 180 },
  { pos: 0.25, r: 0, g: 180, b: 220 },
  { pos: 0.5, r: 0, g: 200, b: 0 },
  { pos: 0.75, r: 240, g: 240, b: 0 },
  { pos: 1.0, r: 220, g: 0, b: 0 }
]

/**
 * Colour ramp for roof mask overlay.
 *
 * Just two stops because the mask is binary (0 = not-roof, 1 = roof). The
 * green tone (Tailwind `emerald-500`) matches the workbench's accent colour.
 */
const maskStops: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 0 },
  { pos: 1.0, r: 34, g: 197, b: 94 }
]

function getStopsForType(type: OverlayType): ColorStop[] {
  return type === 'annual-flux' ? fluxStops : type === 'dsm' ? dsmStops : maskStops
}

/**
 * Looks up the storage path of the source GeoTIFF for a given overlay type.
 * Returns `null` if the layer was not generated for this location (e.g.
 * BASE-quality areas often lack DSM).
 *
 * @param overlayType - Which overlay layer to resolve
 * @param location - Location row with the three path columns
 * @returns Storage path to the source `.tif`, or `null`
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
 * Returns a signed URL for a coloured overlay PNG, generating and caching it
 * if no cached copy exists.
 *
 * Generation steps:
 *   1. Probe storage for `<tif>_overlay.png`. If present, return its signed URL.
 *   2. Otherwise download the source TIFF, read band 0, and find min/max of
 *      positive pixel values (zeros are treated as background and excluded
 *      from the range so a few outlier zeros don't crush the colour spread).
 *   3. For each pixel: zero → transparent; otherwise rescale to `[0, 1]` and
 *      interpolate the type-specific colour ramp. Alpha is 150 for the mask
 *      (less opaque so the satellite shows through clearly) and 230 for flux
 *      and DSM (more opaque so colours read well).
 *   4. Resize the generated raster to match the satellite RGB dimensions when
 *      available, so overlay and base layer align pixel-for-pixel in the
 *      workbench canvas. Falls back to native GeoTIFF dimensions on failure.
 *   5. Encode as PNG via sharp and upload (cache write is non-fatal).
 *
 * @param tifPath - Storage path to the source GeoTIFF
 * @param overlayType - Which colour ramp + alpha to use
 * @param rgbImageUrl - URL of the satellite RGB image, used only for sizing
 * @returns Signed URL of the cached or freshly-generated overlay PNG
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

  // Find min/max over positive pixels only; treat 0 as transparent background.
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
    // Mask uses lower alpha so the satellite layer remains readable underneath.
    pixels[offset + 3] = overlayType === 'mask' ? 150 : 230
  }

  // Align overlay dimensions with the satellite RGB so both layers register
  // pixel-for-pixel in the workbench. Without this step a flux GeoTIFF (often
  // smaller than the RGB) ends up scaled by the browser and the overlay drifts
  // off the buildings.
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
