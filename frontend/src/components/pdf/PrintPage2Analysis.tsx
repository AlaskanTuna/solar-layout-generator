import type { ReactNode } from 'react'
import type { ProjectResponse } from '@/api/projects'
import type { AnalysisResultsRecord } from '@/lib/analysis'
import { ANALYSIS_DISCLAIMERS, MONTH_LABELS } from '@/lib/analysis'
import { parsePanelEdits } from '@/lib/buildingInsights'
import { computeSystemCost, getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'

type ChartDataPoint = { month: string; baselineBill: number; nemBill: number; cumulativeSavings: number }
import { SolarVerdict } from '@/components/analysis/SolarVerdict'
import { BillComparisonChart } from '@/components/analysis/BillComparisonChart'
import { SystemCostCard } from '@/components/analysis/SystemCostCard'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import type { CardId } from './PrintReport'

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
  const systemCostRm = project.analysisConfig?.systemCostRm ?? 0

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
