/**
 * Read-only system summary card for the analysis sidebar.
 * Shows the selected panel model, kWp size, active panels, and Solar API coverage warnings.
 */

import { useTranslation } from 'react-i18next'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { formatNumber } from '@/components/analysis/formatters'
import type { ParsedBuildingInsights } from '@/lib/buildingInsights'
import type { PanelModel } from '@shared/types'

type SystemMetaCardProps = {
  projectName: string
  systemKwp: number
  activePanelCount: number
  selectedPanelModel: PanelModel | undefined
  buildingInsights: ParsedBuildingInsights
}

/**
 * Renders project system metadata before the user saves analysis results.
 * Expects panel model details, active panel count, kWp size, building insights, and any missing monthly energy.
 */
export function SystemMetaCard({
  projectName,
  systemKwp,
  activePanelCount,
  selectedPanelModel,
  buildingInsights
}: SystemMetaCardProps) {
  const { t } = useTranslation('analysis')

  return (
    <CardHeader className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl">{projectName}</CardTitle>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-muted-foreground">
            {t('sidebar.systemSize.label')}
            <InfoTooltip text={t('sidebar.systemSize.tooltip')} />
          </p>
          <p className="mt-1 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-muted-foreground">{t('sidebar.activePanels')}</p>
          <p className="mt-1 text-lg font-semibold">{activePanelCount}</p>
        </div>
      </div>
      {selectedPanelModel && (
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">{t('sidebar.panelModel')}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{selectedPanelModel.name}</p>
        </div>
      )}
      {selectedPanelModel && (
        <details className="rounded-lg border border-border bg-muted/50 text-sm">
          <summary className="cursor-pointer px-3 py-2 font-medium text-foreground select-none">
            {t('sidebar.panelSpecs.summary')}
          </summary>
          <div className="space-y-1 border-t border-border px-3 py-2 text-muted-foreground">
            <p>
              {t('sidebar.panelSpecs.dimensions')} {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m
            </p>
            <p>
              {t('sidebar.panelSpecs.capacity')} {selectedPanelModel.capacityWp} Wp
            </p>
            <p>
              {t('sidebar.panelSpecs.efficiency')} {(selectedPanelModel.efficiency * 100).toFixed(1)}%
            </p>
            {selectedPanelModel.costPerWp > 0 && (
              <p>
                {t('sidebar.panelSpecs.cost')} RM {selectedPanelModel.costPerWp.toFixed(2)} / Wp
              </p>
            )}
            <p>
              {t('sidebar.panelSpecs.maxPanels')} {buildingInsights.solarPotential.maxArrayPanelsCount}
            </p>
            {buildingInsights.solarPotential.panelLifetimeYears != null && (
              <p>
                {t('sidebar.panelSpecs.lifespan')} {buildingInsights.solarPotential.panelLifetimeYears} years
              </p>
            )}
          </div>
        </details>
      )}
    </CardHeader>
  )
}
