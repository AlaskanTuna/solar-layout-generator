import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectResponse } from '@/api/projects'
import { ANALYSIS_DISCLAIMER_KEYS, MONTH_LABELS, azimuthToCompass } from '@/lib/analysis'
import { useTheme } from '@/hooks/useTheme'
import { getChartTooltipStyle } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { SolarVerdict } from '@/components/analysis/SolarVerdict'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import { NetBenefitChart } from '@/components/analysis/NetBenefitChart'
import { MonthTable } from '@/components/analysis/MonthTable'
import { formatCurrency } from '@/components/analysis/formatters'
import { PdfPageShell } from './PdfPageShell'
import { PdfBillComparisonChart, PdfCumulativeSavingsChart } from './analysis/PdfAnalysisCharts'
import { SummaryCard } from './analysis/PdfSummaryCards'
import { PdfSystemCost } from './analysis/PdfSystemCost'
import { buildPdfAnalysisViewModel } from './analysis/pdfAnalysisViewModel'

type Props = {
  project: ProjectResponse
  tariffEffectiveDate?: string | null
}

/**
 * Renders the analysis pages of the PDF report
 * @param {Props} props - Props for the component
 */
export function PrintPage2Analysis({ project, tariffEffectiveDate = null }: Props) {
  const { t } = useTranslation('pdf')
  const { resolved } = useTheme()
  const tooltipStyle = getChartTooltipStyle(resolved)
  const viewModel = buildPdfAnalysisViewModel(project)

  const assumptionTiles = useMemo(() => {
    if (!viewModel) return []

    const lifecycleActive = viewModel.analysisMode === 'lifecycle'

    return [
      {
        label: t('page5.assumptions.financialMode'),
        value: lifecycleActive
          ? t('page5.assumptions.financialModeLifecycle')
          : t('page5.assumptions.financialModeSimple'),
        detail: lifecycleActive
          ? t('page5.assumptions.financialModeLifecycleDetail')
          : t('page5.assumptions.financialModeSimpleDetail')
      },
      {
        label: t('page5.assumptions.perfRatio'),
        value: `${Math.round(viewModel.performanceRatio * 100)}%`,
        detail: t('page5.assumptions.perfRatioDetail')
      },
      {
        label: t('page5.assumptions.losses'),
        value: `${Math.round(viewModel.assumedLosses * 100)}%`,
        detail: t('page5.assumptions.lossesDetail')
      },
      {
        label: t('page5.assumptions.degradation'),
        value: `${(viewModel.degradationRate * 100).toFixed(1)}%/yr`,
        detail: t('page5.assumptions.degradationDetail')
      },
      viewModel.tariffEscalationRate > 0
        ? {
            label: t('page5.assumptions.tariffEscalation'),
            value: `${(viewModel.tariffEscalationRate * 100).toFixed(1)}%/yr`,
            detail: t('page5.assumptions.tariffEscalationDetail')
          }
        : null,
      {
        label: t('page5.assumptions.dcAcRatio'),
        value: String(viewModel.dcAcRatio),
        detail: t('page5.assumptions.dcAcRatioDetail')
      },
      lifecycleActive && viewModel.annualMaintenanceRm > 0
        ? {
            label: t('page5.assumptions.maintenance'),
            value: `${formatCurrency(viewModel.annualMaintenanceRm)}/yr`,
            detail: t('page5.assumptions.maintenanceDetail')
          }
        : null,
      ...(lifecycleActive
        ? viewModel.inverterReplacements.map((replacement, index) => ({
            label:
              viewModel.inverterReplacements.length === 1
                ? t('page5.assumptions.inverterSwap')
                : t('page5.assumptions.inverterSwapNumbered', { index: index + 1 }),
            value: formatCurrency(replacement.costRm),
            detail: t('page5.assumptions.inverterSwapDetail', { year: replacement.year })
          }))
        : []),
      viewModel.panelLifetimeYears != null
        ? {
            label: t('page5.assumptions.panelLifetime'),
            value: `${viewModel.panelLifetimeYears} ${t('page5.assumptions.panelLifetimeSuffix')}`,
            detail: t('page5.assumptions.panelLifetimeDetail')
          }
        : null,
      viewModel.layoutOrientation
        ? {
            label: t('page5.assumptions.azimuthPitch'),
            value: `${Math.round(viewModel.layoutOrientation.azimuthDegrees)}° / ${Math.round(viewModel.layoutOrientation.pitchDegrees)}°`,
            detail:
              viewModel.layoutOrientation.segmentCount > 1
                ? t('page5.assumptions.azimuthPitchMultiSegment', {
                    compass: azimuthToCompass(viewModel.layoutOrientation.azimuthDegrees),
                    count: viewModel.layoutOrientation.segmentCount
                  })
                : t('page5.assumptions.azimuthPitchOneSegment', {
                    compass: azimuthToCompass(viewModel.layoutOrientation.azimuthDegrees),
                    count: viewModel.layoutOrientation.panelCount
                  })
          }
        : null,
      tariffEffectiveDate
        ? {
            label: t('page5.assumptions.tariffVerified'),
            value: new Date(tariffEffectiveDate).toLocaleDateString('en-MY', { year: 'numeric', month: 'short' }),
            detail: t('page5.assumptions.tariffVerifiedDetail')
          }
        : null
    ].filter((tile) => tile !== null) as { label: string; value: string; detail?: string }[]
  }, [t, tariffEffectiveDate, viewModel])

  if (!viewModel) {
    return (
      <PdfPageShell sectionLabel="Analysis" pageBreak={false}>
        <div className="rounded-lg border border-destructive bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-semibold">{t('analysisError.title')}</p>
          <p className="mt-2">{t('analysisError.description')}</p>
        </div>
      </PdfPageShell>
    )
  }

  const lifecycleActive = viewModel.analysisMode === 'lifecycle'
  const withoutSolarLabel = t('page4.billComparison.withoutSolar')
  const withSolarLabel = t('page4.billComparison.withSolar')

  return (
    <>
      {/* Page 2 */}
      <PdfPageShell sectionLabel={t('page2.sectionLabel')} context={t('page2.context')}>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pdf-card-break">
            <SolarVerdict analysisResults={viewModel.analysisResults} paybackTooltip={t('page2.paybackTooltip')} />
          </div>
          <div className="pdf-card-break">
            <PdfBillComparisonChart
              chartData={viewModel.chartData}
              tooltipStyle={tooltipStyle}
              withoutSolarLabel={withoutSolarLabel}
              withSolarLabel={withSolarLabel}
            />
          </div>
        </div>
      </PdfPageShell>

      {/* Page 3 */}
      <PdfPageShell sectionLabel={t('page3.sectionLabel')} context={t('page3.context')}>
        <div className="min-h-0 flex-1">
          <MonthTable
            simulation={{
              months: viewModel.analysisResults.monthlyBreakdown,
              totalConsumptionKwh: viewModel.analysisResults.annualTotals.totalConsumptionKwh,
              totalGenerationKwh: viewModel.analysisResults.annualTotals.totalGenerationKwh,
              totalBaselineRm: viewModel.analysisResults.annualTotals.totalBaselineRm,
              totalNemRm: viewModel.analysisResults.annualTotals.totalNemRm,
              totalSavingsRm: viewModel.analysisResults.annualTotals.totalSavingsRm,
              totalCreditsForfeited: viewModel.analysisResults.annualTotals.totalCreditsForfeitedKwh
            }}
            isOpen={true}
            onToggle={() => {}}
          />
        </div>
      </PdfPageShell>

      {/* Page 4 */}
      <PdfPageShell sectionLabel={t('page4.sectionLabel')} context={t('page4.context')}>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pdf-card-break min-h-0 flex-1">
            <PdfCumulativeSavingsChart chartData={viewModel.chartData} tooltipStyle={tooltipStyle} />
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title={t('page4.summary.title')}
              tiles={[
                {
                  label: t('page4.summary.peakMonthSavings'),
                  value: formatCurrency(viewModel.peakMonthly),
                  detail: MONTH_LABELS[viewModel.peakMonthlyIdx]
                },
                {
                  label: t('page4.summary.averageMonthSavings'),
                  value: formatCurrency(viewModel.avgMonthly),
                  detail: t('page4.summary.averageMonthSavingsDetail')
                },
                {
                  label: t('page4.summary.year1TotalSavings'),
                  value: formatCurrency(viewModel.year1Savings),
                  detail: t('page4.summary.year1TotalSavingsDetail')
                }
              ]}
            />
          </div>
        </div>
      </PdfPageShell>

      {/* Page 5 */}
      <PdfPageShell sectionLabel={t('page5.sectionLabel')} context={t('page5.context')}>
        <div className="min-h-0 flex-1">
          {viewModel.costBreakdown ? (
            <PdfSystemCost
              costBreakdown={viewModel.costBreakdown}
              activePanelCount={viewModel.activePanelCount}
              panelCapacityWp={viewModel.panelCapacityWp}
              panelCostPerWp={viewModel.panelCostPerWp}
              roofType={viewModel.roofType}
              tooltipStyle={tooltipStyle}
              assumptionTiles={assumptionTiles}
            />
          ) : (
            <Card className="border-border bg-card/90 shadow-sm">
              <CardContent className="p-4 text-sm text-muted-foreground">{t('page5.noCostBreakdown')}</CardContent>
            </Card>
          )}
        </div>
      </PdfPageShell>

      {/* Page 6 */}
      <PdfPageShell
        sectionLabel={t('page6.sectionLabel')}
        context={lifecycleActive ? t('page6.contextLifecycle') : t('page6.contextSimple')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pdf-card-break min-h-0 flex-1">
            <NetBenefitChart
              year1Savings={viewModel.year1Savings}
              degradationRate={viewModel.degradationRate}
              systemCostRm={viewModel.systemCostRm}
              tariffEscalationRate={viewModel.tariffEscalationRate}
              defaultYearRange={25}
              analysisMode={viewModel.analysisMode}
              annualMaintenanceRm={viewModel.annualMaintenanceRm}
              inverterReplacements={viewModel.inverterReplacements}
            />
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title={t('page6.summary.title')}
              tiles={[
                {
                  label: t('page6.summary.breakEven'),
                  value:
                    viewModel.breakEvenYear !== null
                      ? `${viewModel.breakEvenYear.toFixed(1)} yrs`
                      : t('page6.summary.breakEvenNA'),
                  detail: t('page6.summary.breakEvenDetail')
                },
                {
                  label: t('page6.summary.year25NetBenefit'),
                  value: formatCurrency(viewModel.year25NetBenefit),
                  detail: t('page6.summary.year25NetBenefitDetail')
                },
                {
                  label: t('page6.summary.year25GrossSavings'),
                  value: formatCurrency(viewModel.year25DegradedCumulative),
                  detail: t('page6.summary.year25GrossSavingsDetail')
                }
              ]}
            />
          </div>
        </div>
      </PdfPageShell>

      {/* Page 7 */}
      <PdfPageShell sectionLabel={t('page7.sectionLabel')} context={t('page7.context')}>
        <div className="min-h-0 flex-1">
          <FinancialRoadmap
            systemCostRm={viewModel.systemCostRm}
            paybackYears={viewModel.analysisResults.paybackYears}
            year1Savings={viewModel.year1Savings}
            degradationRate={viewModel.degradationRate}
            systemKwp={viewModel.systemKwp}
            tariffEscalationRate={viewModel.tariffEscalationRate}
            analysisMode={viewModel.analysisMode}
            annualMaintenanceRm={viewModel.annualMaintenanceRm}
            inverterReplacements={viewModel.inverterReplacements}
          />
        </div>
      </PdfPageShell>

      {/* Page 8 */}
      <PdfPageShell sectionLabel={t('page8.sectionLabel')} pageBreak={false}>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
          <p className="mb-2 text-sm font-semibold text-foreground">{t('page8.title')}</p>
          <ul className="space-y-2">
            {ANALYSIS_DISCLAIMER_KEYS.map((key) => (
              <li key={key}>&middot; {t(`page8.disclaimers.${key}` as const)}</li>
            ))}
          </ul>
        </div>
      </PdfPageShell>
    </>
  )
}
