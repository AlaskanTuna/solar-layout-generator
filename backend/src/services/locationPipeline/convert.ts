/**
 * Raster conversion utilities for location pipeline assets.
 *
 * Converts Google Solar API RGB GeoTIFF output into browser-friendly PNGs while
 * preserving the original pixel dimensions for workbench alignment.
 */

import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'

/**
 * Converts storage/download buffers into the exact ArrayBuffer shape expected
 * by geotiff.js.
 *
 * @param buffer - RGB GeoTIFF bytes from the pipeline
 * @returns Detached ArrayBuffer suitable for GeoTIFF parsing
 */
function toArrayBuffer(buffer: ArrayBuffer | Buffer): ArrayBuffer {
  // geotiff.js requires an ArrayBuffer, while the pipeline hands around Node Buffers.
  const bytes = buffer instanceof Buffer ? Uint8Array.from(buffer) : new Uint8Array(buffer)
  return bytes.slice().buffer
}

/**
 * Converts an RGB GeoTIFF buffer to a PNG suitable for browser display.
 *
 * @param rgbTifBuffer - Raw RGB GeoTIFF bytes downloaded from Solar API
 * @returns PNG bytes encoded by sharp
 */
export async function convertRgbTiffToPng(rgbTifBuffer: ArrayBuffer | Buffer): Promise<Buffer> {
  const tiff = await GeoTIFF.fromArrayBuffer(toArrayBuffer(rgbTifBuffer))
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()

  const rasters = await image.readRasters({ samples: [0, 1, 2] })
  const r = rasters[0] as Uint8Array
  const g = rasters[1] as Uint8Array
  const b = rasters[2] as Uint8Array

  const pixels = Buffer.alloc(width * height * 3)
  // Assemble interleaved raw RGB pixels for sharp from GeoTIFF's separate band arrays.
  for (let index = 0; index < width * height; index++) {
    pixels[index * 3] = r[index]
    pixels[index * 3 + 1] = g[index]
    pixels[index * 3 + 2] = b[index]
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}
