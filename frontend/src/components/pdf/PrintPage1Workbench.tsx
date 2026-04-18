import { useState } from 'react'
import type { ProjectResponse } from '@/api/projects'
import { getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import { parsePanelEdits } from '@/lib/buildingInsights'
import { createCanvasGeo, latLngToPixel, panelMetersToPixels } from '@/lib/canvasTransforms'

type Props = { project: ProjectResponse }

const ROOF_LABEL = { tile: 'Tile', metal: 'Metal', flat: 'Flat' } as const

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

  const imageGeoTransform = project.imageGeoTransform ?? null
  const panelWidthM = panelModel?.widthM ?? 0
  const panelHeightM = panelModel?.heightM ?? 0
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  const overlays =
    imageGeoTransform && imgSize && panelWidthM > 0 && panelHeightM > 0
      ? (() => {
          const geo = createCanvasGeo(imageGeoTransform, imgSize.w, imgSize.h)
          const { width, height } = panelMetersToPixels(panelWidthM, panelHeightM, geo)
          return activePanels.map((panel) => {
            const { x, y } = latLngToPixel(panel.center.lat, panel.center.lng, geo)
            return { cx: x, cy: y, wPx: width, hPx: height, rotationDeg: panel.rotation }
          })
        })()
      : []

  return (
    <section className="pdf-page pdf-page-break">
      <header className="mb-4 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-base font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Solar Installation Report</h1>
            <p className="text-xs text-muted-foreground">
              {project.name} &middot; Generated {generatedAt}
            </p>
          </div>
        </div>
      </header>

      <div>
        <h2 className="text-base font-semibold text-foreground">Installation Overview</h2>
        <p className="text-xs text-muted-foreground">Panel layout and hardware selection from the Workbench.</p>

        {project.rgbSignedUrl && (
          <div className="mt-3 flex justify-center">
            <div className="relative inline-flex overflow-hidden rounded-lg border border-border">
              <img
                src={project.rgbSignedUrl}
                alt="Rooftop satellite view with panel layout"
                className="block h-[110mm] w-auto"
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
                      fill="#60a5fa"
                      stroke="#1e3a8a"
                      strokeWidth={1.2}
                    />
                  ))}
                </svg>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-3">
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
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {suffix && <p className="text-[10px] text-muted-foreground">{suffix}</p>}
    </div>
  )
}
