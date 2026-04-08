import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { notify } from '@/components/ui/toastConfig'
import { saveAnalysis } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ANALYSIS_DISCLAIMERS,
  computeDegradedSavings,
  type AnalysisConfig,
  type AnalysisResultsRecord
} from '@/lib/analysis'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { GuidedTour, type TourStep } from '@/components/ui/GuidedTour'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/components/analysis/formatters'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import { getChartTooltipStyle } from '@/lib/constants'
import { HeroMetrics } from '@/components/analysis/HeroMetrics'
import { BillComparisonChart } from '@/components/analysis/BillComparisonChart'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import { NetBenefitChart } from '@/components/analysis/NetBenefitChart'
import { BillBreakdown } from '@/components/analysis/BillBreakdown'
import { MonthTable } from '@/components/analysis/MonthTable'
import { SystemAssumptions } from '@/components/analysis/SystemAssumptions'
import { SortableCardContainer } from '@/components/analysis/SortableCardContainer'
import SimplePdfReport from '@/components/analysis/SimplePdfReport'
import AdvancedPdfReport from '@/components/analysis/AdvancedPdfReport'
import { AnalysisSidebar } from '@/components/analysis/AnalysisSidebar'
import { useAnalysisForm, type AnalysisFormState } from '@/hooks/useAnalysisForm'
import { useAnalysisPdf } from '@/hooks/useAnalysisPdf'

const ANALYSIS_TOUR_STEPS: TourStep[] = [
  {
    title: 'Your Solar Savings Analysis',
    description:
      'This page calculates how much you could save on your TNB electricity bill with solar panels. All numbers update live as you change the inputs on the left.'
  },
  {
    target: '[data-tour="consumption-input"]',
    title: 'Enter Your Electricity Usage',
    description:
      'This is the most important input. Find your average monthly kWh on your TNB bill (look for "Purata Penggunaan") and enter it here. Tap the info icon to see an example bill.'
  },
  {
    target: '[data-tour="view-toggle"]',
    title: 'Simple vs Advanced',
    description:
      'Start with Simple view for a quick summary. Switch to Advanced when you want detailed tariff breakdowns, bill components, and system assumptions you can customise.'
  },
  {
    target: '[data-tour="hero-cards"]',
    title: 'Key Numbers at a Glance',
    description:
      "These four cards tell you everything you need to know: how much you save each month, how much per year, how long until the system pays for itself, and how much CO2 you're offsetting."
  },
  {
    target: '[data-tour="monthly-chart"]',
    title: 'Monthly Bill Comparison',
    description:
      "This chart compares what you'd pay without solar (orange) to what you'd pay with solar (green) for each month. The difference is your savings."
  },
  {
    target: '[data-tour="export-pdf"]',
    title: 'Export & Save',
    description:
      'When you\'re happy with the results, click "Save Analysis" to store your settings, or "Export PDF" to download a report you can share with solar installers or your family.'
  }
]

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
    phaseCapacityCapKw
  } = useAnalysisForm(projectId)

  const { reportRef, simpleReportRef, isExporting, handleExportPdf } = useAnalysisPdf()

  useEffect(() => {
    if (projectQuery.data?.status === 'draft' && projectId) {
      navigate(`/project/${projectId}/workbench`, { replace: true })
    }
  }, [navigate, projectId, projectQuery.data?.status])

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildSavePayload>) => saveAnalysis(projectId!, payload),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(['project', projectId], updatedProject)
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      notify.success('Analysis saved to your project')
      navigate('/dashboard')
    },
    onError: (error) => {
      notify.error(error instanceof Error ? error.message : 'Failed to save the analysis')
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
          'Loading your analysis...',
          'Preparing tariff data...',
          'Crunching the numbers for your solar savings...'
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
    !projectQuery.data
  ) {
    const error =
      projectQuery.error ??
      tariffQuery.error ??
      locationQuery.error ??
      new Error('The analysis data is incomplete. Return to the workbench and save the layout again.')

    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Analysis Unavailable</CardTitle>
            <CardDescription>We couldn&apos;t prepare the billing simulation for this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button asChild variant="outline" size="sm" className="w-full justify-center gap-2">
              <Link to={`/project/${projectId}/workbench`}>Back to Workbench</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const paybackTooltip = `How many years until your savings cover the cost of installing the system.\n\nNet benefit projections:\n1-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 1) - formState.systemCostRm)}\n5-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 5) - formState.systemCostRm)}\n10-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 10) - formState.systemCostRm)}`

  return (
    <AppLayout>
      <GuidedTour storageKey="slg-tour-analysis" steps={ANALYSIS_TOUR_STEPS} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 xl:h-[calc(100vh-3.5rem)] xl:flex-row">
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
          onExportPdf={() => void handleExportPdf(viewMode, projectQuery.data.name)}
          onSaveAnalysis={() => void handleSaveAnalysis()}
        />

        {/* Main Content */}
        <section className="min-w-0 flex-1 space-y-6 xl:overflow-y-auto">
          <div data-tour="view-toggle" className="inline-flex rounded-lg border border-border bg-card/90 p-1 shadow-sm">
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'simple' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'advanced' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('advanced')}
            >
              Advanced
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Simple shows key savings figures. Advanced adds tariff breakdowns, projections, and system details.
          </p>

          <SortableCardContainer
            cards={[
              {
                id: 'hero-metrics',
                node: <HeroMetrics analysisResults={analysisResults} paybackTooltip={paybackTooltip} />
              },
              {
                id: 'bill-comparison',
                node: <BillComparisonChart chartData={chartData} />
              },
              ...(viewMode === 'advanced'
                ? [
                    {
                      id: 'cumulative-savings',
                      node: (
                        <Card className="border-border bg-card/90 shadow-sm">
                          <CardHeader>
                            <CardTitle>
                              Cumulative Savings
                              <InfoTooltip text="Shows your running total of savings throughout the year. The steeper the line, the faster you're saving money from solar." />
                            </CardTitle>
                            <CardDescription>Total savings accumulated month by month over the year.</CardDescription>
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
                                        entry.name === 'Cumulative Savings'
                                          ? 'font-bold text-yellow-600 dark:text-yellow-400'
                                          : 'font-semibold text-foreground'
                                      }
                                    />
                                  }
                                />
                                <Line
                                  type="monotone"
                                  dataKey="cumulativeSavings"
                                  name="Cumulative Savings"
                                  stroke="#ca8a04"
                                  strokeWidth={3}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )
                    },
                    {
                      id: 'net-benefit',
                      node: (
                        <NetBenefitChart
                          year1Savings={simulation.totalSavingsRm}
                          degradationRate={formState.degradationRate}
                          systemCostRm={formState.systemCostRm}
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
                        />
                      )
                    },
                    ...(buildingInsights
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
                                roofSegmentStats={buildingInsights.solarPotential.roofSegmentStats}
                              />
                            )
                          }
                        ]
                      : []),
                    ...(selectedMonth
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
              {
                id: 'disclaimers',
                node: (
                  <Card className="border-border bg-card/90 shadow-sm">
                    <CardHeader>
                      <CardTitle>Financial Disclaimers</CardTitle>
                      <CardDescription>All bill and savings figures should be treated as estimates.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      {ANALYSIS_DISCLAIMERS.map((disclaimer) => (
                        <p key={disclaimer}>{disclaimer}</p>
                      ))}
                    </CardContent>
                  </Card>
                )
              }
            ]}
          />
        </section>
      </div>

      <SimplePdfReport
        ref={simpleReportRef}
        projectName={projectQuery.data.name}
        analysisResults={analysisResults}
        simulation={simulation}
        activePanelCount={activePanels.length}
        systemKwp={systemKwp}
        systemCostRm={formState.systemCostRm}
      />

      <AdvancedPdfReport
        ref={reportRef}
        projectName={projectQuery.data.name}
        analysisResults={analysisResults}
        simulation={simulation}
        chartData={chartData}
        activePanelCount={activePanels.length}
        systemKwp={systemKwp}
        selectedPanelModel={selectedPanelModel}
        formState={formState}
        location={projectQuery.data.location}
      />
    </AppLayout>
  )
}
