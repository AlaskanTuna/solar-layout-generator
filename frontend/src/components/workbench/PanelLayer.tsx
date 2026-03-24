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
    return 'rgba(59, 130, 246, 0.78)'
  }

  const ratio = (value - min) / (max - min)

  // Three-stop blue gradient: blue-900 → blue-500 → blue-300
  let red: number, green: number, blue: number
  if (ratio < 0.5) {
    // Low-to-mid: blue-900 (30, 58, 138) → blue-500 (59, 130, 246)
    const t = ratio / 0.5
    red = Math.round(30 + t * (59 - 30))
    green = Math.round(58 + t * (130 - 58))
    blue = Math.round(138 + t * (246 - 138))
  } else {
    // Mid-to-high: blue-500 (59, 130, 246) → blue-300 (147, 197, 253)
    const t = (ratio - 0.5) / 0.5
    red = Math.round(59 + t * (147 - 59))
    green = Math.round(130 + t * (197 - 130))
    blue = Math.round(246 + t * (253 - 246))
  }

  return `rgba(${red}, ${green}, ${blue}, 0.78)`
}

export function PanelLayer({
  panels,
  panelWidth,
  panelHeight,
  selectedPanelId,
  stageWidth,
  stageHeight,
  disabledPanelId,
  onSelect,
  onDragEnd
}: PanelLayerProps) {
  const annualEnergies = panels.map(({ panel }) => panelAnnualEnergy(panel))
  const minEnergy = annualEnergies.length > 0 ? Math.min(...annualEnergies) : 0
  const maxEnergy = annualEnergies.length > 0 ? Math.max(...annualEnergies) : 0

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
          fill={getPanelColor(panelAnnualEnergy(panel), minEnergy, maxEnergy)}
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
