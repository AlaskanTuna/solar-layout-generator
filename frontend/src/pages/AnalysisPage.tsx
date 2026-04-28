import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { notify } from '@/components/ui/toastConfig'
import { saveAnalysis } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ANALYSIS_DISCLAIMER_KEYS,
  buildNetBenefitSeries,
  type AnalysisConfig,
  type AnalysisResultsRecord
} from '@/lib/analysis'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageContainer } from '@/components/layout/PageContainer'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { GuidedTour, type TourStep } from '@/components/ui/GuidedTour'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/components/analysis/formatters'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import { getChartTooltipStyle } from '@/lib/constants'
import { BillComparisonChart } from '@/components/analysis/BillComparisonChart'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import { NetBenefitChart } from '@/components/analysis/NetBenefitChart'
import { BillBreakdown } from '@/components/analysis/BillBreakdown'
import { MonthTable } from '@/components/analysis/MonthTable'
import { SystemAssumptions } from '@/components/analysis/SystemAssumptions'
import { SystemCostCard } from '@/components/analysis/SystemCostCard'
import { SolarVerdict } from '@/components/analysis/SolarVerdict'
import { SortableCardContainer } from '@/components/analysis/SortableCardContainer'
import { AnalysisSidebar } from '@/components/analysis/AnalysisSidebar'
import { useAnalysisForm, type AnalysisFormState } from '@/hooks/useAnalysisForm'
import { useAnalysisPdf } from '@/hooks/useAnalysisPdf'
import { summarizeLayoutOrientation } from '@/lib/analysis'
import { markProjectVisited } from '@/lib/recentProjectActivity'

function buildSavePayload(formState: AnalysisFormState, systemKwp: number, analysisResults: AnalysisResultsRecord) {
  return {
    analysisConfig: {
      ...formState,
      systemKwp
    } satisfies AnalysisConfig,
    analysisResults
  }
}

export function AnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)
  const { t } = useTranslation('analysis')

  const ANALYSIS_TOUR_STEPS: TourStep[] = [
    {
      title: t('tour.overview.title'),
      description: t('tour.overview.description')
    },
    {
      target: '[data-tour="consumption-input"]',
      title: t('tour.consumption.title'),
      description: t('tour.consumption.description')
    },
    {
      target: '[data-tour="view-toggle"]',
      title: t('tour.viewToggle.title'),
      description: t('tour.viewToggle.description')
    },
    {
      target: '[data-tour="hero-cards"]',
      title: t('tour.heroCards.title'),
      description: t('tour.heroCards.description')
    },
    {
      target: '[data-tour="monthly-chart"]',
      title: t('tour.monthlyChart.title'),
      description: t('tour.monthlyChart.description')
    },
    {
      target: '[data-tour="export-pdf"]',
      title: t('tour.exportSave.title'),
      description: t('tour.exportSave.description')
    }
  ]

  const {
    projectQuery,
    tariffQuery,
    locationQuery,
    buildingInsights,
    activePanels,
    panelsMissingMonthlyEnergy,
    selectedPanelModel,
    systemKwp,
    formState,
    setFormState,
    viewMode,
    setViewMode,
    selectedMonthIndex,
    setSelectedMonthIndex,
    monthTableOpen,
    setMonthTableOpen,
    simulation,
    analysisResults,
    chartData,
    selectedMonth,
    thresholdWarnings,
    phaseCapacityCapKw,
    costBreakdown,
    panelCostPerWp
  } = useAnalysisForm(projectId)

  const { isExporting, handleExportPdf } = useAnalysisPdf()

  const layoutOrientation = useMemo(
    () =>
      buildingInsights
        ? summarizeLayoutOrientation(
            activePanels,
            buildingInsights.solarPotential.solarPanels,
            buildingInsights.solarPotential.roofSegmentStats
          )
        : null,
    [activePanels, buildingInsights]
  )

  useEffect(() => {
    if (projectQuery.data?.status === 'draft' && projectId) {
      navigate(`/project/${projectId}/workbench`, { replace: true })
    }
  }, [navigate, projectId, projectQuery.data?.status])

  useEffect(() => {
    if (projectQuery.data?.id && projectQuery.data.status !== 'draft') {
      markProjectVisited(projectQuery.data.id)
    }
  }, [projectQuery.data?.id, projectQuery.data?.status])

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildSavePayload>) => saveAnalysis(projectId!, payload),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(['project', projectId], updatedProject)
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      notify.success(t('page.toast.saved'))
      navigate('/dashboard/projects')
    },
    onError: (error) => {
      notify.error(error instanceof Error ? error.message : t('page.toast.saveFailed'))
    }
  })

  async function handleSaveAnalysis() {
    if (!formState || !analysisResults) return
    await saveMutation.mutateAsync(buildSavePayload(formState, systemKwp, analysisResults))
  }

  if (projectQuery.isLoading || tariffQuery.isLoading || locationQuery.isLoading || !formState || !buildingInsights) {
    return (
      <LoadingOverlay
        hints={[
          t('page.loadingHints.loading'),
          t('page.loadingHints.tariff'),
          t('page.loadingHints.crunching')
        ]}
      />
    )
  }

  if (
    projectQuery.error ||
    tariffQuery.error ||
    locationQuery.error ||
    !simulation ||
    !analysisResults ||
    !projectQuery.data ||
    !tariffQuery.data
  ) {
    const error =
      projectQuery.error ??
      tariffQuery.error ??
      locationQuery.error ??
      new Error(t('page.error.incompleteData'))

    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t('page.error.title')}</CardTitle>
            <CardDescription>{t('page.error.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : t('page.error.unknown')}</p>
            <Button asChild variant="outline" size="sm" className="w-full justify-center gap-2">
              <Link to={`/project/${projectId}/workbench`}>{t('page.error.backToWorkbench')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const paybackProjections = buildNetBenefitSeries({
    year1Savings: simulation.totalSavingsRm,
    degradationRate: formState.degradationRate,
    years: 10,
    systemCostRm: formState.systemCostRm
  })
    .filter((projection) => projection.year === 1 || projection.year === 5 || projection.year === 10)
    .map((projection) => ({
      years: projection.year,
      netBenefit: projection.netBenefit
    }))
  const paybackTooltip = (
    <div className="space-y-2">
      <p>{t('page.paybackTooltip.intro')}</p>
      <div className="space-y-0.5 border-t border-primary-foreground/20 pt-2">
        <p className="text-primary-foreground/80">{t('page.paybackTooltip.netBenefitProjection')}</p>
        {paybackProjections.map((p) => (
          <div key={p.years} className="flex justify-between gap-4 tabular-nums">
            <span className="text-primary-foreground/80">{t('page.paybackTooltip.yearLabel', { count: p.years })}</span>
            <span className={`font-semibold ${p.netBenefit >= 0 ? '' : 'text-amber-300'}`}>
              {formatCurrency(p.netBenefit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <AppLayout>
      <GuidedTour storageKey="slg-tour-analysis" steps={ANALYSIS_TOUR_STEPS} />
      <PageContainer variant="mvp" className="gap-6 py-6">
        <AnalysisSidebar
          projectId={projectId}
          projectName={projectQuery.data.name}
          systemKwp={systemKwp}
          activePanelCount={activePanels.length}
          selectedPanelModel={selectedPanelModel}
          buildingInsights={buildingInsights}
          panelsMissingMonthlyEnergy={panelsMissingMonthlyEnergy}
          phaseCapacityCapKw={phaseCapacityCapKw}
          formState={formState}
          setFormState={setFormState}
          viewMode={viewMode}
          isExporting={isExporting}
          isSaving={saveMutation.isPending}
          onExportPdf={() => void handleExportPdf(projectId!, projectQuery.data.name)}
          onSaveAnalysis={() => void handleSaveAnalysis()}
          tariffRatesDefaults={tariffQuery.data.rates}
          tariffEffectiveDate={tariffQuery.data.effectiveDate}
        />

        <section className="min-w-0 flex-1 space-y-6 xl:overflow-y-auto">
          <div data-tour="view-toggle" className="inline-flex rounded-lg border border-border bg-card/90 p-1 shadow-sm">
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'simple' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('simple')}
            >
              {t('page.viewToggle.simple')}
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'advanced' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('advanced')}
            >
              {t('page.viewToggle.advanced')}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t('page.viewToggle.hint')}</p>

          <SortableCardContainer
            cards={[
              {
                id: 'solar-verdict',
                node: <SolarVerdict analysisResults={analysisResults} paybackTooltip={paybackTooltip} />
              },
              {
                id: 'bill-comparison',
                node: <BillComparisonChart chartData={chartData} />
              },
              ...(viewMode === 'advanced' && selectedMonth
                ? [
                    {
                      id: 'bill-breakdown',
                      node: (
                        <BillBreakdown
                          selectedMonthIndex={selectedMonthIndex}
                          onMonthSelect={setSelectedMonthIndex}
                          selectedMonth={selectedMonth}
                          thresholdWarnings={thresholdWarnings}
                        />
                      )
                    }
                  ]
                : []),
              ...(viewMode === 'advanced'
                ? [
                    {
                      id: 'month-table',
                      node: (
                        <MonthTable
                          simulation={simulation}
                          isOpen={monthTableOpen}
                          onToggle={() => setMonthTableOpen((prev) => !prev)}
                        />
                      )
                    }
                  ]
                : []),
              ...(viewMode === 'advanced'
                ? [
                    {
                      id: 'cumulative-savings',
                      node: (
                        <Card className="border-border bg-card/90 shadow-sm">
                          <CardHeader>
                            <CardTitle>
                              {t('page.cumulativeSavings.title')}
                              <InfoTooltip text={t('page.cumulativeSavings.titleTooltip')} />
                            </CardTitle>
                            <CardDescription>{t('page.cumulativeSavings.description')}</CardDescription>
                          </CardHeader>
                          <CardContent className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis width={70} tickFormatter={(value) => `RM${value}`} />
                                <Tooltip
                                  cursor={chartTooltipStyle.cursor}
                                  contentStyle={chartTooltipStyle.contentStyle}
                                  labelStyle={chartTooltipStyle.labelStyle}
                                  content={
                                    <ChartTooltipContent
                                      getItemClassName={(entry) =>
                                        entry.name === t('page.cumulativeSavings.seriesName')
                                          ? 'font-bold text-yellow-600 dark:text-yellow-400'
                                          : 'font-semibold text-foreground'
                                      }
                                    />
                                  }
                                />
                                <Line
                                  type="monotone"
                                  dataKey="cumulativeSavings"
                                  name={t('page.cumulativeSavings.seriesName')}
                                  stroke="#ca8a04"
                                  strokeWidth={3}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )
                    }
                  ]
                : []),
              {
                id: 'system-cost',
                node: (
                  <SystemCostCard
                    costBreakdown={costBreakdown}
                    activePanelCount={activePanels.length}
                    panelCapacityWp={selectedPanelModel?.capacityWp ?? 0}
                    panelCostPerWp={panelCostPerWp}
                    roofType={formState.roofType}
                  />
                )
              },
              ...(viewMode === 'advanced' && buildingInsights
                ? [
                    {
                      id: 'system-assumptions',
                      node: (
                        <SystemAssumptions
                          performanceRatio={formState.performanceRatio}
                          assumedLosses={formState.assumedLosses}
                          degradationRate={formState.degradationRate}
                          dcAcRatio={formState.dcAcRatio}
                          panelLifetimeYears={buildingInsights.solarPotential.panelLifetimeYears}
                          layoutOrientation={layoutOrientation}
                        />
                      )
                    }
                  ]
                : []),
              {
                id: 'net-benefit',
                node: (
                  <NetBenefitChart
                    year1Savings={simulation.totalSavingsRm}
                    degradationRate={formState.degradationRate}
                    systemCostRm={formState.systemCostRm}
                    tariffEscalationRate={formState.tariffEscalationRate}
                    analysisMode={formState.analysisMode ?? 'simple'}
                    annualMaintenanceRm={formState.annualMaintenanceRm ?? 0}
                    inverterReplacements={formState.inverterReplacements}
                  />
                )
              },
              {
                id: 'financial-roadmap',
                node: (
                  <FinancialRoadmap
                    systemCostRm={formState.systemCostRm}
                    paybackYears={analysisResults.paybackYears}
                    year1Savings={simulation.totalSavingsRm}
                    degradationRate={formState.degradationRate}
                    systemKwp={systemKwp}
                    tariffEscalationRate={formState.tariffEscalationRate}
                    analysisMode={formState.analysisMode ?? 'simple'}
                    annualMaintenanceRm={formState.annualMaintenanceRm ?? 0}
                    inverterReplacements={formState.inverterReplacements}
                  />
                )
              },
              {
                id: 'disclaimers',
                node: (
                  <Card className="border-border bg-card/90 shadow-sm">
                    <CardHeader>
                      <CardTitle>{t('page.disclaimers.title')}</CardTitle>
                      <CardDescription>{t('page.disclaimers.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      {ANALYSIS_DISCLAIMER_KEYS.map((key) => (
                        <p key={key}>{t(`disclaimers.${key}`)}</p>
                      ))}
                    </CardContent>
                  </Card>
                )
              }
            ]}
          />
        </section>
      </PageContainer>
    </AppLayout>
  )
}
