/**
 * GeoTIFF coordinate transform utilities.
 *
 * The Google Solar API serves flux, DSM, and mask data as GeoTIFFs in a
 * projected CRS (UTM, WebMercator, etc., depending on location). Panel
 * positions in our database are stored as WGS84 lat/lng. This module bridges
 * those two coordinate systems so we can sample raster pixels under a panel
 * polygon.
 *
 * Pipeline:
 *   1. `setupGeoTransform` extracts the origin, resolution, and target CRS
 *      from a loaded GeoTIFF image.
 *   2. `latLngToPixel` / `pixelToLatLng` round-trip between WGS84 and pixel
 *      indices via proj4.
 *   3. `metersToPixels` converts panel dimensions (in metres) to pixel sizes
 *      using the GeoTIFF's spatial resolution.
 */

import proj4 from 'proj4'
import type { GeoTIFFImage } from 'geotiff'

/**
 * Parameters needed to convert between WGS84 lat/lng and GeoTIFF pixel space.
 */
export interface GeoTransform {
  /** Easting of the top-left pixel origin, in the target CRS */
  originX: number
  /** Northing of the top-left pixel origin, in the target CRS */
  originY: number
  /** Horizontal pixel size in the target CRS units (metres for UTM) */
  resX: number
  /** Vertical pixel size; always negative so increasing pixel-Y goes south */
  resY: number
  /** Source CRS for `latLngToPixel`; always WGS84 */
  fromCRS: string
  /** Target CRS read from the GeoTIFF's `ProjectedCSTypeGeoKey` */
  toCRS: string
}

/**
 * Builds a `GeoTransform` from a loaded GeoTIFF image.
 *
 * `geotiff.js` occasionally reports a positive vertical resolution depending on
 * how the file was produced; we normalise it to negative so the convention
 * "row index grows southwards" holds regardless of source.
 *
 * @param image - A GeoTIFF image loaded by `geotiff.js`
 * @returns Transform parameters ready for the pixel conversion helpers
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
 * Converts a WGS84 lat/lng to integer pixel coordinates on the GeoTIFF raster.
 *
 * Projects through the GeoTIFF's native CRS first (via proj4), then maps the
 * projected easting/northing offset from the origin to pixel indices using the
 * raster resolution. Results are rounded to the nearest pixel.
 *
 * @param lat - Latitude in degrees (WGS84)
 * @param lng - Longitude in degrees (WGS84)
 * @param geo - Transform parameters from `setupGeoTransform`
 * @returns `{ px, py }` pixel indices, row-major, top-left origin
 */
export function latLngToPixel(lat: number, lng: number, geo: GeoTransform): { px: number; py: number } {
  // proj4 expects [lng, lat] order
  const [projX, projY] = proj4(geo.fromCRS, geo.toCRS, [lng, lat])
  const px = Math.round((projX - geo.originX) / geo.resX)
  const py = Math.round((projY - geo.originY) / geo.resY)
  return { px, py }
}

/**
 * Inverse of `latLngToPixel`: given pixel indices, recover the WGS84 lat/lng
 * of that pixel's top-left corner.
 *
 * @param px - Pixel column index
 * @param py - Pixel row index
 * @param geo - Transform parameters from `setupGeoTransform`
 * @returns `{ lat, lng }` in degrees (WGS84)
 */
export function pixelToLatLng(px: number, py: number, geo: GeoTransform): { lat: number; lng: number } {
  const projX = geo.originX + px * geo.resX
  const projY = geo.originY + py * geo.resY
  const [lng, lat] = proj4(geo.toCRS, geo.fromCRS, [projX, projY])
  return { lat, lng }
}

/**
 * Converts a length in metres to a length in raster pixels.
 *
 * Uses `Math.abs(resX)` so a negative resolution does not flip the sign of the
 * result; both axes share the same metre-per-pixel scale in practice for the
 * projected CRSs Google's Solar API uses.
 *
 * @param meters - Length in metres
 * @param geo - Transform parameters from `setupGeoTransform`
 * @returns Length in raster pixels
 */
export function metersToPixels(meters: number, geo: GeoTransform): number {
  return meters / Math.abs(geo.resX)
}
