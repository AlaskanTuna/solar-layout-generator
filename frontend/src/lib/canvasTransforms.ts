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

export type RasterMask = {
  width: number
  height: number
  pixels: Uint8Array
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

/**
 * SAT (Separating Axis Theorem) overlap test for two convex polygons.
 * Returns true only when the shapes actually intersect — no false positives from AABB inflation.
 */
function satProjectionsOverlap(axis: PixelPoint, polyA: PixelPoint[], polyB: PixelPoint[]): boolean {
  let minA = Infinity
  let maxA = -Infinity
  for (const p of polyA) {
    const proj = p.x * axis.x + p.y * axis.y
    if (proj < minA) minA = proj
    if (proj > maxA) maxA = proj
  }
  let minB = Infinity
  let maxB = -Infinity
  for (const p of polyB) {
    const proj = p.x * axis.x + p.y * axis.y
    if (proj < minB) minB = proj
    if (proj > maxB) maxB = proj
  }
  return maxA > minB && maxB > minA
}

function getEdgeNormals(poly: PixelPoint[]): PixelPoint[] {
  const normals: PixelPoint[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const edgeX = b.x - a.x
    const edgeY = b.y - a.y
    const len = Math.hypot(edgeX, edgeY) || 1
    normals.push({ x: -edgeY / len, y: edgeX / len })
  }
  return normals
}

export function obbsOverlap(polyA: PixelPoint[], polyB: PixelPoint[]): boolean {
  const axes = [...getEdgeNormals(polyA), ...getEdgeNormals(polyB)]
  for (const axis of axes) {
    if (!satProjectionsOverlap(axis, polyA, polyB)) return false
  }
  return true
}

export function isAabbInsideStage(aabb: RectAabb, stageWidth: number, stageHeight: number): boolean {
  return aabb.minX >= 0 && aabb.maxX <= stageWidth && aabb.minY >= 0 && aabb.maxY <= stageHeight
}

export function pointInPolygon(x: number, y: number, polygon: PixelPoint[]): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]?.x ?? 0
    const yi = polygon[i]?.y ?? 0
    const xj = polygon[j]?.x ?? 0
    const yj = polygon[j]?.y ?? 0
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

export function isPolygonInsideRasterMask(polygon: PixelPoint[], mask: RasterMask): boolean {
  if (polygon.length < 3 || mask.pixels.length !== mask.width * mask.height) {
    return false
  }

  const aabb = getRectAabb(polygon)

  if (aabb.minX < 0 || aabb.maxX > mask.width || aabb.minY < 0 || aabb.maxY > mask.height) {
    return false
  }

  const minX = Math.max(0, Math.floor(aabb.minX))
  const maxX = Math.min(mask.width - 1, Math.ceil(aabb.maxX))
  const minY = Math.max(0, Math.floor(aabb.minY))
  const maxY = Math.min(mask.height - 1, Math.ceil(aabb.maxY))
  let sampledPixels = 0

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const sampleX = x + 0.5
      const sampleY = y + 0.5

      if (!pointInPolygon(sampleX, sampleY, polygon)) {
        continue
      }

      sampledPixels += 1

      if (mask.pixels[y * mask.width + x] === 0) {
        return false
      }
    }
  }

  return sampledPixels > 0
}
