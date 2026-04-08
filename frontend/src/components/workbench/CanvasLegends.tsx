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

export function CanvasLegends({ showSegments, segmentHulls, overlayMode, isOverlayLoading }: CanvasLegendsProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
      {showSegments && segmentHulls.length > 0 && (
        <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <p className="mb-1 font-medium">Roof Segments</p>
          {segmentHulls.map((hull) => (
            <p key={hull.segmentIndex} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: hull.color.replace('0.35)', '1)') }}
              />
              Seg {hull.segmentIndex + 1}: {hull.azimuth.toFixed(0)}° / {hull.pitch.toFixed(0)}° ({hull.panelCount}{' '}
              panels)
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
                <span className="text-[9px] font-medium text-white/90">Roof</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-black/40 ring-1 ring-white/20" />
                <span className="text-[9px] font-medium text-white/90">Off-roof</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-medium text-white/90">
                {overlayMode === 'annual-flux' ? 'Sunny' : 'High'}
              </span>
              <div
                className="w-3 rounded-sm"
                style={{
                  height: '120px',
                  background: overlayMode === 'annual-flux' ? COLORS.legendFlux : COLORS.legendDsm
                }}
              />
              <span className="text-[9px] font-medium text-white/90">
                {overlayMode === 'annual-flux' ? 'Shady' : 'Low'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
