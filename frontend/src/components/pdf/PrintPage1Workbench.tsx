import { useState } from 'react'
import type { ProjectResponse } from '@/api/projects'
import { getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import { parseBuildingInsights, parsePanelEdits, type BoundingBox } from '@/lib/buildingInsights'
import type { PanelEdit } from '@shared/types'

type Props = { project: ProjectResponse }

const ROOF_LABEL = { tile: 'Tile', metal: 'Metal', flat: 'Flat' } as const

function metersPerDegreeLat(): number {
  return 110574 // WGS84 meridian arc length per 1 deg lat, good-enough constant for our scale
}

function metersPerDegreeLng(latDeg: number): number {
  return 111320 * Math.cos((latDeg * Math.PI) / 180)
}

/** Lat/lng → pixel coords within the image viewBox. Bounds map like an equirectangular projection
 *  over the tiny bbox (<100m span) so cos(lat) is effectively constant. */
function latLngToImagePx(
  lat: number,
  lng: number,
  bbox: BoundingBox,
  imgW: number,
  imgH: number
): { x: number; y: number } {
  const { sw, ne } = bbox
  const xPct = (lng - sw.longitude) / (ne.longitude - sw.longitude)
  const yPct = (ne.latitude - lat) / (ne.latitude - sw.latitude) // flipped: image y grows downward
  return { x: xPct * imgW, y: yPct * imgH }
}

type Overlay = {
  cx: number
  cy: number
  wPx: number
  hPx: number
  rotationDeg: number
}

function computeOverlays(
  panels: PanelEdit[],
  bbox: BoundingBox,
  panelWidthMeters: number,
  panelHeightMeters: number,
  imgW: number,
  imgH: number
): Overlay[] {
  const centerLat = (bbox.sw.latitude + bbox.ne.latitude) / 2
  const bboxWidthMeters = (bbox.ne.longitude - bbox.sw.longitude) * metersPerDegreeLng(centerLat)
  const bboxHeightMeters = (bbox.ne.latitude - bbox.sw.latitude) * metersPerDegreeLat()
  const pxPerMeterX = imgW / bboxWidthMeters
  const pxPerMeterY = imgH / bboxHeightMeters

  return panels.map((panel) => {
    const { x, y } = latLngToImagePx(panel.center.lat, panel.center.lng, bbox, imgW, imgH)
    return {
      cx: x,
      cy: y,
      wPx: panelWidthMeters * pxPerMeterX,
      hPx: panelHeightMeters * pxPerMeterY,
      rotationDeg: panel.rotation
    }
  })
}

export function PrintPage1Workbench({ project }: Props) {
  const activePanels = parsePanelEdits(project.editedLayout).filter((p) => p.status !== 'deleted')
  const panelModel = getPanelModel(project.analysisConfig?.selectedPanelModelId ?? DEFAULT_PANEL_MODEL_ID)
  const panelCapacityWp = panelModel?.capacityWp ?? 0
  const systemKwp = Math.round(((activePanels.length * panelCapacityWp) / 1000) * 100) / 100
  const roofType = project.analysisConfig?.roofType ?? 'tile'
  const generatedAt = new Date().toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const buildingInsights = project.location?.buildingInsightsJson
    ? parseBuildingInsights(project.location.buildingInsightsJson)
    : null
  const panelWidthMeters = panelModel?.widthM ?? buildingInsights?.solarPotential.panelWidthMeters ?? 0
  const panelHeightMeters = panelModel?.heightM ?? buildingInsights?.solarPotential.panelHeightMeters ?? 0

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const overlays =
    buildingInsights && imgSize && panelWidthMeters > 0 && panelHeightMeters > 0
      ? computeOverlays(activePanels, buildingInsights.boundingBox, panelWidthMeters, panelHeightMeters, imgSize.w, imgSize.h)
      : []

  return (
    <section className="pdf-page pdf-page-break">
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Solar Installation Report</h1>
            <p className="text-sm text-muted-foreground">
              {project.name} &middot; Generated {generatedAt}
            </p>
          </div>
        </div>
      </header>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Installation Overview</h2>
        <p className="text-sm text-muted-foreground">Panel layout and hardware selection from the Workbench.</p>

        {project.rgbSignedUrl && (
          <div className="relative mt-6 overflow-hidden rounded-lg border border-border">
            <img
              src={project.rgbSignedUrl}
              alt="Rooftop satellite view with panel layout"
              className="block h-auto w-full"
              onLoad={(e) => {
                const img = e.currentTarget
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
              }}
            />
            {imgSize && overlays.length > 0 && (
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {overlays.map((o, i) => (
                  <rect
                    key={i}
                    x={o.cx - o.wPx / 2}
                    y={o.cy - o.hPx / 2}
                    width={o.wPx}
                    height={o.hPx}
                    transform={`rotate(${o.rotationDeg}, ${o.cx}, ${o.cy})`}
                    fill="rgba(59, 130, 246, 0.35)"
                    stroke="#1d4ed8"
                    strokeWidth={1.2}
                  />
                ))}
              </svg>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-6">
          <StatTile label="Active panels" value={String(activePanels.length)} suffix="panels" />
          <StatTile label="System size" value={systemKwp.toString()} suffix="kWp" />
          <StatTile label="Panel model" value={panelModel?.name ?? '—'} suffix={panelModel ? `${panelCapacityWp} Wp` : ''} />
          <StatTile label="Roof type" value={ROOF_LABEL[roofType] ?? '—'} suffix="" />
        </div>
      </div>
    </section>
  )
}

function StatTile({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {suffix && <p className="text-xs text-muted-foreground">{suffix}</p>}
    </div>
  )
}
