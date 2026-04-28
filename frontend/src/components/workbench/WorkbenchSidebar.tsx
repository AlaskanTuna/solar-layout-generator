import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sliders } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PanelModelDrawer } from '@/components/workbench/PanelModelDrawer'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { BatchRecomputeStatus } from '@/hooks/usePanelState'
import type { PanelModel, ImageryQuality } from '@shared/types'

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
  imageryQuality: ImageryQuality | null
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
  onSave: () => void
  layoutPresetLabel: string
  onOpenLayoutPreset: () => void
}

/**
 * Renders the workbench controls sidebar
 * @param {WorkbenchSidebarProps} props - Props for the component
 */
export function WorkbenchSidebar({
  projectName,
  imageryQuality,
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
  onSave,
  layoutPresetLabel,
  onOpenLayoutPreset
}: WorkbenchSidebarProps) {
  const { t } = useTranslation('workbench')
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <aside className="xl:overflow-y-auto xl:w-[22rem] xl:min-w-[22rem]">
      <Card className="border-border bg-card/90 shadow-sm">
        {/* Project summary and model selector */}
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{projectName}</CardTitle>
              <CardDescription>{t('sidebar.description')}</CardDescription>
            </div>
            {imageryQuality === 'BASE' && (
              <span className="inline-flex shrink-0 items-center rounded-md border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                {t('sidebar.imageryBase')}
                <InfoTooltip text={t('sidebar.imageryBaseTooltip')} />
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenLayoutPreset}
            data-tour="layout-preset"
            className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:border-foreground/30 hover:bg-muted"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sliders className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-medium">{t('sidebar.layoutPreset.label')}</p>
                <p className="text-xs text-muted-foreground">{layoutPresetLabel}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
          </button>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">
                {t('sidebar.stats.annualYield')}
                <InfoTooltip text={t('sidebar.stats.annualYieldTooltip')} />
              </p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(totalAnnualYield)} kWh</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">
                {t('sidebar.stats.co2Offset')}
                <InfoTooltip
                  text={t('sidebar.stats.co2OffsetTooltip', { factor: carbonOffsetFactorKgPerMwh })}
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
              {t('sidebar.panelSpecs.summary')}
            </summary>
            <div className="space-y-1 border-t border-border px-3 py-2 text-muted-foreground">
              <p>
                {t('sidebar.panelSpecs.dimensions', { height: selectedPanelModel.heightM, width: selectedPanelModel.widthM })}
              </p>
              <p>{t('sidebar.panelSpecs.capacity', { capacityWp: selectedPanelModel.capacityWp })}</p>
              <p>{t('sidebar.panelSpecs.efficiency', { efficiency: (selectedPanelModel.efficiency * 100).toFixed(1) })}</p>
              {selectedPanelModel.costPerWp > 0 && (
                <p>{t('sidebar.panelSpecs.cost', { costPerWp: selectedPanelModel.costPerWp.toFixed(2) })}</p>
              )}
              <p>{t('sidebar.panelSpecs.maxPanels', { count: maxArrayPanelsCount })}</p>
              {panelLifetimeYears != null && <p>{t('sidebar.panelSpecs.lifespan', { years: panelLifetimeYears })}</p>}
            </div>
          </details>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status notices */}
          {initialBatchStatus === 'loading' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {t('sidebar.batchStatus.loading')}
            </div>
          )}

          {initialBatchStatus === 'error' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t('sidebar.batchStatus.error')}
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

          {/* Panel count slider */}
          <div data-tour="panel-count" className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                {t('sidebar.panelQuantity.label')}
                <InfoTooltip text={t('sidebar.panelQuantity.tooltip')} />
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
              {t('sidebar.panelQuantity.hint')}
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Selected panel details */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <Label>
                {t('sidebar.selectedPanel.label')}
                <InfoTooltip text={t('sidebar.selectedPanel.tooltip')} />
              </Label>
              <span className="text-sm font-medium">
                {selectedPanelIds.size > 1
                  ? t('sidebar.selectedPanel.multiSelected', { count: selectedPanelIds.size })
                  : (selectedPanel?.id ?? t('sidebar.selectedPanel.none'))}
              </span>
            </div>

            {selectedPanelIds.size > 1 ? (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">{t('sidebar.selectedPanel.multiSelectedTitle', { count: selectedPanelIds.size })}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('sidebar.selectedPanel.multiSelectedHint')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t('sidebar.selectedPanel.annualYield')}</p>
                  <p className="text-sm font-semibold">
                    {selectedAnnualEnergy !== null ? `${formatNumber(selectedAnnualEnergy)} kWh` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('sidebar.selectedPanel.rotation')}</p>
                  <p className="text-sm font-semibold">
                    {selectedPanel ? `${Math.round(selectedPanel.rotation)}°` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('sidebar.selectedPanel.avgMonthlyYield')}
                    <InfoTooltip
                      text={
                        selectedPanel && selectedPanel.monthlyEnergyDcKwh.length > 0
                          ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                              .map(
                                (month, i) => `${month}: ${formatNumber(selectedPanel.monthlyEnergyDcKwh[i] ?? 0)} kWh`
                              )
                              .join('\n')
                          : t('sidebar.selectedPanel.monthlyDataPending')
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
          </div>

          <div className="grid gap-2">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to={`/project/${projectId}/map?view=readonly`}>{t('sidebar.actions.backToMap')}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/dashboard">{t('sidebar.actions.backToDashboard')}</Link>
            </Button>
            <Button
              data-tour="save-continue"
              className="w-full"
              onClick={onSave}
              disabled={isSaving || pendingPanelId !== null}
            >
              {isBatchRecomputing
                ? t('sidebar.actions.recomputing')
                : isSaving
                  ? t('sidebar.actions.saving')
                  : t('sidebar.actions.saveAndContinue')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
