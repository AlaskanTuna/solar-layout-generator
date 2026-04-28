import { uploadToStorage } from '../storageService.js'
import { convertRgbTiffToPng } from './convert.js'
import type { DownloadedLayer } from './fetch.js'

/**
 * Storage paths produced by the location pipeline
 */
export type StoredLocationAssets = {
  monthlyFluxPath: string | null
  maskPath: string | null
  annualFluxPath: string | null
  dsmPath: string | null
  rgbImageUrl: string | null
}

/**
 * Persists downloaded pipeline assets to storage
 * @param {string} locationId - Location identifier
 * @param {DownloadedLayer[]} downloadedLayers - Collection of downloaded layers values
 * @returns {Promise<StoredLocationAssets>} A promise resolving to the resulting value
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
    const pngBuffer = await convertRgbTiffToPng(rgbBuffer)
    const pngPath = `locations/${locationId}/rgb.png`
    await uploadToStorage(pngPath, pngBuffer, 'image/png')
    storedAssets.rgbImageUrl = pngPath
    console.info(`[Pipeline] uploaded ${pngPath}`)
  }

  return storedAssets
}
