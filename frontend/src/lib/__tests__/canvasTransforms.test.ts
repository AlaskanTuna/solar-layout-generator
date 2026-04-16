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
  obbsOverlapWithMinSeparation,
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

  describe('obbsOverlapWithMinSeparation', () => {
    it('returns null when panels are clearly separated', () => {
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(200, 100, 40, 20, 0)
      expect(obbsOverlapWithMinSeparation(a, b)).toBeNull()
    })

    it('returns null for touching edge-to-edge panels (zero penetration uses strict inequality)', () => {
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(140, 100, 40, 20, 0)
      expect(obbsOverlapWithMinSeparation(a, b)).toBeNull()
    })

    it('returns penetration depth and axis for a small axis-aligned overlap', () => {
      // Panel A center at (100,100), panel B center at (135,100): 5px penetration on X axis
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(135, 100, 40, 20, 0)
      const result = obbsOverlapWithMinSeparation(a, b)
      expect(result).not.toBeNull()
      expect(result!.penetration).toBeCloseTo(5, 4)
      // Axis should be roughly horizontal (x≈±1, y≈0)
      expect(Math.abs(result!.axis.x)).toBeCloseTo(1, 4)
      expect(Math.abs(result!.axis.y)).toBeCloseTo(0, 4)
    })

    it('axis points from B toward A (pushes A away from B)', () => {
      // A is to the left of B; axis.x should be negative (push A further left)
      const a = getRotatedRectPoints(100, 100, 40, 20, 0)
      const b = getRotatedRectPoints(135, 100, 40, 20, 0)
      const result = obbsOverlapWithMinSeparation(a, b)
      expect(result).not.toBeNull()
      expect(result!.axis.x).toBeLessThan(0)
    })

    it('correcting position by penetration * axis lands panels exactly edge-to-edge', () => {
      const W = 40
      const H = 20
      // 5px penetration: A at (100,100), B at (135,100)
      const penetration = 5
      const aX = 100
      const bX = 135
      const a = getRotatedRectPoints(aX, 100, W, H, 0)
      const b = getRotatedRectPoints(bX, 100, W, H, 0)
      const result = obbsOverlapWithMinSeparation(a, b)!
      const correctedX = aX + result.axis.x * result.penetration
      // After correction A center should be at 100 - 5 = 95, distance to B = 40 = W (edge-to-edge)
      expect(Math.abs(correctedX - bX)).toBeCloseTo(W, 4)
      // Corrected A must not overlap B
      const aCorrected = getRotatedRectPoints(correctedX, 100, W, H, 0)
      expect(obbsOverlap(aCorrected, b)).toBe(false)
    })

    it('returns penetration for a small overlap between same-rotation rotated panels', () => {
      const DEG = 30
      const RAD = (DEG * Math.PI) / 180
      const W = 40
      const H = 20
      // Place B at (200,200), A at exact edge-to-edge minus 4px overlap along local U
      const exactX = 200 - W * Math.cos(RAD)
      const exactY = 200 - W * Math.sin(RAD)
      const aOverlapX = exactX + 4 * Math.cos(RAD)
      const aOverlapY = exactY + 4 * Math.sin(RAD)
      const a = getRotatedRectPoints(aOverlapX, aOverlapY, W, H, DEG)
      const b = getRotatedRectPoints(200, 200, W, H, DEG)
      const result = obbsOverlapWithMinSeparation(a, b)
      expect(result).not.toBeNull()
      expect(result!.penetration).toBeCloseTo(4, 1)
    })
  })
})
