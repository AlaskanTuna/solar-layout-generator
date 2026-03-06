import proj4 from 'proj4'
import type { GeoTIFFImage } from 'geotiff'

export interface GeoTransform {
  originX: number
  originY: number
  resX: number
  resY: number
  fromCRS: string
  toCRS: string
}

export function setupGeoTransform(image: GeoTIFFImage): GeoTransform {
  const [originX, originY] = image.getOrigin()
  const [rawResX, rawResY] = image.getResolution()
  const geoKeys = image.getGeoKeys()
  const epsgCode = geoKeys.ProjectedCSTypeGeoKey

  return {
    originX,
    originY,
    resX: rawResX,
    // geotiff.js may report a positive Y resolution even though pixel rows grow downward.
    resY: rawResY > 0 ? -rawResY : rawResY,
    fromCRS: 'EPSG:4326',
    toCRS: `EPSG:${epsgCode}`
  }
}

export function latLngToPixel(lat: number, lng: number, geo: GeoTransform): { px: number; py: number } {
  // proj4 uses [lng, lat] order
  const [projX, projY] = proj4(geo.fromCRS, geo.toCRS, [lng, lat])
  const px = Math.round((projX - geo.originX) / geo.resX)
  const py = Math.round((projY - geo.originY) / geo.resY)
  return { px, py }
}

export function pixelToLatLng(px: number, py: number, geo: GeoTransform): { lat: number; lng: number } {
  const projX = geo.originX + px * geo.resX
  const projY = geo.originY + py * geo.resY
  const [lng, lat] = proj4(geo.toCRS, geo.fromCRS, [projX, projY])
  return { lat, lng }
}

export function metersToPixels(meters: number, geo: GeoTransform): number {
  return meters / Math.abs(geo.resX)
}
