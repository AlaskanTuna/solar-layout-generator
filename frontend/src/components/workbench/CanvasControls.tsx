import { cn } from '@/lib/utils'
import { COLORS } from '@/lib/constants'

type CanvasControlsProps = {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  marqueeMode: boolean
  onToggleMarquee: () => void
  snapEnabled: boolean
  onToggleSnap: () => void
  stageScale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  overlayExpanded: boolean
  onToggleOverlayExpanded: () => void
  overlayMode: 'rgb' | 'annual-flux' | 'dsm' | 'mask'
  onOverlayModeChange: (mode: 'rgb' | 'annual-flux' | 'dsm' | 'mask') => void
  showSegments: boolean
  onToggleSegments: () => void
}

export function CanvasControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  marqueeMode,
  onToggleMarquee,
  snapEnabled,
  onToggleSnap,
  stageScale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  overlayExpanded,
  onToggleOverlayExpanded,
  overlayMode,
  onOverlayModeChange,
  showSegments,
  onToggleSegments
}: CanvasControlsProps) {
  return (
    <div data-tour="canvas-controls" className="absolute right-4 top-4 flex flex-col gap-1">
      {/* Tools group */}
      <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 text-center">Tools</span>
      <ToolButton onClick={onUndo} disabled={!canUndo} tooltip="Undo">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </ToolButton>
      <ToolButton onClick={onRedo} disabled={!canRedo} tooltip="Redo">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </ToolButton>
      <ToolButton onClick={onToggleMarquee} active={marqueeMode} tooltip={marqueeMode ? 'Marquee: ON' : 'Marquee'}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 3h2" />
          <path d="M9 3h2" />
          <path d="M13 3h2" />
          <path d="M17 3h2" />
          <path d="M21 5v2" />
          <path d="M21 9v2" />
          <path d="M21 13v2" />
          <path d="M21 17v2" />
          <path d="M19 21h-2" />
          <path d="M15 21h-2" />
          <path d="M11 21h-2" />
          <path d="M7 21h-2" />
          <path d="M3 19v-2" />
          <path d="M3 15v-2" />
          <path d="M3 11v-2" />
          <path d="M3 7v-2" />
        </svg>
      </ToolButton>
      <ToolButton onClick={onToggleSnap} active={snapEnabled} tooltip={snapEnabled ? 'Snap: ON' : 'Snap'}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 15V9a6 6 0 0 1 12 0v6" />
          <path d="M6 9h4" />
          <path d="M14 9h4" />
          <path d="M6 15h4" />
          <path d="M14 15h4" />
        </svg>
      </ToolButton>

      <div className="my-1 border-t border-stone-200" />

      {/* View group */}
      <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 text-center">View</span>
      <ToolButton onClick={onZoomIn} tooltip="Zoom in">
        <span className="text-sm font-bold">+</span>
      </ToolButton>
      <ToolButton onClick={onZoomOut} tooltip="Zoom out">
        <span className="text-sm font-bold">−</span>
      </ToolButton>
      <ToolButton onClick={onZoomReset} tooltip="Reset zoom">
        <span className="text-xs font-medium">1:1</span>
      </ToolButton>
      {stageScale !== 1 && (
        <span className="mt-1 text-center text-xs text-stone-500">{Math.round(stageScale * 100)}%</span>
      )}

      <div className="my-1 border-t border-stone-200" />

      {/* Layers group */}
      <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 text-center">Layers</span>
      <ToolButton
        onClick={onToggleOverlayExpanded}
        className={overlayExpanded ? 'ring-1 ring-stone-400' : ''}
        tooltip={overlayExpanded ? 'Hide overlays' : 'Overlays'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </ToolButton>
      <div
        className={cn(
          'mt-1 flex flex-col gap-1 transition-all duration-200',
          overlayExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        )}
      >
        <SwatchButton
          active={overlayMode === 'rgb'}
          background={COLORS.overlayRgb}
          label="RGB"
          onClick={() => onOverlayModeChange('rgb')}
        />
        <SwatchButton
          active={overlayMode === 'annual-flux'}
          background={COLORS.overlayFlux}
          label="Flux"
          onClick={() => onOverlayModeChange('annual-flux')}
        />
        <SwatchButton
          active={overlayMode === 'dsm'}
          background={COLORS.overlayDsm}
          label="DSM"
          onClick={() => onOverlayModeChange('dsm')}
        />
        <SwatchButton
          active={overlayMode === 'mask'}
          background={COLORS.overlayMask}
          label="Mask"
          onClick={() => onOverlayModeChange('mask')}
        />
        <SwatchButton
          active={showSegments}
          background={COLORS.overlaySegments}
          label="Segments"
          onClick={onToggleSegments}
        />
      </div>
    </div>
  )
}

function ToolButton({
  onClick,
  disabled,
  active,
  tooltip,
  className,
  children
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  tooltip: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed',
        active && 'ring-1 ring-cyan-400 bg-cyan-50',
        className
      )}
    >
      {children}
      <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
        {tooltip}
      </span>
    </button>
  )
}

function SwatchButton({
  active,
  background,
  label,
  onClick
}: {
  active: boolean
  background: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
        active ? 'outline outline-1 outline-stone-900' : ''
      )}
      style={{ background }}
      title={label}
    >
      <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  )
}
