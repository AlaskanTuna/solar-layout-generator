import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProjectResponse } from '@/api/projects'
import type { AnalysisResultsRecord } from '@/lib/analysis'
import { ANALYSIS_DISCLAIMERS, MONTH_LABELS, computeDegradedSavings } from '@/lib/analysis'
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
import { MonthTable } from '@/components/analysis/MonthTable'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import { formatCurrency } from '@/components/analysis/formatters'
import { PdfPageShell } from './PdfPageShell'
import type { CardId } from './PrintReport'

type ChartDataPoint = { month: string; baselineBill: number; nemBill: number; cumulativeSavings: number }

type Props = {
  project: ProjectResponse
  cardOrder: CardId[]
  generatedAt: string
}

function azimuthToCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
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

function SummaryTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {detail && <p className="text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

function SummaryCard({ title, tiles }: { title: string; tiles: { label: string; value: string; detail?: string }[] }) {
  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardContent className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <SummaryTile key={tile.label} {...tile} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PrintPage2Analysis({ project, generatedAt }: Props) {
  const { resolved } = useTheme()
  const tooltipStyle = getChartTooltipStyle(resolved)
  const analysisResults = project.analysisResults

  if (!analysisResults) {
    return (
      <PdfPageShell projectName={project.name} generatedAt={generatedAt} sectionLabel="Analysis" pageBreak={false}>
        <div className="rounded-lg border border-destructive bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-semibold">Analysis not saved</p>
          <p className="mt-2">Save the analysis on this project before exporting the PDF.</p>
        </div>
      </PdfPageShell>
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
  const panelLifetimeYears = buildingInsights?.solarPotential.panelLifetimeYears ?? null

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

  // Cumulative savings summary metrics
  const monthlySavings = analysisResults.monthlyBreakdown.map((m) => m.savingsRm)
  const peakMonthlyIdx = monthlySavings.reduce((best, v, i) => (v > monthlySavings[best] ? i : best), 0)
  const peakMonthly = monthlySavings[peakMonthlyIdx] ?? 0
  const avgMonthly = year1Savings / 12

  // Net benefit summary metrics (25-year window)
  const year25DegradedCumulative = Array.from({ length: 25 }, (_, i) =>
    computeDegradedSavings(year1Savings, degradationRate, i + 1)
  ).pop() ?? 0
  const year25NetBenefit = year25DegradedCumulative - systemCostRm
  const breakEvenYear = analysisResults.paybackYears

  const shell = (sectionLabel: string, context: string, children: React.ReactNode, pageBreak = true) => (
    <PdfPageShell
      projectName={project.name}
      generatedAt={generatedAt}
      sectionLabel={sectionLabel}
      context={context}
      pageBreak={pageBreak}
    >
      {children}
    </PdfPageShell>
  )

  return (
    <>
      {/* Page 2: Solar Verdict + Bill Comparison */}
      {shell(
        'Solar Verdict & Bill Comparison',
        'Headline savings at a glance, plus your estimated monthly bill with and without solar. Refer to the Month-by-Month Breakdown for detailed per-month cost detail.',
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="pdf-card-break">
            <SolarVerdict
              analysisResults={analysisResults}
              paybackTooltip="Estimated time for accumulated savings to recover the system cost."
            />
          </div>
          <div className="pdf-card-break min-h-0 flex-1">
            <BillComparisonChart chartData={chartData} />
          </div>
        </div>
      )}

      {/* Page 3: Month-by-Month Breakdown */}
      {shell(
        'Month-by-Month Breakdown',
        'Monthly consumption, solar generation, NEM credits applied, and resulting bill savings for each of the 12 calendar months.',
        <div className="min-h-0 flex-1">
          <MonthTable simulation={simulation} isOpen={true} onToggle={() => {}} />
        </div>
      )}

      {/* Page 4: Cumulative Savings + Summary */}
      {shell(
        'Cumulative Savings',
        'Running total of bill savings accumulated month-by-month from NEM credit offsets. Steeper lines indicate faster savings.',
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="pdf-card-break min-h-0 flex-1">
            <Card className="h-full border-border bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle>Cumulative Savings</CardTitle>
                <CardDescription>Total savings accumulated month by month over the year.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 8, right: 20, top: 10, bottom: 0 }}>
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
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title="Summary"
              tiles={[
                { label: 'Peak month savings', value: formatCurrency(peakMonthly), detail: MONTH_LABELS[peakMonthlyIdx] },
                { label: 'Average month savings', value: formatCurrency(avgMonthly), detail: 'over 12 months' },
                { label: 'Year 1 total savings', value: formatCurrency(year1Savings), detail: 'cumulative' }
              ]}
            />
          </div>
        </div>
      )}

      {/* Page 5: System Cost + decomposed System Assumptions */}
      {shell(
        'System Cost & Assumptions',
        'Bottom-up turnkey cost plus the technical parameters used to compute your savings projection.',
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="pdf-card-break">
            <SystemCostCard
              costBreakdown={costBreakdown}
              activePanelCount={activePanels.length}
              panelCapacityWp={panelCapacityWp}
              panelCostPerWp={panelCostPerWp}
              roofType={roofType}
            />
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title="System Assumptions"
              tiles={[
                {
                  label: 'Performance ratio',
                  value: `${Math.round(performanceRatio * 100)}%`,
                  detail: 'MY residential typical'
                },
                {
                  label: 'Assumed losses',
                  value: `${Math.round(assumedLosses * 100)}%`,
                  detail: 'soiling, wiring, heat'
                },
                {
                  label: 'Panel degradation',
                  value: `${(degradationRate * 100).toFixed(1)}%/yr`,
                  detail: 'annual output decline'
                },
                {
                  label: 'DC/AC ratio',
                  value: String(dcAcRatio),
                  detail: 'inverter sizing'
                },
                panelLifetimeYears != null
                  ? {
                      label: 'Panel lifetime',
                      value: `${panelLifetimeYears} yrs`,
                      detail: 'from Solar API'
                    }
                  : null,
                roofSegmentStats.length > 0
                  ? {
                      label: 'Roof azimuth / pitch',
                      value: `${Math.round(roofSegmentStats[0].azimuthDegrees)}° ${azimuthToCompass(roofSegmentStats[0].azimuthDegrees)} / ${Math.round(roofSegmentStats[0].pitchDegrees)}°`,
                      detail: 'primary segment'
                    }
                  : null
              ].filter((t) => t !== null)}
            />
          </div>
        </div>
      )}

      {/* Page 6: Net Benefit Projection + Summary */}
      {shell(
        'Net Benefit Projection',
        'Cumulative solar savings minus your upfront system cost over 25 years. Green bars indicate years where you are in net profit after break-even.',
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="pdf-card-break min-h-0 flex-1">
            <NetBenefitChart
              year1Savings={year1Savings}
              degradationRate={degradationRate}
              systemCostRm={systemCostRm}
              defaultYearRange={25}
            />
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title="Summary"
              tiles={[
                {
                  label: 'Break-even',
                  value: breakEvenYear !== null ? `${breakEvenYear.toFixed(1)} yrs` : '—',
                  detail: 'payback period'
                },
                {
                  label: 'Year 25 net benefit',
                  value: formatCurrency(year25NetBenefit),
                  detail: 'after subtracting cost'
                },
                {
                  label: 'Year 25 gross savings',
                  value: formatCurrency(year25DegradedCumulative),
                  detail: 'with degradation'
                }
              ]}
            />
          </div>
        </div>
      )}

      {/* Page 7: Financial Roadmap */}
      {shell(
        'Financial Roadmap',
        'Key financial milestones over your system\'s expected 25-year lifetime.',
        <div className="min-h-0 flex-1">
          <FinancialRoadmap
            systemCostRm={systemCostRm}
            paybackYears={analysisResults.paybackYears}
            year1Savings={year1Savings}
            degradationRate={degradationRate}
            systemKwp={systemKwp}
          />
        </div>
      )}

      {/* Page 8: Disclaimers */}
      {shell(
        'Assumptions & Disclaimers',
        '',
        <div className="min-h-0 flex-1 rounded-lg border border-border bg-muted/30 p-5 text-[11px] leading-relaxed text-muted-foreground">
          <p className="mb-3 text-sm font-semibold text-foreground">Assumptions &amp; Disclaimers</p>
          <ul className="space-y-2">
            {ANALYSIS_DISCLAIMERS.map((line, i) => (
              <li key={i}>&middot; {line}</li>
            ))}
          </ul>
        </div>,
        false
      )}
    </>
  )
}
