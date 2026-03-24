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
    return 'rgba(147, 197, 253, 0.82)'
  }

  const ratio = (value - min) / (max - min)

  // Linear gradient: blue-500 (59, 130, 246) → blue-200 (191, 219, 254)
  const red = Math.round(59 + ratio * (191 - 59))
  const green = Math.round(130 + ratio * (219 - 130))
  const blue = Math.round(246 + ratio * (254 - 246))

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
