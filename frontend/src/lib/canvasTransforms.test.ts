import { describe, expect, it } from 'vitest'
import {
  aabbsOverlap,
  createCanvasGeo,
  getRectAabb,
  getRotatedRectPoints,
  isAabbInsideStage,
  latLngToPixel,
  panelMetersToPixels,
  pixelToLatLng
} from './canvasTransforms'

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
})
