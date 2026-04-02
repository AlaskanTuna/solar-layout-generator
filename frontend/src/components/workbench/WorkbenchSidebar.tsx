import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { InfoTooltip } from '@/components/InfoTooltip'
import { PanelModelDrawer } from '@/components/workbench/PanelModelDrawer'
import { cn } from '@/lib/utils'
import type { BatchRecomputeStatus } from '@/hooks/usePanelState'
import type { PanelModel } from '@shared/types'

type UiMessage = {
  tone: 'error' | 'info'
  text: string
} | null

type SelectedPanelData = {
  id: string
  rotation: number
  monthlyEnergyDcKwh: number[]
} | null

type WorkbenchSidebarProps = {
  projectName: string
  totalAnnualYield: number
  totalCarbonOffsetKg: number
  carbonOffsetFactorKgPerMwh: number
  maxArrayPanelsCount: number
  panelLifetimeYears: number | undefined
  selectedPanelModelId: string
  selectedPanelModel: PanelModel
  onModelChange: (modelId: string) => void
  isModelRecomputing: boolean
  isSaving: boolean
  isBatchRecomputing: boolean
  initialBatchStatus: BatchRecomputeStatus
  message: UiMessage
  visiblePanelCount: number
  visibleCount: number
  minVisibleCount: number
  maxVisibleCount: number
  onVisibleCountChange: (count: number) => void
  selectedPanelIds: Set<string>
  selectedPanel: SelectedPanelData
  selectedAnnualEnergy: number | null
  pendingPanelId: string | null
  onRotationInput: (value: number) => void
  onDeleteSelected: () => void
  onSave: () => void
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(value)
}

export function WorkbenchSidebar({
  projectName,
  totalAnnualYield,
  totalCarbonOffsetKg,
  carbonOffsetFactorKgPerMwh,
  maxArrayPanelsCount,
  panelLifetimeYears,
  selectedPanelModelId,
  selectedPanelModel,
  onModelChange,
  isModelRecomputing,
  isSaving,
  isBatchRecomputing,
  initialBatchStatus,
  message,
  visiblePanelCount,
  visibleCount,
  minVisibleCount,
  maxVisibleCount,
  onVisibleCountChange,
  selectedPanelIds,
  selectedPanel,
  selectedAnnualEnergy,
  pendingPanelId,
  onRotationInput,
  onDeleteSelected,
  onSave
}: WorkbenchSidebarProps) {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <aside className="xl:overflow-y-auto xl:w-[22rem] xl:min-w-[22rem]">
      <Card className="border-border bg-card/90 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{projectName}</CardTitle>
              <CardDescription>Adjust the suggested layout before moving to financial analysis.</CardDescription>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">
                Annual Yield
                <InfoTooltip text="Total estimated electricity your panels will generate in a year." />
              </p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(totalAnnualYield)} kWh</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">
                CO₂ Offset
                <InfoTooltip
                  text={`Estimated using a factor of ${carbonOffsetFactorKgPerMwh} kg/MWh based on the grid emission factor for this region.`}
                />
              </p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(totalCarbonOffsetKg)} kg</p>
            </div>
          </div>
          <div className="border-t border-border" />
          <div data-tour="panel-model">
            <PanelModelDrawer
              selectedModelId={selectedPanelModelId}
              onSelect={onModelChange}
              disabled={isModelRecomputing || isSaving}
            />
          </div>
          <details className="rounded-lg border border-border bg-muted/50 text-sm">
            <summary className="cursor-pointer px-3 py-2 font-medium text-foreground select-none">
              Panel Specifications
            </summary>
            <div className="space-y-1 border-t border-border px-3 py-2 text-muted-foreground">
              <p>
                Dimensions: {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m
              </p>
              <p>Capacity: {selectedPanelModel.capacityWp} Wp</p>
              <p>Efficiency: {(selectedPanelModel.efficiency * 100).toFixed(1)}%</p>
              {selectedPanelModel.costPerWp > 0 && <p>Cost: RM {selectedPanelModel.costPerWp.toFixed(2)} / Wp</p>}
              <p>Max panels (API): {maxArrayPanelsCount}</p>
              {panelLifetimeYears != null && <p>Lifespan: {panelLifetimeYears} years</p>}
            </div>
          </details>
        </CardHeader>
        <CardContent className="space-y-6">
          {initialBatchStatus === 'loading' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Computing monthly energy data for all panels...
            </div>
          )}

          {initialBatchStatus === 'error' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Could not compute monthly energy breakdown. Annual estimates will be used instead.
            </div>
          )}

          {message && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                message.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              )}
            >
              {message.text}
            </div>
          )}

          <div data-tour="panel-count" className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                Panel Quantity
                <InfoTooltip text="Adjust how many panels to include. Higher-yield panels are kept first when you reduce the count." />
              </Label>
              <span className="text-sm text-muted-foreground">
                {visiblePanelCount} / {maxVisibleCount}
              </span>
            </div>
            <Slider
              value={[visibleCount]}
              min={minVisibleCount}
              max={Math.max(minVisibleCount, maxVisibleCount)}
              step={1}
              onValueChange={(value) => {
                const nextValue = value[0]
                if (typeof nextValue === 'number') {
                  onVisibleCountChange(nextValue)
                }
              }}
              disabled={maxVisibleCount <= minVisibleCount}
            />
            <p className="text-xs text-muted-foreground">
              Higher-yield panels are kept visible first. Lowering the slider removes lower-ranked panels from the saved
              layout.
            </p>
          </div>

          <div className="border-t border-border" />

          <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <Label>
                Selected Panel
                <InfoTooltip text="Click any panel on the canvas to select it. Hold Shift to select multiple. You can then rotate or delete them." />
              </Label>
              <span className="text-sm font-medium">
                {selectedPanelIds.size > 1 ? `${selectedPanelIds.size} panels` : (selectedPanel?.id ?? 'None')}
              </span>
            </div>

            {selectedPanelIds.size > 1 ? (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">{selectedPanelIds.size} panels selected</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the rotation slider to rotate all selected panels. Press Delete to remove them.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Annual Yield</p>
                  <p className="text-sm font-semibold">
                    {selectedAnnualEnergy !== null ? `${formatNumber(selectedAnnualEnergy)} kWh` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rotation</p>
                  <p className="text-sm font-semibold">
                    {selectedPanel ? `${Math.round(selectedPanel.rotation)}°` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Avg Monthly Yield
                    <InfoTooltip
                      text={
                        selectedPanel && selectedPanel.monthlyEnergyDcKwh.length > 0
                          ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                              .map(
                                (month, i) => `${month}: ${formatNumber(selectedPanel.monthlyEnergyDcKwh[i] ?? 0)} kWh`
                              )
                              .join('\n')
                          : 'Monthly data not yet computed'
                      }
                    />
                  </p>
                  <p className="text-sm font-semibold">
                    {selectedPanel && selectedPanel.monthlyEnergyDcKwh.length > 0
                      ? `${formatNumber(selectedAnnualEnergy! / 12)} kWh`
                      : '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Rotate {selectedPanelIds.size > 1 ? 'Panels' : 'Panel'}
                  <InfoTooltip text="Drag to set rotation angle (0–359°). The panel's energy yield is recomputed after each change." />
                </Label>
                <span className="text-sm font-medium">
                  {selectedPanel ? `${Math.round(selectedPanel.rotation)}°` : '—'}
                </span>
              </div>
              <Slider
                value={[selectedPanel?.rotation ?? 0]}
                min={0}
                max={359}
                step={5}
                disabled={selectedPanelIds.size === 0 || (selectedPanel != null && pendingPanelId === selectedPanel.id)}
                onValueChange={(value) => {
                  const nextValue = value[0]
                  if (typeof nextValue === 'number') {
                    onRotationInput(nextValue)
                  }
                }}
              />
            </div>

            <Button
              variant="destructive"
              className="w-full"
              disabled={selectedPanelIds.size === 0 || (selectedPanel != null && pendingPanelId === selectedPanel.id)}
              onClick={onDeleteSelected}
            >
              {selectedPanelIds.size > 1 ? `Delete ${selectedPanelIds.size} Panels` : 'Delete Selected Panel'}
            </Button>
          </div>

          <div className="grid gap-2">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to={`/project/${projectId}/map?view=readonly`}>Back to Map</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button
              data-tour="save-continue"
              className="w-full"
              onClick={onSave}
              disabled={isSaving || pendingPanelId !== null}
            >
              {isBatchRecomputing ? 'Recomputing Layout...' : isSaving ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
