import { describe, expect, it } from 'vitest'
import {
  aabbsOverlap,
  createCanvasGeo,
  getRectAabb,
  getRotatedRectPoints,
  isPolygonInsideRasterMask,
  isAabbInsideStage,
  latLngToPixel,
  obbsOverlap,
  panelMetersToPixels,
  pixelToLatLng
} from '../canvasTransforms'

const imageGeoTransform = {
  originX: 0,
  originY: 1000,
  resX: 1,
  resY: -1,
  fromCRS: 'EPSG:4326',
  toCRS: 'EPSG:3857',
  imageWidth: 1000,
  imageHeight: 1000
}

describe('canvasTransforms', () => {
  it('round-trips latitude and longitude through canvas coordinates', () => {
    const geo = createCanvasGeo(imageGeoTransform, 1000, 1000)
    const original = { lat: 0.005, lng: 0.005 }

    const pixel = latLngToPixel(original.lat, original.lng, geo)
    const roundTrip = pixelToLatLng(pixel.x, pixel.y, geo)

    expect(roundTrip.lat).toBeCloseTo(original.lat, 8)
    expect(roundTrip.lng).toBeCloseTo(original.lng, 8)
  })

  it('converts panel dimensions to pixels and computes rotated bounds', () => {
    const geo = createCanvasGeo(imageGeoTransform, 1000, 1000)
    const size = panelMetersToPixels(1.134, 2.278, geo)

    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)

    const aabb = getRectAabb(getRotatedRectPoints(250, 150, size.width, size.height, 45))
    const neighbour = getRectAabb(getRotatedRectPoints(250.5, 150.5, size.width, size.height, 10))

    expect(aabb.minX).toBeLessThan(aabb.maxX)
    expect(aabbsOverlap(aabb, neighbour)).toBe(true)
    expect(isAabbInsideStage(aabb, 1000, 1000)).toBe(true)
    expect(isAabbInsideStage({ minX: -1, maxX: 10, minY: 0, maxY: 10 }, 1000, 1000)).toBe(false)
  })

  it('detects whether a rotated panel polygon stays inside the roof mask', () => {
    const mask = {
      width: 12,
      height: 12,
      pixels: Uint8Array.from({ length: 144 }, (_, index) => {
        const x = index % 12
        const y = Math.floor(index / 12)
        return x >= 2 && x <= 9 && y >= 2 && y <= 9 ? 1 : 0
      })
    }

    const inside = getRotatedRectPoints(6, 6, 4, 2, 25)
    const outside = getRotatedRectPoints(2.5, 2.5, 4, 2, 25)

    expect(isPolygonInsideRasterMask(inside, mask)).toBe(true)
    expect(isPolygonInsideRasterMask(outside, mask)).toBe(false)
  })

  describe('obbsOverlap (SAT)', () => {
    it('returns true for two axis-aligned panels that overlap', () => {
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(110, 100, 40, 20, 0)
      expect(obbsOverlap(a, b)).toBe(true)
    })

    it('returns false for two axis-aligned panels that are clearly separated', () => {
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(200, 100, 40, 20, 0)
      expect(obbsOverlap(a, b)).toBe(false)
    })

    it('returns false for two rotated panels whose AABBs overlap but shapes do not', () => {
      // Two 45°-rotated panels (width=80, height=6) with centers 50px apart along X.
      // Their diagonal AABBs overlap on both axes, but the actual rotated shapes
      // are offset perpendicular to the panel width axis and do not intersect.
      const a = getRotatedRectPoints(200, 200, 80, 6, 45)
      const b = getRotatedRectPoints(250, 200, 80, 6, 45)
      const aAabb = getRectAabb(a)
      const bAabb = getRectAabb(b)
      expect(aabbsOverlap(aAabb, bAabb)).toBe(true)
      expect(obbsOverlap(a, b)).toBe(false)
    })

    it('returns true for two rotated panels at different angles that genuinely intersect', () => {
      const a = getRotatedRectPoints(100, 100, 60, 20, 0)
      const b = getRotatedRectPoints(100, 100, 60, 20, 90)
      expect(obbsOverlap(a, b)).toBe(true)
    })

    it('returns false for panels touching edge-to-edge (no penetration)', () => {
      // Panels side by side with exactly zero gap — touching but not overlapping.
      // Using strict inequality in SAT (maxA > minB) so touching edges return false.
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(140, 100, 40, 20, 0)
      expect(obbsOverlap(a, b)).toBe(false)
    })
  })
})
