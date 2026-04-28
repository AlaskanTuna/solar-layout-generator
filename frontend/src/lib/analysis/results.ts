import type { TariffThresholds } from '@shared/types'
import type { AnnualSimulationResult, NemMonthResult } from '../billingEngine'
import type { AnalysisMode, InverterReplacement } from './config'
import { computeDegradedSavings, normalizeInverterReplacements } from './projections'

/**
 * Persisted output of the analysis run — saved on `Project.analysisResults` and re-read by both
 * the live AnalysisPage and the PDF preview. Holds the 12-month breakdown plus every aggregate
 * tile/chart needs (savings, payback, net benefit, CO2).
 */
export type AnalysisResultsRecord = {
  monthlyBreakdown: NemMonthResult[]
  annualTotals: {
    totalConsumptionKwh: number
    totalGenerationKwh: number
    totalBaselineRm: number
    totalNemRm: number
    totalSavingsRm: number
    totalCreditsForfeitedKwh: number
  }
  averageMonthlySavingsRm: number
  averageMonthlySavingsPct: number
  paybackYears: number | null
  tenYearNetBenefitRm: number
  tenYearRoiPercent: number | null
  twentyFiveYearNetBenefitRm: number
  simplePaybackYears: number | null
  simpleTwentyFiveYearNetBenefitRm: number
  lifecyclePaybackYears: number | null
  lifecycleTwentyFiveYearNetBenefitRm: number
  analysisMode: AnalysisMode
  carbonOffsetKg: number
  activePanelCount: number
}

/** Coarse fit category between system size and household consumption used to pick verdict copy. */
export type NemFit = 'lean' | 'balanced' | 'oversized'

/** Output of {@link classifyNemFit} — the qualitative fit plus the underlying rate metrics. */
export type NemFitClassification = {
  fit: NemFit
  detail: string
  billableImportRate: number
  monthlyExportRate: number
  forfeitureRate: number
}

/** Aggregate kWh + ratio metrics produced by {@link computeNemFitMetrics} and consumed by {@link classifyNemFit}. */
export type NemFitMetrics = {
  totalConsumptionKwh: number
  totalGenerationKwh: number
  totalBillableImportKwh: number
  totalMonthlyExportKwh: number
  totalCreditsForfeitedKwh: number
  billableImportRate: number
  monthlyExportRate: number
  forfeitureRate: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Aggregates the 12 monthly NEM results into the kWh totals and ratios used to classify the fit.
 *
 * @param monthlyBreakdown - Output of the per-month NEM simulation
 * @returns {@link NemFitMetrics} with 2dp-rounded kWh totals plus rate fractions in [0, 1]
 */
export function computeNemFitMetrics(monthlyBreakdown: NemMonthResult[]): NemFitMetrics {
  const totalConsumptionKwh = monthlyBreakdown.reduce((sum, month) => sum + month.consumptionKwh, 0)
  const totalGenerationKwh = monthlyBreakdown.reduce((sum, month) => sum + month.generationKwh, 0)
  const totalBillableImportKwh = monthlyBreakdown.reduce((sum, month) => sum + month.billableKwh, 0)
  const totalMonthlyExportKwh = monthlyBreakdown.reduce(
    (sum, month) => sum + Math.max(0, month.generationKwh - month.consumptionKwh),
    0
  )
  const totalCreditsForfeitedKwh = monthlyBreakdown.reduce((sum, month) => sum + month.creditForfeited, 0)

  const billableImportRate = totalConsumptionKwh > 0 ? totalBillableImportKwh / totalConsumptionKwh : 0
  const monthlyExportRate = totalGenerationKwh > 0 ? totalMonthlyExportKwh / totalGenerationKwh : 0
  const forfeitureRate = totalGenerationKwh > 0 ? totalCreditsForfeitedKwh / totalGenerationKwh : 0

  return {
    totalConsumptionKwh: round2(totalConsumptionKwh),
    totalGenerationKwh: round2(totalGenerationKwh),
    totalBillableImportKwh: round2(totalBillableImportKwh),
    totalMonthlyExportKwh: round2(totalMonthlyExportKwh),
    totalCreditsForfeitedKwh: round2(totalCreditsForfeitedKwh),
    billableImportRate,
    monthlyExportRate,
    forfeitureRate
  }
}

/**
 * Buckets a system into `lean`/`balanced`/`oversized` from its NEM rate metrics.
 * Thresholds: oversized when forfeit > 15% or export > 35%; balanced when import ≤ 25%, export ≤ 20%, forfeit ≤ 5%; otherwise lean.
 *
 * @param metrics - Output of {@link computeNemFitMetrics}
 * @returns Fit classification with the underlying rates passed through
 */
export function classifyNemFit(metrics: NemFitMetrics): NemFitClassification {
  const { billableImportRate, monthlyExportRate, forfeitureRate } = metrics

  let fit: NemFit
  let detail: string

  if (forfeitureRate > 0.15 || monthlyExportRate > 0.35) {
    fit = 'oversized'
    detail = 'Excess credits likely'
  } else if (billableImportRate <= 0.25 && monthlyExportRate <= 0.2 && forfeitureRate <= 0.05) {
    fit = 'balanced'
    detail = 'Matched to usage'
  } else {
    fit = 'lean'
    detail = 'Fast payback, grid backup'
  }

  return { fit, detail, billableImportRate, monthlyExportRate, forfeitureRate }
}

function computeSimplePaybackYears(
  year1Savings: number,
  systemCostRm: number,
  degradationRate: number,
  tariffEscalationRate: number
): number | null {
  if (year1Savings <= 0) return null

  let cumulative = 0
  for (let year = 1; year <= 50; year++) {
    const yearSavings =
      year1Savings * Math.pow(1 - degradationRate, year - 1) * Math.pow(1 + tariffEscalationRate, year - 1)
    cumulative += yearSavings

    if (cumulative >= systemCostRm) {
      return round2(year - 1 + (systemCostRm - (cumulative - yearSavings)) / yearSavings)
    }
  }

  return null
}

function computeLifecyclePaybackYears({
  year1Savings,
  systemCostRm,
  degradationRate,
  tariffEscalationRate,
  annualMaintenanceRm,
  replacements,
  simplePaybackYears
}: {
  year1Savings: number
  systemCostRm: number
  degradationRate: number
  tariffEscalationRate: number
  annualMaintenanceRm: number
  replacements: InverterReplacement[]
  simplePaybackYears: number | null
}): number | null {
  if (year1Savings <= 0) return null

  if (annualMaintenanceRm <= 0 && replacements.length === 0) {
    return simplePaybackYears
  }

  let cumulative = 0
  for (let year = 1; year <= 50; year++) {
    const yearSavings =
      year1Savings * Math.pow(1 - degradationRate, year - 1) * Math.pow(1 + tariffEscalationRate, year - 1)
    const yearNet = yearSavings - annualMaintenanceRm
    cumulative += yearNet

    const replacementCostByThisYear = replacements
      .filter((replacement) => replacement.year <= year)
      .reduce((sum, replacement) => sum + replacement.costRm, 0)
    const totalCost = systemCostRm + replacementCostByThisYear

    if (cumulative >= totalCost) {
      return round2(year - 1 + (totalCost - (cumulative - yearNet)) / yearNet)
    }
  }

  return null
}

/**
 * Top-level analysis builder — turns a 12-month NEM simulation into the full {@link AnalysisResultsRecord}.
 * Computes both `simple` and `lifecycle` payback / net-benefit tracks so the UI can switch modes
 * without rerunning the simulation.
 *
 * @param options - Simulation results + cost / degradation / lifecycle assumptions
 * @returns Persisted-shape analysis record consumed by AnalysisPage and the PDF preview
 */
export function buildAnalysisResults({
  simulation,
  systemCostRm,
  carbonOffsetFactorKgPerMwh,
  activePanelCount,
  degradationRate = 0.005,
  tariffEscalationRate = 0,
  analysisMode = 'simple',
  annualMaintenanceRm = 0,
  inverterReplacements,
  inverterReplacementCostRm,
  inverterReplacementYear
}: {
  simulation: AnnualSimulationResult
  systemCostRm: number
  carbonOffsetFactorKgPerMwh: number
  activePanelCount: number
  degradationRate?: number
  tariffEscalationRate?: number
  analysisMode?: AnalysisMode
  annualMaintenanceRm?: number
  inverterReplacements?: InverterReplacement[]
  inverterReplacementCostRm?: number
  inverterReplacementYear?: number
}): AnalysisResultsRecord {
  const replacements = normalizeInverterReplacements(
    inverterReplacements,
    inverterReplacementCostRm,
    inverterReplacementYear
  )

  const year1Savings = simulation.totalSavingsRm
  const averageMonthlySavingsRm = round2(year1Savings / 12)
  const averageMonthlySavingsPct =
    simulation.totalBaselineRm > 0 ? round2((year1Savings / simulation.totalBaselineRm) * 100) : 0

  const simplePaybackYears = computeSimplePaybackYears(
    year1Savings,
    systemCostRm,
    degradationRate,
    tariffEscalationRate
  )

  const lifecyclePaybackYears = computeLifecyclePaybackYears({
    year1Savings,
    systemCostRm,
    degradationRate,
    tariffEscalationRate,
    annualMaintenanceRm,
    replacements,
    simplePaybackYears
  })

  const tenYearSavings = computeDegradedSavings(year1Savings, degradationRate, 10, tariffEscalationRate)
  const tenYearNetBenefitRm = round2(tenYearSavings - systemCostRm)
  const tenYearRoiPercent = systemCostRm > 0 ? round2(((tenYearSavings - systemCostRm) / systemCostRm) * 100) : null

  const twentyFiveYearGrossSavings = computeDegradedSavings(year1Savings, degradationRate, 25, tariffEscalationRate)
  const simpleTwentyFiveYearNetBenefitRm = round2(twentyFiveYearGrossSavings - systemCostRm)
  const replacementsWithin25Years = replacements
    .filter((replacement) => replacement.year <= 25)
    .reduce((sum, replacement) => sum + replacement.costRm, 0)
  const lifecycleTwentyFiveYearNetBenefitRm = round2(
    twentyFiveYearGrossSavings - systemCostRm - 25 * annualMaintenanceRm - replacementsWithin25Years
  )

  const paybackYears = analysisMode === 'lifecycle' ? lifecyclePaybackYears : simplePaybackYears
  const twentyFiveYearNetBenefitRm =
    analysisMode === 'lifecycle' ? lifecycleTwentyFiveYearNetBenefitRm : simpleTwentyFiveYearNetBenefitRm
  const carbonOffsetKg = round2((simulation.totalGenerationKwh / 1000) * carbonOffsetFactorKgPerMwh)

  return {
    monthlyBreakdown: simulation.months,
    annualTotals: {
      totalConsumptionKwh: simulation.totalConsumptionKwh,
      totalGenerationKwh: simulation.totalGenerationKwh,
      totalBaselineRm: simulation.totalBaselineRm,
      totalNemRm: simulation.totalNemRm,
      totalSavingsRm: simulation.totalSavingsRm,
      totalCreditsForfeitedKwh: simulation.totalCreditsForfeited
    },
    averageMonthlySavingsRm,
    averageMonthlySavingsPct,
    paybackYears,
    tenYearNetBenefitRm,
    tenYearRoiPercent,
    twentyFiveYearNetBenefitRm,
    simplePaybackYears,
    simpleTwentyFiveYearNetBenefitRm,
    lifecyclePaybackYears,
    lifecycleTwentyFiveYearNetBenefitRm,
    analysisMode,
    carbonOffsetKg,
    activePanelCount
  }
}

/**
 * Surfaces tariff-tier "cliff avoided" warnings for a month — e.g. when NEM offset
 * drops billable kWh below the retail/AFA/SST waiver line so those charges are skipped,
 * or below the energy cliff so the lower per-kWh rate applies.
 *
 * @param month - One row of the monthly NEM breakdown
 * @param thresholds - Active tariff thresholds (retailWaiver, afaWaiver, sstExemption, energyCliff)
 * @returns Zero or more user-facing warning strings (already pluralized + tariff-aware)
 */
export function buildThresholdWarnings(month: NemMonthResult, thresholds: TariffThresholds): string[] {
  const warnings: string[] = []

  const crossesBelow = (threshold: number) => month.consumptionKwh > threshold && month.billableKwh <= threshold
  const retailTriggered = crossesBelow(thresholds.retailWaiver)
  const afaTriggered = crossesBelow(thresholds.afaWaiver)
  const sstTriggered = crossesBelow(thresholds.sstExemption)

  if (
    retailTriggered &&
    afaTriggered &&
    sstTriggered &&
    thresholds.retailWaiver === thresholds.afaWaiver &&
    thresholds.afaWaiver === thresholds.sstExemption
  ) {
    warnings.push(
      `This month drops below ${thresholds.retailWaiver} kWh after NEM offset, so retail charge, AFA and SST are waived.`
    )
  } else {
    if (retailTriggered) {
      warnings.push(
        `This month drops below ${thresholds.retailWaiver} kWh after NEM offset, so the retail charge is waived.`
      )
    }

    if (afaTriggered) {
      warnings.push(`This month drops below ${thresholds.afaWaiver} kWh after NEM offset, so AFA is waived.`)
    }

    if (sstTriggered) {
      warnings.push(`This month drops below ${thresholds.sstExemption} kWh after NEM offset, so SST is waived.`)
    }
  }

  if (month.consumptionKwh > thresholds.energyCliff && month.billableKwh <= thresholds.energyCliff) {
    warnings.push(
      `This month avoids the ${thresholds.energyCliff} kWh threshold cliff, keeping the lower energy charge on all billable kWh.`
    )
  }

  return warnings
}
