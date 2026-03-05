---
name: solar-api-pipeline
description: Reference for implementing the Solar API fetch pipeline — calling buildingInsights and dataLayers, downloading GeoTIFFs, enriching panel data, and converting RGB imagery. Ported from the validated Python prototype.
---

# Solar API Fetch Pipeline

## When to Use

Use this skill when implementing or modifying:

- `POST /api/locations/resolve` (location resolution and cache-miss pipeline)
- Solar API service (`backend/src/services/`)
- GeoTIFF download and Supabase Storage upload logic
- RGB GeoTIFF → PNG/WebP conversion using `sharp`

## Pipeline Overview (from TRD §6.1)

```
1. Call buildingInsights(lat, lng)
   → On failure: mark location "failed", stop
   → On success: enrich solarPanels[] with IDs, store JSON

2. Call dataLayers(lat, lng, radiusMeters)
   → On failure: mark location "failed", stop
   → On success: download GeoTIFFs (RGB, monthlyFlux, mask, annualFlux, DSM) to Supabase Storage

3. Convert RGB GeoTIFF → PNG/WebP (using sharp)

4. Mark location "ready"
```

## API Call Reference

### buildingInsights

**Python (`solar_api.py`):**

```python
API_BASE = "https://solar.googleapis.com/v1"

params = {
    "location.latitude": lat,
    "location.longitude": lng,
}
if required_quality:
    params["requiredQuality"] = required_quality
url = f"{API_BASE}/buildingInsights:findClosest?{urlencode(params)}"
response = http_get_json(url, api_key=api_key)
```

**TypeScript equivalent:**

```typescript
const BASE_URL = 'https://solar.googleapis.com/v1'

async function fetchBuildingInsights(lat: number, lng: number, apiKey: string) {
  const params = new URLSearchParams({
    'location.latitude': lat.toString(),
    'location.longitude': lng.toString(),
    requiredQuality: 'HIGH',
    key: apiKey
  })

  const url = `${BASE_URL}/buildingInsights:findClosest?${params}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Solar API error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}
```

### dataLayers

**Python:**

```python
params = {
    "location.latitude": lat,
    "location.longitude": lng,
    "radiusMeters": radius_m,
    "view": "FULL_LAYERS",          # Returns all layers
    "requiredQuality": "HIGH",
}
url = f"{API_BASE}/dataLayers:get?{urlencode(params)}"
```

**TypeScript equivalent:**

```typescript
async function fetchDataLayers(lat: number, lng: number, radiusMeters: number, apiKey: string) {
  const params = new URLSearchParams({
    'location.latitude': lat.toString(),
    'location.longitude': lng.toString(),
    radiusMeters: radiusMeters.toString(),
    view: 'FULL_LAYERS',
    requiredQuality: 'HIGH',
    key: apiKey
  })

  const url = `${BASE_URL}/dataLayers:get?${params}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`DataLayers error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}
```

### Radius Calculation

The prototype dynamically calculates the radius from the bounding box:

```python
bbox = bi_json.get("boundingBox")
sw = bbox["sw"]
ne = bbox["ne"]
diameter = calculate_haversine_distance(sw["latitude"], sw["longitude"], ne["latitude"], ne["longitude"])
radius_m = math.ceil(diameter / 2) + 10
```

**TypeScript:**

```typescript
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dPhi = ((lat2 - lat1) * Math.PI) / 180
  const dLambda = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculateRadius(bbox: { sw: LatLng; ne: LatLng }): number {
  const diameter = haversineDistance(bbox.sw.latitude, bbox.sw.longitude, bbox.ne.latitude, bbox.ne.longitude)
  return Math.ceil(diameter / 2) + 10
}
```

## GeoTIFF Download

**Response field → filename mapping (from `config.py`):**

| Response Field   | Save As            |
| ---------------- | ------------------ |
| `dsmUrl`         | `dsm.tif`          |
| `rgbUrl`         | `rgb.tif`          |
| `maskUrl`        | `mask.tif`         |
| `annualFluxUrl`  | `annual_flux.tif`  |
| `monthlyFluxUrl` | `monthly_flux.tif` |

> **NOTE:** `hourlyShadeUrls` (array of 24) is NOT downloaded for the MVP.

**TypeScript — download and upload to Supabase Storage:**

```typescript
const LAYER_FIELDS: Record<string, string> = {
  dsmUrl: 'dsm.tif',
  rgbUrl: 'rgb.tif',
  maskUrl: 'mask.tif',
  annualFluxUrl: 'annual_flux.tif',
  monthlyFluxUrl: 'monthly_flux.tif'
}

async function downloadAndStoreGeoTiffs(
  dataLayersResponse: Record<string, string>,
  locationId: string,
  supabase: SupabaseClient
) {
  for (const [field, filename] of Object.entries(LAYER_FIELDS)) {
    const url = dataLayersResponse[field]
    if (!url) continue

    // Download the signed URL (expires ~1 hour — download immediately!)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download ${field}`)
    const buffer = Buffer.from(await response.arrayBuffer())

    // Upload to Supabase Storage
    const storagePath = `locations/${locationId}/${filename}`
    const { error } = await supabase.storage
      .from('geotiffs')
      .upload(storagePath, buffer, { contentType: 'image/tiff', upsert: true })

    if (error) throw new Error(`Storage upload failed for ${filename}: ${error.message}`)
  }
}
```

## Panel Enrichment

Before storing `buildingInsights`, enrich each panel with a deterministic ID:

```typescript
function enrichBuildingInsights(insights: any): any {
  const panels = insights.solarPotential?.solarPanels ?? []
  const enriched = panels.map((panel: any, idx: number) => ({
    ...panel,
    id: `panel_${idx}`
  }))
  return {
    ...insights,
    solarPotential: {
      ...insights.solarPotential,
      solarPanels: enriched
    }
  }
}
```

## RGB Conversion with sharp

**Python prototype used PIL + rasterio. TypeScript uses sharp:**

```typescript
import sharp from 'sharp'
import GeoTIFF from 'geotiff'

async function convertRgbToPng(rgbTifBuffer: ArrayBuffer): Promise<Buffer> {
  const tiff = await GeoTIFF.fromArrayBuffer(rgbTifBuffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()

  // Read RGB bands (0, 1, 2)
  const rasters = await image.readRasters({ samples: [0, 1, 2] })
  const r = rasters[0] as Uint8Array
  const g = rasters[1] as Uint8Array
  const b = rasters[2] as Uint8Array

  // Interleave into RGBRGBRGB...
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = r[i]
    pixels[i * 3 + 1] = g[i]
    pixels[i * 3 + 2] = b[i]
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}
```

> **NOTE:** If the GeoTIFF RGB values are floats (0.0–1.0), multiply by 255 before writing. Check `image.getSampleByteSize()` and dtype.

## Common Pitfalls

1. **GeoTIFF URLs expire:** The signed URLs in the `dataLayers` response are valid for ~1 hour. Download immediately during the pipeline.
2. **Error handling:** Both API calls can fail (no building found, low quality imagery). Always mark the location as `failed` and stop the pipeline.
3. **Enrichment is immutable:** The enriched `buildingInsightsJson` is stored on the Location record and never modified. Panel edits are stored on the Project record as `PanelEdit[]`.
4. **Storage bucket:** Create a `geotiffs` bucket in Supabase Storage before first use. Use `locationId` as the folder prefix.
