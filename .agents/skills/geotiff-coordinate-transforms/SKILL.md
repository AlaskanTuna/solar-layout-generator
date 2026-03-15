---
name: geotiff-coordinate-transforms
description: Port coordinate transform logic from the validated Python prototype to TypeScript using proj4 and geotiff.js. Covers lat/lng ↔ GeoTIFF pixel conversion, panel dimension conversion, and rotation math.
---

# GeoTIFF Coordinate Transforms

## When to Use

Use this skill when implementing or modifying:

- `POST /api/locations/:locationId/panels/recompute` (flux sampling endpoint)
- Any backend code that converts between lat/lng and GeoTIFF pixel coordinates
- Panel rendering coordinate conversion on the frontend (Page 2)
- Panel footprint rotation calculations

## Validated Python Reference

The following Python code from the prototype (`layout_compiler.py` + `debug_layout.py`) has been validated to produce <1% error against Google's pre-computed values.

### 1. Coordinate Transform Setup

**Python (rasterio + pyproj):**

```python
import rasterio
import pyproj

with rasterio.open(ref_tif_path) as src:
    transform = src.transform   # Affine geo-transform
    tif_crs = src.crs           # CRS embedded in the GeoTIFF

# Create transformer: WGS84 (lat/lng) → GeoTIFF CRS (typically UTM)
transformer = pyproj.Transformer.from_crs("EPSG:4326", tif_crs, always_xy=True)
```

**TypeScript equivalent (geotiff.js + proj4):**

```typescript
import GeoTIFF from 'geotiff'
import proj4 from 'proj4'

const tiff = await GeoTIFF.fromArrayBuffer(buffer)
const image = await tiff.getImage()
const bbox = image.getBoundingBox() // [xmin, ymin, xmax, ymax] in CRS units
const [width, height] = [image.getWidth(), image.getHeight()]
const geoKeys = image.getGeoKeys() // Contains ProjectedCSTypeGeoKey

// Build the geo-transform from image metadata
const [originX, originY] = image.getOrigin() // top-left corner in CRS
const [resX, resY] = image.getResolution() // pixel size in CRS units (resY is negative)

// Define the CRS. GeoKeys.ProjectedCSTypeGeoKey gives the EPSG code.
const epsgCode = geoKeys.ProjectedCSTypeGeoKey // e.g. 32647 for UTM zone 47N
const fromCRS = 'EPSG:4326'
const toCRS = `EPSG:${epsgCode}`
```

> **CRITICAL:** `proj4` must have the CRS definition registered. For UTM zones, proj4 has them built-in. For non-standard CRS, you may need to fetch the definition from epsg.io: `proj4.defs('EPSG:XXXXX', '+proj=...')`.

### 2. Lat/Lng → Pixel Coordinates

**Python:**

```python
# Transform lon/lat to CRS coordinates
projected_x, projected_y = transformer.transform(center_lon, center_lat)
# Convert CRS coordinates to pixel row/col
row, col = rasterio.transform.rowcol(transform, projected_x, projected_y)
px, py = col, row  # (x, y) for pixel operations
```

**TypeScript equivalent:**

```typescript
function latLngToPixel(lat: number, lng: number): { px: number; py: number } {
  // proj4 expects [lng, lat] order (always_xy=True equivalent)
  const [projX, projY] = proj4(fromCRS, toCRS, [lng, lat])

  // Convert projected coordinates to pixel coordinates using geo-transform
  // Equivalent to rasterio.transform.rowcol()
  const px = Math.round((projX - originX) / resX) // column
  const py = Math.round((projY - originY) / resY) // row (resY is negative, so this works)

  return { px, py }
}
```

### 3. Pixel → Lat/Lng (Inverse)

**TypeScript:**

```typescript
function pixelToLatLng(px: number, py: number): { lat: number; lng: number } {
  // Pixel to CRS
  const projX = originX + px * resX
  const projY = originY + py * resY

  // CRS to WGS84
  const [lng, lat] = proj4(toCRS, fromCRS, [projX, projY])
  return { lat, lng }
}
```

### 4. Panel Dimension Conversion (Meters → Pixels)

**Python:**

```python
pixel_width_m = transform.a                    # Pixel size in meters (from geo-transform)
panel_w_px = panel_w_m / pixel_width_m         # Panel width in pixels
panel_h_px = panel_h_m / pixel_width_m         # Panel height in pixels
```

**TypeScript equivalent:**

```typescript
// resX from image.getResolution() gives pixel size in CRS units (meters for UTM)
const pixelSizeMeters = Math.abs(resX)
const panelWidthPx = panelWidthMeters / pixelSizeMeters
const panelHeightPx = panelHeightMeters / pixelSizeMeters
```

> **NOTE:** `panelWidthMeters` and `panelHeightMeters` come from `buildingInsights.solarPotential.panelWidthMeters` and `panelHeightMeters`. These are stored in the Location's `buildingInsightsJson`.

### 5. Panel Rotation

**Python:**

```python
def rotate_point(origin, point, angle_rad):
    ox, oy = origin; px, py = point
    qx = ox + math.cos(angle_rad) * (px - ox) - math.sin(angle_rad) * (py - oy)
    qy = oy + math.sin(angle_rad) * (px - ox) + math.cos(angle_rad) * (py - oy)
    return qx, qy

# Panel rotation from Solar API data:
orientation_angle = 90 if panel.orientation == "PORTRAIT" else 0
azimuth_angle = segments[panel.segmentIndex].azimuthDegrees
total_rotation_rad = math.radians(90 - (azimuth_angle + orientation_angle))

# Compute rotated corners in pixel space
w_half, h_half = panel_w_px / 2, panel_h_px / 2
corners = [(-w_half, -h_half), (w_half, -h_half), (w_half, h_half), (-w_half, h_half)]
rotated_corners = [rotate_point((px, py), (px + x, py + y), total_rotation_rad) for x, y in corners]
```

**TypeScript equivalent:**

```typescript
function rotatePoint(origin: [number, number], point: [number, number], angleRad: number): [number, number] {
  const [ox, oy] = origin
  const [px, py] = point
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return [ox + cos * (px - ox) - sin * (py - oy), oy + sin * (px - ox) + cos * (py - oy)]
}

function getPanelCorners(
  cx: number,
  cy: number,
  widthPx: number,
  heightPx: number,
  rotationRad: number
): [number, number][] {
  const wHalf = widthPx / 2
  const hHalf = heightPx / 2
  const corners: [number, number][] = [
    [-wHalf, -hHalf],
    [wHalf, -hHalf],
    [wHalf, hHalf],
    [-wHalf, hHalf]
  ]
  return corners.map(([dx, dy]) => rotatePoint([cx, cy], [cx + dx, cy + dy], rotationRad))
}
```

## Common Pitfalls

1. **proj4 argument order:** `proj4(from, to, [lng, lat])` — longitude first, latitude second.
2. **resY is negative:** GeoTIFF origin is top-left; Y increases downward in pixel space but upward in CRS space.
3. **Rotation sign:** For the initial layout rendering (using Solar API data), the rotation formula uses `90 - (azimuth + orientation)`. When the user manually rotates a panel on the workbench, the frontend sends the absolute rotation angle directly.
4. **geotiff.js band indexing:** Bands are 0-indexed in geotiff.js (`image.readRasters({ samples: [0] })`), unlike rasterio which is 1-indexed (`src.read(1)`).
