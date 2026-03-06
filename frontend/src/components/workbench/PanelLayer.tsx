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
  onDragEnd: (panelId: string, position: { x: number; y: number }) => void
}

function panelAnnualEnergy(panel: WorkbenchPanelState): number {
  return panel.monthlyEnergyDcKwh.length > 0 ? annualEnergyFromMonthly(panel.monthlyEnergyDcKwh) : panel.yearlyEnergyDcKwh
}

function getPanelColor(value: number, min: number, max: number): string {
  if (min === max) {
    return 'rgba(20, 184, 166, 0.78)'
  }

  const ratio = (value - min) / (max - min)
  const red = Math.round(239 - ratio * 165)
  const green = Math.round(68 + ratio * 125)
  const blue = Math.round(68 + ratio * 58)

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
