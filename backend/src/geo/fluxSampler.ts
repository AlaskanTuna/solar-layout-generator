import type { GeoTIFFImage } from 'geotiff'

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
      // Test pixel CENTER (x + 0.5, y + 0.5), not corner
      if (pointInPolygon(x + 0.5, y + 0.5, corners)) {
        fluxValues.push(fluxData[y * width + x])
      }
    }
  }

  if (fluxValues.length === 0) return 0
  return fluxValues.reduce((sum, v) => sum + v, 0) / fluxValues.length
}

export async function computeMonthlyEnergy(
  image: GeoTIFFImage,
  corners: [number, number][],
  panelCapacityWatts: number
): Promise<number[]> {
  const width = image.getWidth()
  const height = image.getHeight()
  const monthlyEnergyDcKwh: number[] = []

  for (let band = 0; band < 12; band++) {
    // geotiff.js bands are 0-indexed (Jan=0, Dec=11)
    const rasters = await image.readRasters({ samples: [band] })
    const fluxData = rasters[0] as Float32Array
    const avgFlux = calculateAverageFlux(corners, fluxData, width, height)
    monthlyEnergyDcKwh.push(avgFlux * (panelCapacityWatts / 1000))
  }

  return monthlyEnergyDcKwh
}
