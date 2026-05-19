/**
 * Analysis page control sidebar for Malaysian homeowner savings calculations.
 * Used beside the analysis result cards to edit consumption, tariff, lifecycle, and PDF export inputs.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AnalysisFormState } from '@/hooks/useAnalysisForm'
import type { ParsedBuildingInsights } from '@/lib/buildingInsights'
import type { PanelModel, TariffRates } from '@shared/types'
import { ConsumptionControls } from './sidebar/ConsumptionControls'
import { LifecycleControls } from './sidebar/LifecycleControls'
import { SystemMetaCard } from './sidebar/SystemMetaCard'
import { TariffControls } from './sidebar/TariffControls'

type AnalysisSidebarProps = {
  projectId: string | undefined
  projectName: string
  systemKwp: number
  activePanelCount: number
  selectedPanelModel: PanelModel | undefined
  buildingInsights: ParsedBuildingInsights
  panelsMissingMonthlyEnergy: unknown[]
  phaseCapacityCapKw: number
  formState: AnalysisFormState
  setFormState: React.Dispatch<React.SetStateAction<AnalysisFormState | null>>
  viewMode: 'simple' | 'advanced'
  isExporting: boolean
  isSaving: boolean
  onExportPdf: () => void
  onSaveAnalysis: () => void
  /** Default TNB RP4 tariff rates passed through to the override modal */
  tariffRatesDefaults: TariffRates
  /** ISO date string for the last tariff verification date */
  tariffEffectiveDate?: string | null
}

/**
 * Renders the analysis control stack for a project, including tariff, consumption, lifecycle, and system metadata panels.
 * Expects the current form state, selected panel model, Solar API building data, and save/export handlers.
 */
export function AnalysisSidebar({
  projectId,
  projectName,
  systemKwp,
  activePanelCount,
  selectedPanelModel,
  buildingInsights,
  panelsMissingMonthlyEnergy,
  phaseCapacityCapKw,
  formState,
  setFormState,
  viewMode,
  isExporting,
  isSaving,
  onExportPdf,
  onSaveAnalysis,
  tariffRatesDefaults,
  tariffEffectiveDate
}: AnalysisSidebarProps) {
  const { t } = useTranslation('analysis')

  return (
    <aside className="xl:overflow-y-auto xl:w-[24rem] xl:min-w-[24rem]">
      <Card className="border-border bg-card/92 shadow-sm">
        {/* Project summary */}
        <SystemMetaCard
          projectName={projectName}
          systemKwp={systemKwp}
          activePanelCount={activePanelCount}
          selectedPanelModel={selectedPanelModel}
          buildingInsights={buildingInsights}
        />
        <CardContent className="space-y-4">
          {/* Status notices */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">{t('sidebar.adjustHint')}</p>
          </div>
          {panelsMissingMonthlyEnergy.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('sidebar.missingEnergy', { count: panelsMissingMonthlyEnergy.length })}
            </div>
          )}

          {systemKwp > phaseCapacityCapKw && phaseCapacityCapKw > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('sidebar.phaseCapExceeded', { cap: phaseCapacityCapKw, phase: formState.connectionPhase })}
            </div>
          )}

          {/* Consumption and tariff controls */}
          <ConsumptionControls formState={formState} setFormState={setFormState} />
          <TariffControls
            formState={formState}
            setFormState={setFormState}
            viewMode={viewMode}
            phaseCapacityCapKw={phaseCapacityCapKw}
            tariffRatesDefaults={tariffRatesDefaults}
            tariffEffectiveDate={tariffEffectiveDate}
            lifecycleControls={
              viewMode === 'advanced' ? <LifecycleControls formState={formState} setFormState={setFormState} /> : null
            }
          />

          {/* Actions */}
          <div className="grid gap-3">
            <Button variant="outline" size="sm" asChild className="w-full justify-center gap-2">
              <Link to={`/project/${projectId}/workbench`}>{t('sidebar.buttons.backToWorkbench')}</Link>
            </Button>
            <Button
              data-tour="export-pdf"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={onExportPdf}
              disabled={isExporting}
            >
              {isExporting ? t('sidebar.buttons.exporting') : t('sidebar.buttons.exportPdf')}
            </Button>
            <Button onClick={onSaveAnalysis} disabled={isSaving}>
              {isSaving ? t('sidebar.buttons.saving') : t('sidebar.buttons.saveAnalysis')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
