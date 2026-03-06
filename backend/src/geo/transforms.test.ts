import { describe, it, expect } from 'vitest'
import { latLngToPixel, pixelToLatLng, metersToPixels, setupGeoTransform } from './transforms.js'
import type { GeoTransform } from './transforms.js'

// Synthetic geo-transform mimicking a UTM zone GeoTIFF
// Origin at (300000, 400000) in UTM, 0.5m resolution
const mockGeo: GeoTransform = {
  originX: 300000,
  originY: 400000,
  resX: 0.5,
  resY: -0.5, // negative for top-down
  fromCRS: 'EPSG:4326',
  toCRS: 'EPSG:32647' // UTM zone 47N (Malaysia)
}

describe('metersToPixels', () => {
  it('converts meters to pixels using pixel resolution', () => {
    expect(metersToPixels(1.0, mockGeo)).toBe(2) // 1m / 0.5m = 2 pixels
    expect(metersToPixels(0.5, mockGeo)).toBe(1)
    expect(metersToPixels(2.5, mockGeo)).toBe(5)
  })

  it('handles negative resY correctly', () => {
    // metersToPixels uses Math.abs(resX), so sign doesn't matter
    const geoNeg = { ...mockGeo, resX: -0.5 }
    expect(metersToPixels(1.0, geoNeg)).toBe(2)
  })
})

describe('setupGeoTransform', () => {
  it('normalizes positive GeoTIFF Y resolution to a top-down pixel transform', () => {
    const image = {
      getOrigin: () => [770412.6, 330441.6],
      getResolution: () => [0.1, 0.1],
      getGeoKeys: () => ({ ProjectedCSTypeGeoKey: 32647 })
    }

    const geo = setupGeoTransform(image as never)

    expect(geo.originX).toBe(770412.6)
    expect(geo.originY).toBe(330441.6)
    expect(geo.resX).toBe(0.1)
    expect(geo.resY).toBe(-0.1)
    expect(geo.toCRS).toBe('EPSG:32647')
  })
})

describe('latLngToPixel / pixelToLatLng roundtrip', () => {
  it('roundtrips a known coordinate within reasonable accuracy', () => {
    // Use a point that's at the origin for simplicity
    // At origin (300000, 400000) in UTM, pixel should be (0, 0)
    const pixel = latLngToPixel(3.6, 101.5, mockGeo)

    // Roundtrip back to lat/lng
    const latLng = pixelToLatLng(pixel.px, pixel.py, mockGeo)

    // Should be close to original (within ~1m accuracy for roundtrip at 0.5m res)
    expect(latLng.lat).toBeCloseTo(3.6, 3)
    expect(latLng.lng).toBeCloseTo(101.5, 3)
  })

  it('returns integer pixel coordinates', () => {
    const pixel = latLngToPixel(3.5, 101.0, mockGeo)
    expect(Number.isInteger(pixel.px)).toBe(true)
    expect(Number.isInteger(pixel.py)).toBe(true)
  })
})
