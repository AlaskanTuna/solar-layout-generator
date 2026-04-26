import { useMemo } from 'react'
import { Layer } from 'react-konva'
import { annualEnergyFromMonthly } from '@/lib/buildingInsights'
import type { WorkbenchPanelState } from '@/hooks/usePanelState'
import { PanelRect } from './PanelRect'
import { RotationHandle } from './RotationHandle'
import { GroupRotationHandle } from './GroupRotationHandle'

type RenderPanel = {
  panel: WorkbenchPanelState
  x: number
  y: number
}

type PanelLayerProps = {
  panels: RenderPanel[]
  panelWidth: number
  panelHeight: number
  selectedPanelIds: Set<string>
  stageWidth: number
  stageHeight: number
  disabledPanelId?: string | null
  snapEnabled?: boolean
  onSnapDragMove?: (panelId: string, position: { x: number; y: number }) => { x: number; y: number }
  onSelect: (panelId: string, shiftKey: boolean) => void
  onDragStart?: (panelId: string) => void
  onDragMove?: (panelId: string, position: { x: number; y: number }) => void
  onDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) => void
  onRotate?: (panelId: string, rotation: number) => void
  onGroupRotateStart?: (pointerX: number, pointerY: number) => void
  onGroupRotateMove?: (pointerX: number, pointerY: number, snapDegrees: number) => void
  onGroupRotateEnd?: () => void
  freeRotate?: boolean
}

function panelAnnualEnergy(panel: WorkbenchPanelState): number {
  return panel.monthlyEnergyDcKwh.length > 0
    ? annualEnergyFromMonthly(panel.monthlyEnergyDcKwh)
    : panel.yearlyEnergyDcKwh
}

// Rank-based color: instead of mapping raw kWh to a 0..1 ratio (which collapses
// when yields cluster — e.g. 66% of BASE-tier panels share the top yield decile),
// each panel's color comes from its rank within the visible set. Lowest yield = 0,
// highest = 1, evenly distributed regardless of value spread. Guarantees every
// panel gets a visually distinguishable shade even on tight-spread API responses.
function getPanelColorByRatio(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio))
  const red = Math.round(29 + r * (147 - 29))
  const green = Math.round(78 + r * (197 - 78))
  const blue = Math.round(216 + r * (253 - 216))
  return `rgba(${red}, ${green}, ${blue}, 0.82)`
}

export function PanelLayer({
  panels,
  panelWidth,
  panelHeight,
  selectedPanelIds,
  stageWidth,
  stageHeight,
  disabledPanelId,
  snapEnabled = false,
  onSnapDragMove,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onRotate,
  onGroupRotateStart,
  onGroupRotateMove,
  onGroupRotateEnd,
  freeRotate
}: PanelLayerProps) {
  // Compute each panel's rank by yield (ascending). Ties resolve by id so the
  // mapping is stable across re-renders. Result: panel id → rank-normalized
  // ratio in [0, 1] used directly as color input.
  const yieldRatios = useMemo(() => {
    const sorted = [...panels].sort((a, b) => {
      const dy = panelAnnualEnergy(a.panel) - panelAnnualEnergy(b.panel)
      return dy !== 0 ? dy : a.panel.id.localeCompare(b.panel.id)
    })
    const map = new Map<string, number>()
    const denom = Math.max(1, sorted.length - 1)
    for (let i = 0; i < sorted.length; i++) {
      map.set(sorted[i]!.panel.id, i / denom)
    }
    return map
  }, [panels])

  return (
    <Layer>
      {/* Panel rects */}
      {panels.map(({ panel, x, y }) => (
        <PanelRect
          key={panel.id}
          id={panel.id}
          x={x}
          y={y}
          width={panelWidth}
          height={panelHeight}
          rotation={panel.rotation}
          fill={getPanelColorByRatio(yieldRatios.get(panel.id) ?? 0.5)}
          selected={selectedPanelIds.has(panel.id)}
          multiSelected={selectedPanelIds.size > 1 && selectedPanelIds.has(panel.id)}
          stageWidth={stageWidth}
          stageHeight={stageHeight}
          disabled={disabledPanelId === panel.id}
          snapEnabled={snapEnabled}
          onSnapDragMove={onSnapDragMove}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      ))}

      {/* Rotation handle: single per-panel handle on single-select, unified group handle on multi-select */}
      {selectedPanelIds.size > 1 && onGroupRotateStart && onGroupRotateMove && onGroupRotateEnd ? (
        <GroupRotationHandle
          panels={panels
            .filter(({ panel }) => selectedPanelIds.has(panel.id) && disabledPanelId !== panel.id)
            .map(({ panel, x, y }) => ({ id: panel.id, x, y, rotation: panel.rotation }))}
          panelWidth={panelWidth}
          panelHeight={panelHeight}
          snapDegrees={freeRotate ? 1 : 5}
          onRotateStart={onGroupRotateStart}
          onRotateMove={onGroupRotateMove}
          onRotateEnd={onGroupRotateEnd}
        />
      ) : (
        onRotate &&
        panels
          .filter(({ panel }) => selectedPanelIds.has(panel.id) && disabledPanelId !== panel.id)
          .map(({ panel, x, y }) => (
            <RotationHandle
              key={`rot-${panel.id}`}
              panelId={panel.id}
              panelX={x}
              panelY={y}
              panelWidth={panelWidth}
              panelHeight={panelHeight}
              rotation={panel.rotation}
              snapDegrees={freeRotate ? 1 : 5}
              onRotate={onRotate}
            />
          ))
      )}
    </Layer>
  )
}
