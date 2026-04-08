import { useState } from 'react'
import { cn } from '@/lib/utils'
import { COLORS } from '@/lib/constants'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToolButton, SwatchButton, type TooltipState } from './ToolButton'
import {
  CollapseIcon,
  ExpandIcon,
  UndoIcon,
  RedoIcon,
  MarqueeIcon,
  SnapIcon,
  DeleteIcon,
  RotateIcon,
  LayersIcon
} from './ToolbarIcons'

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
  const [tooltipState, setTooltipState] = useState<TooltipState>({ label: null, pinned: false })
  const tt = { tooltipState, setTooltipState }

  return (
    <TooltipProvider delayDuration={180}>
      <div
        data-tour="canvas-controls"
        className="absolute right-4 top-4 z-30 flex max-h-[calc(100%-2rem)] flex-col gap-1 overflow-y-auto overflow-x-visible"
        style={{ scrollbarWidth: 'none' }}
      >
        {onToggleCanvasExpanded && (
          <>
            <ToolButton
              {...tt}
              onClick={onToggleCanvasExpanded}
              tooltip={canvasExpanded ? 'Collapse View' : 'Expand View'}
            >
              {canvasExpanded ? <CollapseIcon /> : <ExpandIcon />}
            </ToolButton>
            <div className="my-1 border-t border-border" />
          </>
        )}

        <span className="text-center text-[8px] font-medium uppercase tracking-wider text-muted-foreground">Tools</span>
        <ToolButton {...tt} onClick={onUndo} disabled={!canUndo} tooltip="Undo">
          <UndoIcon />
        </ToolButton>
        <ToolButton {...tt} onClick={onRedo} disabled={!canRedo} tooltip="Redo">
          <RedoIcon />
        </ToolButton>
        <ToolButton
          {...tt}
          onClick={onToggleMarquee}
          active={marqueeMode}
          tooltip={marqueeMode ? 'Marquee: ON' : 'Marquee'}
        >
          <MarqueeIcon />
        </ToolButton>
        <ToolButton {...tt} onClick={onToggleSnap} active={snapEnabled} tooltip={snapEnabled ? 'Snap: ON' : 'Snap'}>
          <SnapIcon />
        </ToolButton>
        {onDeleteSelected && (
          <ToolButton {...tt} onClick={onDeleteSelected} disabled={!hasSelection} tooltip="Delete Selected">
            <DeleteIcon />
          </ToolButton>
        )}
        {onToggleFreeRotate && (
          <ToolButton
            {...tt}
            onClick={onToggleFreeRotate}
            active={freeRotate}
            tooltip={freeRotate ? 'Free Rotate: ON' : 'Free Rotate'}
          >
            <RotateIcon />
          </ToolButton>
        )}

        <div className="my-1 border-t border-border" />

        <span className="text-center text-[8px] font-medium uppercase tracking-wider text-muted-foreground">View</span>
        <ToolButton {...tt} onClick={onZoomIn} tooltip="Zoom in">
          <span className="text-sm font-bold">+</span>
        </ToolButton>
        <ToolButton {...tt} onClick={onZoomOut} tooltip="Zoom out">
          <span className="text-sm font-bold">−</span>
        </ToolButton>
        <ToolButton {...tt} onClick={onZoomReset} tooltip="Reset zoom">
          <span className="text-xs font-medium">1:1</span>
        </ToolButton>
        {stageScale !== 1 && (
          <span className="mt-1 text-center text-xs text-muted-foreground">{Math.round(stageScale * 100)}%</span>
        )}

        <div className="my-1 border-t border-border" />

        <span className="text-center text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
          Layers
        </span>
        <ToolButton
          {...tt}
          onClick={onToggleOverlayExpanded}
          className={overlayExpanded ? 'ring-1 ring-muted-foreground' : ''}
          tooltip={overlayExpanded ? 'Hide overlays' : 'Overlays'}
        >
          <LayersIcon />
        </ToolButton>
        <div
          className={cn(
            'mt-1 flex flex-col gap-1 transition-all duration-200',
            overlayExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          )}
        >
          <SwatchButton
            {...tt}
            active={overlayMode === 'rgb'}
            background={COLORS.overlayRgb}
            label="RGB"
            onClick={() => onOverlayModeChange('rgb')}
          />
          <SwatchButton
            {...tt}
            active={overlayMode === 'annual-flux'}
            background={COLORS.overlayFlux}
            label="Flux"
            onClick={() => onOverlayModeChange('annual-flux')}
          />
          <SwatchButton
            {...tt}
            active={overlayMode === 'dsm'}
            background={COLORS.overlayDsm}
            label="DSM"
            onClick={() => onOverlayModeChange('dsm')}
          />
          <SwatchButton
            {...tt}
            active={overlayMode === 'mask'}
            background={COLORS.overlayMask}
            label="Mask"
            onClick={() => onOverlayModeChange('mask')}
          />
          <SwatchButton
            {...tt}
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
