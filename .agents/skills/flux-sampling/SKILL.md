---
name: flux-sampling
description: Port the flux sampling pipeline from the validated Python prototype to TypeScript using geotiff.js. Covers point-in-polygon testing, area-average flux computation, and monthly kWh calculation for moved/rotated panels.
---

# Flux Sampling Pipeline

## When to Use

Use this skill when implementing or modifying:

- `POST /api/locations/:locationId/panels/recompute` endpoint
- The flux sampler service (`backend/src/services/`)
- Any code that reads monthly flux GeoTIFF bands and computes per-panel energy

## Architecture Context

When a user moves or rotates a panel on the workbench (Page 2), the frontend sends:

```json
{ "panelId": "panel_0", "center": { "lat": 3.123, "lng": 101.456 }, "rotation": 45 }
```

The backend must:

1. Convert lat/lng to GeoTIFF pixel coordinates (see `geotiff-coordinate-transforms` skill)
2. Compute the rotated panel footprint (4 corners in pixel space)
3. Sample all 12 bands of `monthly_flux.tif` within that footprint
4. Return `monthlyEnergyDcKwh[12]`

## Validated Python Reference

### 1. Point-in-Polygon (Ray Casting)

**Python (`panel_flux_aggregator.py`):**

```python
def point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside
```

**TypeScript equivalent:**

```typescript
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  const n = polygon.length
  let inside = false
  let [p1x, p1y] = polygon[0]

  for (let i = 1; i <= n; i++) {
    const [p2x, p2y] = polygon[i % n]
    if (y > Math.min(p1y, p2y) && y <= Math.max(p1y, p2y)) {
      if (x <= Math.max(p1x, p2x)) {
        let xinters = p1x
        if (p1y !== p2y) {
          xinters = ((y - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x
        }
        if (p1x === p2x || x <= xinters) {
          inside = !inside
        }
      }
    }
    ;[p1x, p1y] = [p2x, p2y]
  }
  return inside
}
```

### 2. Area-Average Flux Calculation

**Python (`panel_flux_aggregator.py`):**

```python
def calculate_average_flux_for_panel(rotated_corners, flux_band):
    min_x = int(min(c[0] for c in rotated_corners))
    max_x = int(max(c[0] for c in rotated_corners))
    min_y = int(min(c[1] for c in rotated_corners))
    max_y = int(max(c[1] for c in rotated_corners))

    map_height, map_width = flux_band.shape
    min_x = max(0, min_x)
    max_x = min(map_width - 1, max_x)
    min_y = max(0, min_y)
    max_y = min(map_height - 1, max_y)

    flux_values = []
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if point_in_polygon(x + 0.5, y + 0.5, rotated_corners):
                flux_values.append(flux_band[y, x])

    if not flux_values:
        return 0.0
    return float(sum(flux_values) / len(flux_values))
```

**TypeScript equivalent:**

```typescript
function calculateAverageFlux(
  corners: [number, number][],
  fluxData: Float32Array | Float64Array,
  width: number,
  height: number
): number {
  // Bounding box of the rotated panel
  let minX = Math.floor(Math.min(...corners.map((c) => c[0])))
  let maxX = Math.floor(Math.max(...corners.map((c) => c[0])))
  let minY = Math.floor(Math.min(...corners.map((c) => c[1])))
  let maxY = Math.floor(Math.max(...corners.map((c) => c[1])))

  // Clip to raster bounds
  minX = Math.max(0, minX)
  maxX = Math.min(width - 1, maxX)
  minY = Math.max(0, minY)
  maxY = Math.min(height - 1, maxY)

  const fluxValues: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Test pixel CENTER (x + 0.5, y + 0.5), not corner
      if (pointInPolygon(x + 0.5, y + 0.5, corners)) {
        fluxValues.push(fluxData[y * width + x])
      }
    }
  }

  if (fluxValues.length === 0) return 0
  return fluxValues.reduce((sum, v) => sum + v, 0) / fluxValues.length
}
```

> **CRITICAL:** The flux raster is a flat typed array in geotiff.js. Index as `data[row * width + col]`, not `data[row][col]`.

### 3. Reading Monthly Flux Bands with geotiff.js

**Python (rasterio):**

```python
with rasterio.open(flux_tif_path) as flux_src:
    for band_idx in range(1, 13):  # 1-indexed
        flux_band = flux_src.read(band_idx)
        avg = calculate_average_flux_for_panel(corners, flux_band)
```

**TypeScript equivalent (geotiff.js):**

```typescript
import GeoTIFF from 'geotiff'

const tiff = await GeoTIFF.fromArrayBuffer(buffer)
const image = await tiff.getImage()
const width = image.getWidth()
const height = image.getHeight()

const monthlyEnergyDcKwh: number[] = []

for (let band = 0; band < 12; band++) {
  // 0-indexed!
  const rasters = await image.readRasters({ samples: [band] })
  const fluxData = rasters[0] as Float32Array

  const avgFlux = calculateAverageFlux(corners, fluxData, width, height)
  const energyKwh = avgFlux * (panelCapacityWatts / 1000)
  monthlyEnergyDcKwh.push(energyKwh)
}
```

### 4. Complete Recomputation Flow

```typescript
async function recomputePanelFlux(
  monthlyFluxBuffer: ArrayBuffer, // monthly_flux.tif from Supabase Storage
  buildingInsights: BuildingInsights, // cached buildingInsightsJson
  panelCenter: { lat: number; lng: number },
  rotationDeg: number
): Promise<number[]> {
  const tiff = await GeoTIFF.fromArrayBuffer(monthlyFluxBuffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const [originX, originY] = image.getOrigin()
  const [resX, resY] = image.getResolution()

  // 1. Convert lat/lng to pixel
  const { px, py } = latLngToPixel(panelCenter.lat, panelCenter.lng)

  // 2. Get panel dimensions in pixels
  const pixelSize = Math.abs(resX)
  const wPx = buildingInsights.solarPotential.panelWidthMeters / pixelSize
  const hPx = buildingInsights.solarPotential.panelHeightMeters / pixelSize

  // 3. Compute rotated corners
  const rotationRad = (rotationDeg * Math.PI) / 180
  const corners = getPanelCorners(px, py, wPx, hPx, rotationRad)

  // 4. Sample each of the 12 monthly bands
  const monthlyEnergy: number[] = []
  const panelCapacity = buildingInsights.solarPotential.panelCapacityWatts

  for (let band = 0; band < 12; band++) {
    const rasters = await image.readRasters({ samples: [band] })
    const fluxData = rasters[0] as Float32Array
    const avgFlux = calculateAverageFlux(corners, fluxData, width, height)
    monthlyEnergy.push(avgFlux * (panelCapacity / 1000))
  }

  return monthlyEnergy
}
```

## Common Pitfalls

1. **Pixel center offset:** Always test `(x + 0.5, y + 0.5)` for point-in-polygon, not `(x, y)`. This matches the Python prototype behavior.
2. **geotiff.js band indexing is 0-based:** `samples: [0]` reads the first band. Rasterio uses 1-based indexing.
3. **Flat array access:** geotiff.js returns flat typed arrays. Access pixel at (row, col) as `data[row * width + col]`.
4. **Monthly flux has exactly 12 bands:** One per calendar month (Jan=0, Feb=1, ..., Dec=11).
5. **Panel capacity units:** `panelCapacityWatts` is in watts; divide by 1000 to get kW for `flux × kW = kWh`.
6. **Buffer source:** Download `monthly_flux.tif` from Supabase Storage as an ArrayBuffer before passing to geotiff.js.
