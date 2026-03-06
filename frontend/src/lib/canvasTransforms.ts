import proj4 from 'proj4'
import type { LocationImageGeoTransform } from '@/api/locations'

export type CanvasGeo = LocationImageGeoTransform & {
  displayWidth: number
  displayHeight: number
  scaleX: number
  scaleY: number
}

export type PixelPoint = {
  x: number
  y: number
}

export type RectAabb = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function createCanvasGeo(
  imageGeoTransform: LocationImageGeoTransform,
  displayWidth: number,
  displayHeight: number
): CanvasGeo {
  return {
    ...imageGeoTransform,
    displayWidth,
    displayHeight,
    scaleX: displayWidth / imageGeoTransform.imageWidth,
    scaleY: displayHeight / imageGeoTransform.imageHeight
  }
}

export function latLngToPixel(lat: number, lng: number, geo: CanvasGeo): PixelPoint {
  const [projX, projY] = proj4(geo.fromCRS, geo.toCRS, [lng, lat])
  const imageX = (projX - geo.originX) / geo.resX
  const imageY = (projY - geo.originY) / geo.resY

  return {
    x: imageX * geo.scaleX,
    y: imageY * geo.scaleY
  }
}

export function pixelToLatLng(x: number, y: number, geo: CanvasGeo): { lat: number; lng: number } {
  const imageX = x / geo.scaleX
  const imageY = y / geo.scaleY

  const projX = geo.originX + imageX * geo.resX
  const projY = geo.originY + imageY * geo.resY
  const [lng, lat] = proj4(geo.toCRS, geo.fromCRS, [projX, projY])

  return { lat, lng }
}

export function panelMetersToPixels(
  panelWidthMeters: number,
  panelHeightMeters: number,
  geo: CanvasGeo
): { width: number; height: number } {
  return {
    width: (panelWidthMeters / Math.abs(geo.resX)) * geo.scaleX,
    height: (panelHeightMeters / Math.abs(geo.resY)) * geo.scaleY
  }
}

export function getRotatedRectPoints(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationDeg: number
): PixelPoint[] {
  const rotationRad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rotationRad)
  const sin = Math.sin(rotationRad)
  const halfWidth = width / 2
  const halfHeight = height / 2

  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ]

  return corners.map(({ x, y }) => ({
    x: centerX + cos * x - sin * y,
    y: centerY + sin * x + cos * y
  }))
}

export function getRectAabb(points: PixelPoint[]): RectAabb {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  }
}

export function aabbsOverlap(a: RectAabb, b: RectAabb): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

export function isAabbInsideStage(aabb: RectAabb, stageWidth: number, stageHeight: number): boolean {
  return aabb.minX >= 0 && aabb.maxX <= stageWidth && aabb.minY >= 0 && aabb.maxY <= stageHeight
}
