import type { GeoTIFFImage } from 'geotiff'

/**
 * Test whether a point lies inside a polygon
 * @param {number} x - Value used for x
 * @param {number} y - Value used for y
 * @param {[number, number][]} polygon - Collection of polygon values
 */
export function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  const n = polygon.length
  let inside = false
  let [p1x, p1y] = polygon[0]

  for (let i = 1; i <= n; i++) {
    const [p2x, p2y] = polygon[i % n]
    if (y > Math.min(p1y, p2y) && y <= Math.max(p1y, p2y)) {
      if (x <= Math.max(p1x, p2x)) {
        let xinters = p1x
        if (p1y !== p2y) {
          xinters = ((y - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x
        }
        if (p1x === p2x || x <= xinters) {
          inside = !inside
        }
      }
    }
    ;[p1x, p1y] = [p2x, p2y]
  }
  return inside
}

/**
 * Average flux values for pixels inside a panel polygon
 * @param {[number, number][]} corners - Collection of corners values
 * @param {ArrayLike<number>} fluxData - Value used for flux data
 * @param {number} width - Value used for width
 * @param {number} height - Value used for height
 * @returns {number} The resulting calculate average flux value
 */
export function calculateAverageFlux(
  corners: [number, number][],
  fluxData: ArrayLike<number>,
  width: number,
  height: number
): number {
  let minX = Math.floor(Math.min(...corners.map((c) => c[0])))
  let maxX = Math.floor(Math.max(...corners.map((c) => c[0])))
  let minY = Math.floor(Math.min(...corners.map((c) => c[1])))
  let maxY = Math.floor(Math.max(...corners.map((c) => c[1])))

  minX = Math.max(0, minX)
  maxX = Math.min(width - 1, maxX)
  minY = Math.max(0, minY)
  maxY = Math.min(height - 1, maxY)

  const fluxValues: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Test pixel center, not corner
      if (pointInPolygon(x + 0.5, y + 0.5, corners)) {
        fluxValues.push(fluxData[y * width + x])
      }
    }
  }

  if (fluxValues.length === 0) return 0
  return fluxValues.reduce((sum, v) => sum + v, 0) / fluxValues.length
}

/**
 * Computes monthly DC energy directly from a GeoTIFF image
 * @param {GeoTIFFImage} image - Value used for image
 * @param {[number, number][]} corners - Collection of corners values
 * @param {number} panelCapacityWatts - Value used for panel capacity watts
 * @returns {Promise<number[]>} A promise resolving to the resulting value
 */
export async function computeMonthlyEnergy(
  image: GeoTIFFImage,
  corners: [number, number][],
  panelCapacityWatts: number
): Promise<number[]> {
  const width = image.getWidth()
  const height = image.getHeight()
  const monthlyEnergyDcKwh: number[] = []

  for (let band = 0; band < 12; band++) {
    // Bands are 0-indexed: Jan=0, Dec=11
    const rasters = await image.readRasters({ samples: [band] })
    const fluxData = rasters[0] as Float32Array
    const avgFlux = calculateAverageFlux(corners, fluxData, width, height)
    monthlyEnergyDcKwh.push(avgFlux * (panelCapacityWatts / 1000))
  }

  return monthlyEnergyDcKwh
}

/**
 * Preloaded flux rasters for repeated monthly sampling
 */
export interface PreloadedFluxRasters {
  bands: ArrayLike<number>[]
  width: number
  height: number
}

/**
 * Read all monthly flux bands into memory
 * @param {GeoTIFFImage} image - Value used for image
 * @returns {Promise<PreloadedFluxRasters>} A promise resolving to the resulting value
 */
export async function preloadFluxRasters(image: GeoTIFFImage): Promise<PreloadedFluxRasters> {
  const width = image.getWidth()
  const height = image.getHeight()
  const bands: ArrayLike<number>[] = []

  for (let band = 0; band < 12; band++) {
    const rasters = await image.readRasters({ samples: [band] })
    bands.push(rasters[0] as Float32Array)
  }

  return { bands, width, height }
}

/**
 * Computes monthly DC energy from preloaded rasters
 * @param {PreloadedFluxRasters} rasters - Value used for rasters
 * @param {[number, number][]} corners - Collection of corners values
 * @param {number} panelCapacityWatts - Value used for panel capacity watts
 * @returns {number[]} The computed monthly energy from rasters
 */
export function computeMonthlyEnergyFromRasters(
  rasters: PreloadedFluxRasters,
  corners: [number, number][],
  panelCapacityWatts: number
): number[] {
  const monthlyEnergyDcKwh: number[] = []

  for (let band = 0; band < 12; band++) {
    const avgFlux = calculateAverageFlux(corners, rasters.bands[band], rasters.width, rasters.height)
    monthlyEnergyDcKwh.push(avgFlux * (panelCapacityWatts / 1000))
  }

  return monthlyEnergyDcKwh
}
