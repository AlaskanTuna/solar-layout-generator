/**
 * Storage stage for the location pipeline.
 *
 * Uploads downloaded Solar API GeoTIFF layers and creates the browser-facing
 * RGB PNG derivative used by the workbench.
 */

import { uploadToStorage } from '../storageService.js'
import { convertRgbTiffToPng } from './convert.js'
import type { DownloadedLayer } from './fetch.js'

/**
 * Storage paths produced by the location pipeline.
 */
export type StoredLocationAssets = {
  monthlyFluxPath: string | null
  maskPath: string | null
  annualFluxPath: string | null
  dsmPath: string | null
  rgbImageUrl: string | null
}

/**
 * Persists downloaded pipeline assets to storage.
 *
 * @param locationId - Location prefix under the shared storage bucket
 * @param downloadedLayers - Solar API raster layers downloaded for this location
 * @returns Stored object paths used by later pipeline and route stages
 */
export async function storeLocationPipelineAssets(
  locationId: string,
  downloadedLayers: DownloadedLayer[]
): Promise<StoredLocationAssets> {
  const storedAssets: StoredLocationAssets = {
    monthlyFluxPath: null,
    maskPath: null,
    annualFluxPath: null,
    dsmPath: null,
    rgbImageUrl: null
  }

  let rgbBuffer: Buffer | null = null

  for (const layer of downloadedLayers) {
    const storagePath = `locations/${locationId}/${layer.filename}`
    await uploadToStorage(storagePath, layer.buffer, 'image/tiff')
    console.info(`[Pipeline] uploaded ${storagePath}`)

    if (layer.field === 'monthlyFluxUrl') storedAssets.monthlyFluxPath = storagePath
    if (layer.field === 'maskUrl') storedAssets.maskPath = storagePath
    if (layer.field === 'annualFluxUrl') storedAssets.annualFluxPath = storagePath
    if (layer.field === 'dsmUrl') storedAssets.dsmPath = storagePath
    if (layer.field === 'rgbUrl') rgbBuffer = layer.buffer
  }

  if (rgbBuffer) {
    // RGB gets a PNG derivative because browsers display it directly; raw GeoTIFF layers are stored for backend use.
    const pngBuffer = await convertRgbTiffToPng(rgbBuffer)
    const pngPath = `locations/${locationId}/rgb.png`
    await uploadToStorage(pngPath, pngBuffer, 'image/png')
    storedAssets.rgbImageUrl = pngPath
    console.info(`[Pipeline] uploaded ${pngPath}`)
  }

  return storedAssets
}
