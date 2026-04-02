import { useState } from 'react'
import { cn } from '@/lib/utils'
import { COLORS } from '@/lib/constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
  canvasExpanded?: boolean
  onToggleCanvasExpanded?: () => void
  hasSelection?: boolean
  onDeleteSelected?: () => void
  freeRotate?: boolean
  onToggleFreeRotate?: () => void
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
  onToggleSegments,
  canvasExpanded,
  onToggleCanvasExpanded,
  hasSelection,
  onDeleteSelected,
  freeRotate,
  onToggleFreeRotate
}: CanvasControlsProps) {
  const [tooltipState, setTooltipState] = useState<{ label: string | null; pinned: boolean }>({
    label: null,
    pinned: false
  })

  return (
    <TooltipProvider delayDuration={180}>
      <div
        data-tour="canvas-controls"
        className="absolute right-4 top-4 z-30 flex max-h-[calc(100%-2rem)] flex-col gap-1 overflow-y-auto overflow-x-visible"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Expand/Collapse view */}
        {onToggleCanvasExpanded && (
          <>
            <ToolButton
              tooltipState={tooltipState}
              setTooltipState={setTooltipState}
              onClick={onToggleCanvasExpanded}
              tooltip={canvasExpanded ? 'Collapse View' : 'Expand View'}
            >
              {canvasExpanded ? (
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
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
              ) : (
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
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
              )}
            </ToolButton>
            <div className="my-1 border-t border-border" />
          </>
        )}

        {/* Tools group */}
        <span className="text-center text-[8px] font-medium uppercase tracking-wider text-muted-foreground">Tools</span>
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onUndo}
          disabled={!canUndo}
          tooltip="Undo"
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
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </ToolButton>
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onRedo}
          disabled={!canRedo}
          tooltip="Redo"
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
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </ToolButton>
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onToggleMarquee}
          active={marqueeMode}
          tooltip={marqueeMode ? 'Marquee: ON' : 'Marquee'}
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
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onToggleSnap}
          active={snapEnabled}
          tooltip={snapEnabled ? 'Snap: ON' : 'Snap'}
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
            <path d="M6 15V9a6 6 0 0 1 12 0v6" />
            <path d="M6 9h4" />
            <path d="M14 9h4" />
            <path d="M6 15h4" />
            <path d="M14 15h4" />
          </svg>
        </ToolButton>
        {onDeleteSelected && (
          <ToolButton
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            tooltip="Delete Selected"
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </ToolButton>
        )}
        {onToggleFreeRotate && (
          <ToolButton
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            onClick={onToggleFreeRotate}
            active={freeRotate}
            tooltip={freeRotate ? 'Free Rotate: ON' : 'Free Rotate'}
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
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </ToolButton>
        )}

        <div className="my-1 border-t border-border" />

        {/* View group */}
        <span className="text-center text-[8px] font-medium uppercase tracking-wider text-muted-foreground">View</span>
        <ToolButton tooltipState={tooltipState} setTooltipState={setTooltipState} onClick={onZoomIn} tooltip="Zoom in">
          <span className="text-sm font-bold">+</span>
        </ToolButton>
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onZoomOut}
          tooltip="Zoom out"
        >
          <span className="text-sm font-bold">−</span>
        </ToolButton>
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onZoomReset}
          tooltip="Reset zoom"
        >
          <span className="text-xs font-medium">1:1</span>
        </ToolButton>
        {stageScale !== 1 && (
          <span className="mt-1 text-center text-xs text-muted-foreground">{Math.round(stageScale * 100)}%</span>
        )}

        <div className="my-1 border-t border-border" />

        {/* Layers group */}
        <span className="text-center text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
          Layers
        </span>
        <ToolButton
          tooltipState={tooltipState}
          setTooltipState={setTooltipState}
          onClick={onToggleOverlayExpanded}
          className={overlayExpanded ? 'ring-1 ring-muted-foreground' : ''}
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
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            active={overlayMode === 'rgb'}
            background={COLORS.overlayRgb}
            label="RGB"
            onClick={() => onOverlayModeChange('rgb')}
          />
          <SwatchButton
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            active={overlayMode === 'annual-flux'}
            background={COLORS.overlayFlux}
            label="Flux"
            onClick={() => onOverlayModeChange('annual-flux')}
          />
          <SwatchButton
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            active={overlayMode === 'dsm'}
            background={COLORS.overlayDsm}
            label="DSM"
            onClick={() => onOverlayModeChange('dsm')}
          />
          <SwatchButton
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            active={overlayMode === 'mask'}
            background={COLORS.overlayMask}
            label="Mask"
            onClick={() => onOverlayModeChange('mask')}
          />
          <SwatchButton
            tooltipState={tooltipState}
            setTooltipState={setTooltipState}
            active={showSegments}
            background={COLORS.overlaySegments}
            label="Segments"
            onClick={onToggleSegments}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

function ToolButton({
  onClick,
  disabled,
  active,
  tooltip,
  className,
  tooltipState,
  setTooltipState,
  children
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  tooltip: string
  className?: string
  tooltipState: { label: string | null; pinned: boolean }
  setTooltipState: React.Dispatch<React.SetStateAction<{ label: string | null; pinned: boolean }>>
  children: React.ReactNode
}) {
  const isTooltipOpen = tooltipState.label === tooltip

  return (
    <Tooltip open={isTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            onClick()
            // Keep tooltip visible after click
            setTooltipState({ label: tooltip, pinned: true })
          }}
          disabled={disabled}
          onPointerEnter={() => setTooltipState({ label: tooltip, pinned: false })}
          onPointerLeave={() => {
            // Delay dismissal so tooltip persists briefly after hover
            setTimeout(() => {
              setTooltipState((current) =>
                current.label === tooltip && !current.pinned ? { label: null, pinned: false } : current
              )
            }, 1500)
          }}
          aria-label={tooltip}
          className={cn(
            'relative z-20 flex h-8 w-8 items-center justify-center rounded-md text-sm shadow-md transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40',
            active
              ? 'border border-primary/40 bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30'
              : 'bg-card/90 text-foreground hover:bg-foreground hover:text-background dark:hover:bg-background dark:hover:text-foreground',
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="z-[80] border border-border bg-foreground text-background dark:bg-background dark:text-foreground"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

function SwatchButton({
  active,
  background,
  label,
  onClick,
  tooltipState,
  setTooltipState
}: {
  active: boolean
  background: string
  label: string
  onClick: () => void
  tooltipState: { label: string | null; pinned: boolean }
  setTooltipState: React.Dispatch<React.SetStateAction<{ label: string | null; pinned: boolean }>>
}) {
  const isTooltipOpen = tooltipState.label === label

  return (
    <Tooltip open={isTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          onPointerEnter={() => setTooltipState({ label, pinned: false })}
          onPointerLeave={() => {
            setTooltipState((current) =>
              current.label === label && !current.pinned ? { label: null, pinned: false } : current
            )
          }}
          onFocus={() => setTooltipState({ label, pinned: false })}
          onBlur={() => {
            setTooltipState((current) =>
              current.label === label && !current.pinned ? { label: null, pinned: false } : current
            )
          }}
          onMouseDown={() => setTooltipState({ label, pinned: true })}
          aria-label={label}
          className={cn(
            'relative z-20 h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
            active ? 'outline outline-1 outline-foreground' : ''
          )}
          style={{ background }}
          title={label}
        />
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="border border-border bg-foreground text-background dark:bg-background dark:text-foreground"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
