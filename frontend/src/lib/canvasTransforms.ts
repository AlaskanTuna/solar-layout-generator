import type { BoundingBox } from './buildingInsights'

export type CanvasGeo = {
  boundingBox: BoundingBox
  width: number
  height: number
  widthMeters: number
  heightMeters: number
  metersPerPixelX: number
  metersPerPixelY: number
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

const EARTH_RADIUS_METERS = 6371000

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dPhi = ((lat2 - lat1) * Math.PI) / 180
  const dLambda = ((lng2 - lng1) * Math.PI) / 180

  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function createCanvasGeo(boundingBox: BoundingBox, width: number, height: number): CanvasGeo {
  const widthMeters = haversineDistance(
    boundingBox.sw.latitude,
    boundingBox.sw.longitude,
    boundingBox.sw.latitude,
    boundingBox.ne.longitude
  )
  const heightMeters = haversineDistance(
    boundingBox.sw.latitude,
    boundingBox.sw.longitude,
    boundingBox.ne.latitude,
    boundingBox.sw.longitude
  )

  return {
    boundingBox,
    width,
    height,
    widthMeters,
    heightMeters,
    metersPerPixelX: widthMeters / width,
    metersPerPixelY: heightMeters / height
  }
}

export function latLngToPixel(lat: number, lng: number, geo: CanvasGeo): PixelPoint {
  const latRange = geo.boundingBox.ne.latitude - geo.boundingBox.sw.latitude
  const lngRange = geo.boundingBox.ne.longitude - geo.boundingBox.sw.longitude

  const xRatio = lngRange === 0 ? 0 : (lng - geo.boundingBox.sw.longitude) / lngRange
  const yRatio = latRange === 0 ? 0 : (geo.boundingBox.ne.latitude - lat) / latRange

  return {
    x: xRatio * geo.width,
    y: yRatio * geo.height
  }
}

export function pixelToLatLng(x: number, y: number, geo: CanvasGeo): { lat: number; lng: number } {
  const lng =
    geo.boundingBox.sw.longitude +
    (x / geo.width) * (geo.boundingBox.ne.longitude - geo.boundingBox.sw.longitude)

  const lat =
    geo.boundingBox.ne.latitude -
    (y / geo.height) * (geo.boundingBox.ne.latitude - geo.boundingBox.sw.latitude)

  return { lat, lng }
}

export function panelMetersToPixels(
  panelWidthMeters: number,
  panelHeightMeters: number,
  geo: CanvasGeo
): { width: number; height: number } {
  return {
    width: panelWidthMeters / geo.metersPerPixelX,
    height: panelHeightMeters / geo.metersPerPixelY
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
