import { Layer } from 'react-konva'
import { annualEnergyFromMonthly } from '@/lib/buildingInsights'
import type { WorkbenchPanelState } from '@/hooks/usePanelState'
import { PanelRect } from './PanelRect'
import { RotationHandle } from './RotationHandle'

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
  energyMin: number
  energyMax: number
  snapEnabled?: boolean
  onSnapDragMove?: (panelId: string, position: { x: number; y: number }) => { x: number; y: number }
  onSelect: (panelId: string, shiftKey: boolean) => void
  onDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) => void
  onRotate?: (panelId: string, rotation: number) => void
  freeRotate?: boolean
}

function panelAnnualEnergy(panel: WorkbenchPanelState): number {
  return panel.monthlyEnergyDcKwh.length > 0
    ? annualEnergyFromMonthly(panel.monthlyEnergyDcKwh)
    : panel.yearlyEnergyDcKwh
}

function getPanelColor(value: number, min: number, max: number): string {
  if (min === max) {
    return 'rgba(120, 170, 250, 0.82)'
  }

  const raw = (value - min) / (max - min)
  const ratio = Math.max(0, Math.min(1, raw))

  const red = Math.round(29 + ratio * (147 - 29))
  const green = Math.round(78 + ratio * (197 - 78))
  const blue = Math.round(216 + ratio * (253 - 216))

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
  energyMin,
  energyMax,
  snapEnabled = false,
  onSnapDragMove,
  onSelect,
  onDragEnd,
  onRotate,
  freeRotate
}: PanelLayerProps) {
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
          fill={getPanelColor(panelAnnualEnergy(panel), energyMin, energyMax)}
          selected={selectedPanelIds.has(panel.id)}
          multiSelected={selectedPanelIds.size > 1 && selectedPanelIds.has(panel.id)}
          stageWidth={stageWidth}
          stageHeight={stageHeight}
          disabled={disabledPanelId === panel.id}
          snapEnabled={snapEnabled}
          onSnapDragMove={onSnapDragMove}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      ))}

      {/* Rotation handles for selected panels (rendered ABOVE panels so they're clickable) */}
      {onRotate &&
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
          ))}
    </Layer>
  )
}
