import { Layer } from 'react-konva'
import { annualEnergyFromMonthly } from '@/lib/buildingInsights'
import type { WorkbenchPanelState } from '@/hooks/usePanelState'
import { PanelRect } from './PanelRect'

type RenderPanel = {
  panel: WorkbenchPanelState
  x: number
  y: number
}

type PanelLayerProps = {
  panels: RenderPanel[]
  panelWidth: number
  panelHeight: number
  selectedPanelId: string | null
  stageWidth: number
  stageHeight: number
  disabledPanelId?: string | null
  energyMin: number
  energyMax: number
  onSelect: (panelId: string) => void
  onDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) => void
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

  // Amplify small differences: use the actual spread but ensure the ratio
  // covers more of the 0→1 range by applying a contrast stretch.
  // clamp ratio to [0, 1] in case of floating point edge cases.
  const raw = (value - min) / (max - min)
  const ratio = Math.max(0, Math.min(1, raw))

  // blue-700 (29, 78, 216) → blue-300 (147, 197, 253) — wider visual range
  const red = Math.round(29 + ratio * (147 - 29))
  const green = Math.round(78 + ratio * (197 - 78))
  const blue = Math.round(216 + ratio * (253 - 216))

  return `rgba(${red}, ${green}, ${blue}, 0.82)`
}

export function PanelLayer({
  panels,
  panelWidth,
  panelHeight,
  selectedPanelId,
  stageWidth,
  stageHeight,
  disabledPanelId,
  energyMin,
  energyMax,
  onSelect,
  onDragEnd
}: PanelLayerProps) {
  return (
    <Layer>
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
          selected={selectedPanelId === panel.id}
          stageWidth={stageWidth}
          stageHeight={stageHeight}
          disabled={disabledPanelId === panel.id}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
        />
      ))}
    </Layer>
  )
}
