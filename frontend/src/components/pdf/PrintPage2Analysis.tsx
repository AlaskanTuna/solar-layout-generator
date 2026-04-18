import type { ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProjectResponse } from '@/api/projects'
import type { AnalysisResultsRecord } from '@/lib/analysis'
import { ANALYSIS_DISCLAIMERS, MONTH_LABELS } from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { computeSystemCost, getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import { useTheme } from '@/hooks/useTheme'
import { getChartTooltipStyle } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SolarVerdict } from '@/components/analysis/SolarVerdict'
import { BillComparisonChart } from '@/components/analysis/BillComparisonChart'
import { SystemCostCard } from '@/components/analysis/SystemCostCard'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import { NetBenefitChart } from '@/components/analysis/NetBenefitChart'
import { SystemAssumptions } from '@/components/analysis/SystemAssumptions'
import { MonthTable } from '@/components/analysis/MonthTable'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import type { CardId } from './PrintReport'

type ChartDataPoint = { month: string; baselineBill: number; nemBill: number; cumulativeSavings: number }

type Props = {
  project: ProjectResponse
  cardOrder: CardId[]
}

function buildChartData(monthlyBreakdown: AnalysisResultsRecord['monthlyBreakdown']): ChartDataPoint[] {
  let cumulativeSavings = 0
  return monthlyBreakdown.map((month, index) => {
    cumulativeSavings += month.savingsRm
    return {
      month: MONTH_LABELS[index] ?? String(index + 1),
      baselineBill: month.baselineBill.total,
      nemBill: month.nemBill.total,
      cumulativeSavings: Math.round(cumulativeSavings * 100) / 100
    }
  })
}

function CumulativeSavingsCard({ chartData }: { chartData: ChartDataPoint[] }) {
  const { resolved } = useTheme()
  const tooltipStyle = getChartTooltipStyle(resolved)
  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>Cumulative Savings</CardTitle>
        <CardDescription>Total savings accumulated month by month over the year.</CardDescription>
      </CardHeader>
      <CardContent className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis width={70} tickFormatter={(v) => `RM${v}`} />
            <Tooltip
              cursor={tooltipStyle.cursor}
              contentStyle={tooltipStyle.contentStyle}
              labelStyle={tooltipStyle.labelStyle}
              content={<ChartTooltipContent />}
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
}

export function PrintPage2Analysis({ project, cardOrder }: Props) {
  const analysisResults = project.analysisResults
  if (!analysisResults) {
    return (
      <section className="pdf-page">
        <div className="rounded-lg border border-destructive bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-semibold">Analysis not saved</p>
          <p className="mt-2">Save the analysis on this project before exporting the PDF.</p>
        </div>
      </section>
    )
  }

  const activePanels = parsePanelEdits(project.editedLayout).filter((p) => p.status !== 'deleted')
  const panelModel = getPanelModel(project.analysisConfig?.selectedPanelModelId ?? DEFAULT_PANEL_MODEL_ID)
  const panelCapacityWp = panelModel?.capacityWp ?? 0
  const panelCostPerWp = panelModel?.costPerWp && panelModel.costPerWp > 0 ? panelModel.costPerWp : 0.95
  const systemKwp = Math.round(((activePanels.length * panelCapacityWp) / 1000) * 100) / 100
  const roofType = project.analysisConfig?.roofType ?? 'tile'
  const connectionPhase = project.analysisConfig?.connectionPhase ?? 'single'
  const degradationRate = project.analysisConfig?.degradationRate ?? 0.005
  const performanceRatio = project.analysisConfig?.performanceRatio ?? 0.8
  const assumedLosses = project.analysisConfig?.assumedLosses ?? 0.2
  const dcAcRatio = project.analysisConfig?.dcAcRatio ?? 1.2
  const systemCostRm = project.analysisConfig?.systemCostRm ?? 0
  const buildingInsights = project.location?.buildingInsightsJson
    ? parseBuildingInsights(project.location.buildingInsightsJson)
    : null
  const roofSegmentStats = buildingInsights?.solarPotential.roofSegmentStats ?? []

  // MonthTable expects AnnualSimulationResult; we reconstruct it from saved analysisResults.
  const simulation = {
    months: analysisResults.monthlyBreakdown,
    totalConsumptionKwh: analysisResults.annualTotals.totalConsumptionKwh,
    totalGenerationKwh: analysisResults.annualTotals.totalGenerationKwh,
    totalBaselineRm: analysisResults.annualTotals.totalBaselineRm,
    totalNemRm: analysisResults.annualTotals.totalNemRm,
    totalSavingsRm: analysisResults.annualTotals.totalSavingsRm,
    totalCreditsForfeited: analysisResults.annualTotals.totalCreditsForfeitedKwh
  }

  const chartData = buildChartData(analysisResults.monthlyBreakdown)
  const costBreakdown =
    activePanels.length > 0 && panelCapacityWp > 0
      ? computeSystemCost({
          panelCount: activePanels.length,
          panelWattageWp: panelCapacityWp,
          panelCostPerWp,
          roofType,
          supplyPhase: connectionPhase
        })
      : null

  const year1Savings = analysisResults.annualTotals.totalSavingsRm

  const cards: Partial<Record<CardId, ReactNode>> = {
    'solar-verdict': (
      <SolarVerdict
        analysisResults={analysisResults}
        paybackTooltip="Estimated time for accumulated savings to recover the system cost."
      />
    ),
    'bill-comparison': <BillComparisonChart chartData={chartData} />,
    'cumulative-savings': <CumulativeSavingsCard chartData={chartData} />,
    'system-cost': (
      <SystemCostCard
        costBreakdown={costBreakdown}
        activePanelCount={activePanels.length}
        panelCapacityWp={panelCapacityWp}
        panelCostPerWp={panelCostPerWp}
        roofType={roofType}
      />
    ),
    'financial-roadmap': (
      <FinancialRoadmap
        systemCostRm={systemCostRm}
        paybackYears={analysisResults.paybackYears}
        year1Savings={year1Savings}
        degradationRate={degradationRate}
        systemKwp={systemKwp}
      />
    ),
    'net-benefit': (
      <NetBenefitChart
        year1Savings={year1Savings}
        degradationRate={degradationRate}
        systemCostRm={systemCostRm}
        defaultYearRange={25}
      />
    ),
    'month-table': <MonthTable simulation={simulation} isOpen={true} onToggle={() => {}} />,
    'system-assumptions': (
      <SystemAssumptions
        performanceRatio={performanceRatio}
        assumedLosses={assumedLosses}
        degradationRate={degradationRate}
        dcAcRatio={dcAcRatio}
        panelLifetimeYears={buildingInsights?.solarPotential.panelLifetimeYears ?? null}
        roofSegmentStats={roofSegmentStats}
      />
    )
  }

  const rendered = cardOrder.map((id) => ({ id, node: cards[id] })).filter((entry) => entry.node !== undefined)

  return (
    <section className="pdf-page space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Analysis Details</h2>
        <p className="text-sm text-muted-foreground">
          Projected savings, cost breakdown, and financial roadmap based on the saved configuration.
        </p>
      </div>

      {rendered.map(({ id, node }) => (
        <div key={id} className="pdf-card-break">
          {node}
        </div>
      ))}

      <footer className="pdf-card-break mt-8 rounded-lg border border-border bg-muted/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
        <p className="mb-2 font-semibold text-foreground">Assumptions &amp; Disclaimers</p>
        <ul className="space-y-1.5">
          {ANALYSIS_DISCLAIMERS.map((line, i) => (
            <li key={i}>&middot; {line}</li>
          ))}
        </ul>
      </footer>
    </section>
  )
}
