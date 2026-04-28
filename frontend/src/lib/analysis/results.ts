import type { TariffThresholds } from '@shared/types'
import type { AnnualSimulationResult, NemMonthResult } from '../billingEngine'
import type { AnalysisMode, InverterReplacement } from './config'
import { computeDegradedSavings, normalizeInverterReplacements } from './projections'

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

export type NemFit = 'good' | 'moderate' | 'oversized'

export type NemFitClassification = {
  fit: NemFit
  detail: string
  generationRatio: number
  forfeitureRate: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function classifyNemFit(input: {
  totalConsumptionKwh: number
  totalGenerationKwh: number
  totalCreditsForfeitedKwh: number
}): NemFitClassification {
  const { totalConsumptionKwh, totalGenerationKwh, totalCreditsForfeitedKwh } = input

  const generationRatio = totalConsumptionKwh > 0 ? totalGenerationKwh / totalConsumptionKwh : 0
  const forfeitureRate = totalGenerationKwh > 0 ? totalCreditsForfeitedKwh / totalGenerationKwh : 0

  let fit: NemFit
  let detail: string

  if (generationRatio <= 0.9 && forfeitureRate <= 0.05) {
    fit = 'good'
    detail = 'Low unused credits'
  } else if (generationRatio <= 1.1 && forfeitureRate <= 0.15) {
    fit = 'moderate'
    detail = 'Some credit buildup'
  } else {
    fit = 'oversized'
    detail = 'Excess credits likely'
  }

  return { fit, detail, generationRatio, forfeitureRate }
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
