import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectResponse } from '@/api/projects'
import { getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import { parsePanelEdits } from '@/lib/buildingInsights'
import { createCanvasGeo, latLngToPixel, panelMetersToPixels } from '@/lib/canvasTransforms'
import { PdfPageShell } from './PdfPageShell'

type Props = {
  project: ProjectResponse
}

/**
 * Renders the workbench page of the PDF report
 * @param {Props} props - Props for the component
 */
export function PrintPage1Workbench({ project }: Props) {
  const { t } = useTranslation('pdf')
  const activePanels = parsePanelEdits(project.editedLayout).filter((p) => p.status !== 'deleted')
  const panelModel = getPanelModel(project.analysisConfig?.selectedPanelModelId ?? DEFAULT_PANEL_MODEL_ID)
  const panelCapacityWp = panelModel?.capacityWp ?? 0
  const systemKwp = Math.round(((activePanels.length * panelCapacityWp) / 1000) * 100) / 100
  const roofType = project.analysisConfig?.roofType ?? 'tile'

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

  const roofTypeLabel = t(`page1.stats.roofType.labels.${roofType}`) ?? t('page1.stats.roofType.na')

  return (
    <PdfPageShell
      sectionLabel={t('page1.sectionLabel')}
      context={t('page1.context')}
    >
      {/* Rooftop preview */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex min-h-0 flex-1 justify-center">
          {project.rgbSignedUrl && (
            <div className="relative inline-flex max-h-full overflow-hidden rounded-lg border border-border">
              <img
                src={project.rgbSignedUrl}
                alt={t('page1.imageAlt')}
                className="block max-h-full w-auto"
                style={{ maxHeight: '136mm' }}
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
          )}
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-2">
          <StatTile
            label={t('page1.stats.activePanels.label')}
            value={String(activePanels.length)}
            suffix={t('page1.stats.activePanels.suffix')}
          />
          <StatTile
            label={t('page1.stats.systemSize.label')}
            value={systemKwp.toString()}
            suffix={t('page1.stats.systemSize.suffix')}
          />
          <StatTile
            label={t('page1.stats.panelModel.label')}
            value={panelModel?.name ?? t('page1.stats.panelModel.na')}
            suffix={panelModel ? `${panelCapacityWp} Wp` : ''}
          />
          <StatTile
            label={t('page1.stats.roofType.label')}
            value={roofTypeLabel}
            suffix=""
          />
        </div>
      </div>
    </PdfPageShell>
  )
}

function StatTile({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-foreground">{value}</p>
      {suffix && <p className="text-[9px] text-muted-foreground">{suffix}</p>}
    </div>
  )
}
