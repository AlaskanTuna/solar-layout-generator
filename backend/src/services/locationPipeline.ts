import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { fetchBuildingInsights, fetchDataLayers, calculateRadius, enrichBuildingInsights } from './solarApiService.js'
import { uploadToStorage } from './storageService.js'

const LAYER_FIELDS: Record<string, string> = {
  dsmUrl: 'dsm.tif',
  rgbUrl: 'rgb.tif',
  maskUrl: 'mask.tif',
  annualFluxUrl: 'annual_flux.tif',
  monthlyFluxUrl: 'monthly_flux.tif'
}

async function convertRgbToPng(rgbTifBuffer: ArrayBuffer | Buffer): Promise<Buffer> {
  const arrayBuffer =
    rgbTifBuffer instanceof Buffer
      ? rgbTifBuffer.buffer.slice(rgbTifBuffer.byteOffset, rgbTifBuffer.byteOffset + rgbTifBuffer.byteLength)
      : rgbTifBuffer
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer as ArrayBuffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()

  const rasters = await image.readRasters({ samples: [0, 1, 2] })
  const r = rasters[0] as Uint8Array
  const g = rasters[1] as Uint8Array
  const b = rasters[2] as Uint8Array

  // Interleave into RGBRGBRGB...
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = r[i]
    pixels[i * 3 + 1] = g[i]
    pixels[i * 3 + 2] = b[i]
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .sharpen({ sigma: 2, m1: 1.5, m2: 0.7 })
    .linear(1.1, 0)
    .png()
    .toBuffer()
}

export async function runLocationPipeline(locationId: string, lat: number, lng: number): Promise<void> {
  try {
    console.info(`[Pipeline] start location=${locationId} lat=${lat.toFixed(6)} lng=${lng.toFixed(6)}`)

    // Step 1: Fetch building insights
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawInsights = (await fetchBuildingInsights(lat, lng)) as any
    const buildingInsightsJson = enrichBuildingInsights(rawInsights)

    // Step 2: Calculate radius and fetch data layers
    const bbox = rawInsights.boundingBox
    const radius = calculateRadius(bbox)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataLayers = (await fetchDataLayers(lat, lng, radius)) as Record<string, any>

    // Step 3: Download GeoTIFFs and upload to Supabase Storage
    const storagePaths: Record<string, string> = {}
    let rgbBuffer: Buffer | null = null

    for (const [field, filename] of Object.entries(LAYER_FIELDS)) {
      const url = dataLayers[field]
      if (!url) continue

      // GeoTIFF URLs from dataLayers require the API key appended
      const downloadUrl = new URL(url)
      downloadUrl.searchParams.set('key', env.GOOGLE_SOLAR_API_KEY)
      const response = await fetch(downloadUrl.toString())
      if (!response.ok) throw new Error(`Failed to download ${field}`)
      const buffer = Buffer.from(await response.arrayBuffer())

      const storagePath = `locations/${locationId}/${filename}`
      await uploadToStorage(storagePath, buffer, 'image/tiff')
      storagePaths[field] = storagePath
      console.info(`[Pipeline] uploaded ${storagePath}`)

      if (field === 'rgbUrl') rgbBuffer = buffer
    }

    // Step 4: Convert RGB GeoTIFF to PNG
    let rgbImageUrl: string | null = null
    if (rgbBuffer) {
      const pngBuffer = await convertRgbToPng(rgbBuffer)
      const pngPath = `locations/${locationId}/rgb.png`
      await uploadToStorage(pngPath, pngBuffer, 'image/png')
      rgbImageUrl = pngPath
      console.info(`[Pipeline] uploaded ${pngPath}`)
    }

    // Step 5: Mark location ready with all data
    await prisma.location.update({
      where: { id: locationId },
      data: {
        status: 'ready',
        buildingInsightsJson,
        rgbImageUrl,
        monthlyFluxPath: storagePaths['monthlyFluxUrl'] ?? null,
        maskPath: storagePaths['maskUrl'] ?? null,
        annualFluxPath: storagePaths['annualFluxUrl'] ?? null,
        dsmPath: storagePaths['dsmUrl'] ?? null
      }
    })

    console.info(`Pipeline completed for location ${locationId}`)
  } catch (error) {
    console.error(`Pipeline failed for location ${locationId}:`, error)
    await prisma.location.update({
      where: { id: locationId },
      data: { status: 'failed' }
    })
  }
}
