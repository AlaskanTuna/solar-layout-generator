import type { ProjectResponse } from '@/api/projects'
import {
  buildMonthlyBillChartData,
  computeDegradedSavings,
  normalizeInverterReplacements,
  summarizeLayoutOrientation,
  type AnalysisChartDataPoint,
  type AnalysisMode,
  type AnalysisResultsRecord,
  type InverterReplacement,
  type LayoutOrientationSummary
} from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { computeSystemCost, getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import type { CostBreakdown, RoofType } from '@shared/types'

export type PdfAnalysisViewModel = {
  analysisResults: AnalysisResultsRecord
  activePanelCount: number
  chartData: AnalysisChartDataPoint[]
  costBreakdown: CostBreakdown | null
  roofType: RoofType
  connectionPhase: 'single' | 'three'
  panelCapacityWp: number
  panelCostPerWp: number
  systemKwp: number
  systemCostRm: number
  degradationRate: number
  tariffEscalationRate: number
  performanceRatio: number
  assumedLosses: number
  dcAcRatio: number
  analysisMode: AnalysisMode
  annualMaintenanceRm: number
  inverterReplacements: InverterReplacement[]
  panelLifetimeYears: number | null
  layoutOrientation: LayoutOrientationSummary | null
  year1Savings: number
  peakMonthlyIdx: number
  peakMonthly: number
  avgMonthly: number
  year25DegradedCumulative: number
  year25NetBenefit: number
  breakEvenYear: number | null
}

export function buildPdfAnalysisViewModel(project: ProjectResponse): PdfAnalysisViewModel | null {
  const analysisResults = project.analysisResults
  if (!analysisResults) return null

  const activePanels = parsePanelEdits(project.editedLayout).filter((panel) => panel.status !== 'deleted')
  const panelModel = getPanelModel(project.analysisConfig?.selectedPanelModelId ?? DEFAULT_PANEL_MODEL_ID)
  const panelCapacityWp = panelModel?.capacityWp ?? 0
  const panelCostPerWp = panelModel?.costPerWp && panelModel.costPerWp > 0 ? panelModel.costPerWp : 0.95
  const systemKwp = Math.round(((activePanels.length * panelCapacityWp) / 1000) * 100) / 100
  const roofType = project.analysisConfig?.roofType ?? 'tile'
  const connectionPhase = project.analysisConfig?.connectionPhase ?? 'single'
  const degradationRate = project.analysisConfig?.degradationRate ?? 0.005
  const tariffEscalationRate = project.analysisConfig?.tariffEscalationRate ?? 0
  const performanceRatio = project.analysisConfig?.performanceRatio ?? 0.8
  const assumedLosses = project.analysisConfig?.assumedLosses ?? 0.2
  const dcAcRatio = project.analysisConfig?.dcAcRatio ?? 1.2
  const systemCostRm = project.analysisConfig?.systemCostRm ?? 0
  const analysisMode = project.analysisConfig?.analysisMode === 'lifecycle' ? 'lifecycle' : 'simple'
  const annualMaintenanceRm = project.analysisConfig?.annualMaintenanceRm ?? 0
  const inverterReplacements = normalizeInverterReplacements(
    project.analysisConfig?.inverterReplacements,
    project.analysisConfig?.inverterReplacementCostRm,
    project.analysisConfig?.inverterReplacementYear
  )

  const buildingInsights = project.location?.buildingInsightsJson
    ? parseBuildingInsights(project.location.buildingInsightsJson)
    : null
  const panelLifetimeYears = buildingInsights?.solarPotential.panelLifetimeYears ?? null
  const layoutOrientation = buildingInsights
    ? summarizeLayoutOrientation(
        activePanels,
        buildingInsights.solarPotential.solarPanels,
        buildingInsights.solarPotential.roofSegmentStats
      )
    : null

  const chartData = buildMonthlyBillChartData(analysisResults.monthlyBreakdown)
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
  const monthlySavings = analysisResults.monthlyBreakdown.map((month) => month.savingsRm)
  const peakMonthlyIdx = monthlySavings.reduce((bestIndex, value, index) => {
    return value > monthlySavings[bestIndex] ? index : bestIndex
  }, 0)
  const peakMonthly = monthlySavings[peakMonthlyIdx] ?? 0
  const avgMonthly = year1Savings / 12
  const year25DegradedCumulative = computeDegradedSavings(year1Savings, degradationRate, 25, tariffEscalationRate)
  const year25NetBenefit = year25DegradedCumulative - systemCostRm
  const breakEvenYear = analysisResults.paybackYears

  return {
    analysisResults,
    activePanelCount: activePanels.length,
    chartData,
    costBreakdown,
    roofType,
    connectionPhase,
    panelCapacityWp,
    panelCostPerWp,
    systemKwp,
    systemCostRm,
    degradationRate,
    tariffEscalationRate,
    performanceRatio,
    assumedLosses,
    dcAcRatio,
    analysisMode,
    annualMaintenanceRm,
    inverterReplacements,
    panelLifetimeYears,
    layoutOrientation,
    year1Savings,
    peakMonthlyIdx,
    peakMonthly,
    avgMonthly,
    year25DegradedCumulative,
    year25NetBenefit,
    breakEvenYear
  }
}
