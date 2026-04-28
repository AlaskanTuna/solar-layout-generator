import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'

function toArrayBuffer(buffer: ArrayBuffer | Buffer): ArrayBuffer {
  const bytes = buffer instanceof Buffer ? Uint8Array.from(buffer) : new Uint8Array(buffer)
  return bytes.slice().buffer
}

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
  for (let index = 0; index < width * height; index++) {
    pixels[index * 3] = r[index]
    pixels[index * 3 + 1] = g[index]
    pixels[index * 3 + 2] = b[index]
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}
