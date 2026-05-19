/**
 * Flux sampling utilities for computing solar DC energy from Google Solar API
 * monthly flux GeoTIFFs.
 *
 * A flux GeoTIFF has 12 bands (one per month) where each pixel value is the
 * average DC irradiance in kWh/kW/year for that month. To estimate the energy
 * produced by a panel, we average the flux values over the pixels that fall
 * inside the panel's rotated rectangle and multiply by the panel capacity in kW.
 *
 * Workflow:
 *   1. Project the panel's lat/lng corners into GeoTIFF pixel space (see
 *      `geo/transforms.ts`).
 *   2. Sample pixels inside that polygon (`calculateAverageFlux`).
 *   3. Repeat across all 12 monthly bands (`computeMonthlyEnergy`).
 *
 * For batch updates (multiple panels on the same location), prefer
 * `preloadFluxRasters` + `computeMonthlyEnergyFromRasters` to avoid reading the
 * GeoTIFF bands once per panel.
 */

import type { GeoTIFFImage } from 'geotiff'

/**
 * Tests whether a 2D point lies inside a polygon using the ray-casting algorithm.
 *
 * Casts a horizontal ray from the point and toggles `inside` on every edge
 * crossing — an odd total means the point is inside, even means outside. The
 * `y > min && y <= max` half-open interval handles ray-on-vertex degeneracies
 * by counting each vertex exactly once.
 *
 * @param x - X coordinate of the test point in pixel space
 * @param y - Y coordinate of the test point in pixel space
 * @param polygon - Polygon vertices as `[x, y]` pairs, in any winding order
 * @returns `true` if the point lies inside the polygon
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
 * Computes the mean flux value across all pixels whose centres fall inside the
 * panel polygon.
 *
 * The polygon is iterated only over its axis-aligned bounding box, clamped to
 * the raster extents so we never read out of bounds. Each candidate pixel is
 * tested at its centre (`x + 0.5`, `y + 0.5`) rather than its corner — this
 * avoids the off-by-one bias of corner-testing where a pixel can be "in" by an
 * edge it doesn't actually overlap.
 *
 * @param corners - Panel polygon corners in pixel space
 * @param fluxData - Flat raster of flux values, row-major, length `width * height`
 * @param width - Raster width in pixels
 * @param height - Raster height in pixels
 * @returns Average flux over the panel footprint, or 0 if the panel falls
 *   entirely outside the raster
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

  // Clamp the bounding box to the raster so out-of-bounds panels never sample
  // garbage memory; a panel partially off the GeoTIFF will still average the
  // pixels that remain visible.
  minX = Math.max(0, minX)
  maxX = Math.min(width - 1, maxX)
  minY = Math.max(0, minY)
  maxY = Math.min(height - 1, maxY)

  const fluxValues: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Test pixel centre, not corner, to avoid edge-inclusion bias
      if (pointInPolygon(x + 0.5, y + 0.5, corners)) {
        fluxValues.push(fluxData[y * width + x])
      }
    }
  }

  if (fluxValues.length === 0) return 0
  return fluxValues.reduce((sum, v) => sum + v, 0) / fluxValues.length
}

/**
 * Computes monthly DC energy for a panel by sampling all 12 bands of a flux
 * GeoTIFF.
 *
 * Reads each monthly band on demand. Suitable for single-panel recompute; for
 * batched recomputes use `preloadFluxRasters` + `computeMonthlyEnergyFromRasters`.
 *
 * @param image - The flux GeoTIFF image (12 bands, kWh/kW/year per pixel)
 * @param corners - Panel polygon corners in pixel space
 * @param panelCapacityWatts - Panel nameplate DC capacity in watts
 * @returns 12-element array of monthly DC energy in kWh, index 0 = January
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
    // avgFlux is kWh/kW/year-equivalent for the band; multiply by capacity in kW
    monthlyEnergyDcKwh.push(avgFlux * (panelCapacityWatts / 1000))
  }

  return monthlyEnergyDcKwh
}

/**
 * Cached flux raster bands kept in memory for repeated sampling.
 *
 * Used by batch flux recompute (one fetch, many panels) to avoid the cost of
 * re-decoding each monthly band per panel.
 */
export interface PreloadedFluxRasters {
  /** 12-element array of monthly flux rasters; index 0 = January */
  bands: ArrayLike<number>[]
  /** Raster width in pixels (shared across bands) */
  width: number
  /** Raster height in pixels (shared across bands) */
  height: number
}

/**
 * Reads all 12 monthly flux bands of a GeoTIFF into memory.
 *
 * Call once per location before recomputing many panels in a batch. The
 * returned struct can be reused across any number of `computeMonthlyEnergyFromRasters`
 * calls without further GeoTIFF I/O.
 *
 * @param image - The flux GeoTIFF image (12 bands)
 * @returns Preloaded monthly rasters plus shared dimensions
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
 * Synchronous variant of `computeMonthlyEnergy` that samples from preloaded
 * rasters instead of reading the GeoTIFF on the fly.
 *
 * @param rasters - Result of `preloadFluxRasters` for the same location
 * @param corners - Panel polygon corners in pixel space
 * @param panelCapacityWatts - Panel nameplate DC capacity in watts
 * @returns 12-element array of monthly DC energy in kWh, index 0 = January
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
