import proj4 from 'proj4'
import type { GeoTIFFImage } from 'geotiff'

/**
 * GeoTIFF transform parameters used for pixel math
 */
export interface GeoTransform {
  originX: number
  originY: number
  resX: number
  resY: number
  fromCRS: string
  toCRS: string
}

/**
 * Derive a transform from a GeoTIFF image
 * @param {GeoTIFFImage} image - Value used for image
 * @returns {GeoTransform} The resulting setup geo transform value
 */
export function setupGeoTransform(image: GeoTIFFImage): GeoTransform {
  const [originX, originY] = image.getOrigin()
  const [rawResX, rawResY] = image.getResolution()
  const geoKeys = image.getGeoKeys()
  const epsgCode = geoKeys.ProjectedCSTypeGeoKey

  return {
    originX,
    originY,
    resX: rawResX,
    // geotiff.js may report positive Y resolution; flip to negative for downward rows
    resY: rawResY > 0 ? -rawResY : rawResY,
    fromCRS: 'EPSG:4326',
    toCRS: `EPSG:${epsgCode}`
  }
}

/**
 * Converts lat/lng to GeoTIFF pixel coordinates
 * @param {number} lat - Value used for lat
 * @param {number} lng - Value used for lng
 * @param {GeoTransform} geo - Value used for geo
 * @returns {Object} The resulting structured value
 */
export function latLngToPixel(lat: number, lng: number, geo: GeoTransform): { px: number; py: number } {
  // proj4 expects [lng, lat] order
  const [projX, projY] = proj4(geo.fromCRS, geo.toCRS, [lng, lat])
  const px = Math.round((projX - geo.originX) / geo.resX)
  const py = Math.round((projY - geo.originY) / geo.resY)
  return { px, py }
}

/**
 * Converts GeoTIFF pixel coordinates to lat/lng
 * @param {number} px - Value used for px
 * @param {number} py - Value used for py
 * @param {GeoTransform} geo - Value used for geo
 * @returns {Object} The resulting structured value
 */
export function pixelToLatLng(px: number, py: number, geo: GeoTransform): { lat: number; lng: number } {
  const projX = geo.originX + px * geo.resX
  const projY = geo.originY + py * geo.resY
  const [lng, lat] = proj4(geo.toCRS, geo.fromCRS, [projX, projY])
  return { lat, lng }
}

/**
 * Converts meters to pixels using the GeoTIFF resolution
 * @param {number} meters - Value used for meters
 * @param {GeoTransform} geo - Value used for geo
 * @returns {number} The resulting meters to pixels value
 */
export function metersToPixels(meters: number, geo: GeoTransform): number {
  return meters / Math.abs(geo.resX)
}
