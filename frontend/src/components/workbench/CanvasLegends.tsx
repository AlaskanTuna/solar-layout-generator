/**
 * Overlay legend stack for the workbench canvas.
 * Explains roof segment colours and Solar API overlays such as annual flux, DSM, and roof mask.
 */

import { useTranslation } from 'react-i18next'
import { COLORS } from '@/lib/constants'
import type { OverlayMode } from '@/hooks/useOverlayImages'

type SegmentHull = {
  segmentIndex: number
  color: string
  azimuth: number
  pitch: number
  panelCount: number
}

type CanvasLegendsProps = {
  showSegments: boolean
  segmentHulls: SegmentHull[]
  overlayMode: OverlayMode
  isOverlayLoading: boolean
}

/**
 * Renders contextual legends for visible roof segments and the active imagery overlay.
 * Expects segment hull metadata, overlay mode, and loading state so legends appear only when meaningful.
 */
export function CanvasLegends({ showSegments, segmentHulls, overlayMode, isOverlayLoading }: CanvasLegendsProps) {
  const { t } = useTranslation('workbench')

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
      {showSegments && segmentHulls.length > 0 && (
        <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <p className="mb-1 font-medium">{t('legends.roofSegments')}</p>
          {segmentHulls.map((hull) => (
            <p key={hull.segmentIndex} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: hull.color.replace('0.35)', '1)') }}
              />
              {t('legends.segmentLabel', {
                index: hull.segmentIndex + 1,
                azimuth: hull.azimuth.toFixed(0),
                pitch: hull.pitch.toFixed(0),
                count: hull.panelCount
              })}
            </p>
          ))}
        </div>
      )}
      {overlayMode !== 'rgb' && !isOverlayLoading && (
        <div className="rounded-lg bg-black/60 px-2.5 py-2 backdrop-blur-sm">
          {overlayMode === 'mask' ? (
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-green-500/60" />
                <span className="text-[9px] font-medium text-white/90">{t('legends.mask.roof')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-black/40 ring-1 ring-white/20" />
                <span className="text-[9px] font-medium text-white/90">{t('legends.mask.offRoof')}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-medium text-white/90">
                {overlayMode === 'annual-flux' ? t('legends.flux.high') : t('legends.dsm.high')}
              </span>
              <div
                className="w-3 rounded-sm"
                style={{
                  height: '120px',
                  background: overlayMode === 'annual-flux' ? COLORS.legendFlux : COLORS.legendDsm
                }}
              />
              <span className="text-[9px] font-medium text-white/90">
                {overlayMode === 'annual-flux' ? t('legends.flux.low') : t('legends.dsm.low')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
