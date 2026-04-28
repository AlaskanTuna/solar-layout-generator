import proj4 from 'proj4'
import type { LocationImageGeoTransform } from '@/api/locations'

/**
 * Defines the CanvasGeo type
 */
export type CanvasGeo = LocationImageGeoTransform & {
  displayWidth: number
  displayHeight: number
  scaleX: number
  scaleY: number
}

/**
 * Defines the PixelPoint type
 */
export type PixelPoint = {
  x: number
  y: number
}

/**
 * Defines the RectAabb type
 */
export type RectAabb = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Defines the RasterMask type
 */
export type RasterMask = {
  width: number
  height: number
  pixels: Uint8Array
}

/**
 * Defines the createCanvasGeo function
 * @param {LocationImageGeoTransform} imageGeoTransform - Value used for image geo transform
 * @param {number} displayWidth - Value used for display width
 * @param {number} displayHeight - Value used for display height
 * @returns {any} The resulting canvas geo value
 */
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

/**
 * Defines the latLngToPixel function
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @param {CanvasGeo} geo - Value used for geo
 * @returns {PixelPoint} The resulting lat lng to pixel value
 */
export function latLngToPixel(lat: number, lng: number, geo: CanvasGeo): PixelPoint {
  const [projX, projY] = proj4(geo.fromCRS, geo.toCRS, [lng, lat])
  const imageX = (projX - geo.originX) / geo.resX
  const imageY = (projY - geo.originY) / geo.resY

  return {
    x: imageX * geo.scaleX,
    y: imageY * geo.scaleY
  }
}

/**
 * Defines the pixelToLatLng function
 * @param {number} x - Value used for x
 * @param {number} y - Value used for y
 * @param {CanvasGeo} geo - Value used for geo
 * @returns {Object} The resulting structured value
 */
export function pixelToLatLng(x: number, y: number, geo: CanvasGeo): { lat: number; lng: number } {
  const imageX = x / geo.scaleX
  const imageY = y / geo.scaleY

  const projX = geo.originX + imageX * geo.resX
  const projY = geo.originY + imageY * geo.resY
  const [lng, lat] = proj4(geo.toCRS, geo.fromCRS, [projX, projY])

  return { lat, lng }
}

/**
 * Defines the panelMetersToPixels function
 * @param {number} panelWidthMeters - Value used for panel width meters
 * @param {number} panelHeightMeters - Value used for panel height meters
 * @param {CanvasGeo} geo - Value used for geo
 * @returns {Object} The resulting structured value
 */
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

/**
 * Computes the rotated rect points value
 * @param {number} centerX - Value used for center x
 * @param {number} centerY - Value used for center y
 * @param {number} width - Value used for width
 * @param {number} height - Value used for height
 * @param {number} rotationDeg - Value used for rotation deg
 * @returns {PixelPoint[]} The requested rotated rect points
 */
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

/**
 * Computes the rect aabb value
 * @param {PixelPoint[]} points - Collection of points values
 * @returns {RectAabb} The requested rect aabb
 */
export function getRectAabb(points: PixelPoint[]): RectAabb {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  }
}

/**
 * Defines the aabbsOverlap function
 * @param {RectAabb} a - Value used for a
 * @param {RectAabb} b - Value used for b
 */
export function aabbsOverlap(a: RectAabb, b: RectAabb): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

/** SAT overlap test for two convex polygons
 * Returns true only when the shapes actually intersect, with no AABB inflation false positives
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

/**
 * Defines the obbsOverlap function
 * @param {PixelPoint[]} polyA - Collection of poly a values
 * @param {PixelPoint[]} polyB - Collection of poly b values
 */
export function obbsOverlap(polyA: PixelPoint[], polyB: PixelPoint[]): boolean {
  const axes = [...getEdgeNormals(polyA), ...getEdgeNormals(polyB)]
  for (const axis of axes) {
    if (!satProjectionsOverlap(axis, polyA, polyB)) return false
  }
  return true
}

/**
 * Defines the MinSeparationResult type
 */
export type MinSeparationResult = {
  /** Signed penetration depth (positive = overlap, negative = gap) */
  penetration: number
  /** Unit axis along which penetration is minimised (points from B toward A) */
  axis: PixelPoint
}

/**
 * SAT overlap test that also returns the minimum-separation axis and penetration depth Returns null when the shapes are separated, otherwise returns the smallest push-out distance and axis
 * @param {PixelPoint[]} polyA - Collection of poly a values
 * @param {PixelPoint[]} polyB - Collection of poly b values
 * @returns {MinSeparationResult} The resulting obbs overlap with min separation value
 */
export function obbsOverlapWithMinSeparation(polyA: PixelPoint[], polyB: PixelPoint[]): MinSeparationResult | null {
  const axes = [...getEdgeNormals(polyA), ...getEdgeNormals(polyB)]
  let minPenetration = Infinity
  let minAxis: PixelPoint = { x: 1, y: 0 }

  for (const axis of axes) {
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

    // SAT: gap on this axis means shapes are separated
    if (maxA <= minB || maxB <= minA) return null

    // Overlap amount on this axis
    const overlap = Math.min(maxA - minB, maxB - minA)
    if (overlap < minPenetration) {
      minPenetration = overlap
      // Orient axis so it pushes A away from B (A center > B center on axis)
      const aCentre = (minA + maxA) / 2
      const bCentre = (minB + maxB) / 2
      minAxis = aCentre >= bCentre ? axis : { x: -axis.x, y: -axis.y }
    }
  }

  return { penetration: minPenetration, axis: minAxis }
}

/**
 * Defines the isAabbInsideStage function
 * @param {RectAabb} aabb - Value used for aabb
 * @param {number} stageWidth - Value used for stage width
 * @param {number} stageHeight - Value used for stage height
 */
export function isAabbInsideStage(aabb: RectAabb, stageWidth: number, stageHeight: number): boolean {
  return aabb.minX >= 0 && aabb.maxX <= stageWidth && aabb.minY >= 0 && aabb.maxY <= stageHeight
}

/**
 * Defines the pointInPolygon function
 * @param {number} x - Value used for x
 * @param {number} y - Value used for y
 * @param {PixelPoint[]} polygon - Collection of polygon values
 */
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

/**
 * Defines the isPolygonInsideRasterMask function
 * @param {PixelPoint[]} polygon - Collection of polygon values
 * @param {RasterMask} mask - Value used for mask
 */
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
