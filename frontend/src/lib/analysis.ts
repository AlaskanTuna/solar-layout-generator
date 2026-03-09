import type { PanelEdit, TariffThresholds } from '@shared/types'
import type { AnnualSimulationResult, NemMonthResult } from './billingEngine'

export type ConnectionPhase = 'single' | 'three'

export type AnalysisConfig = {
  monthlyConsumptionKwh: number
  connectionPhase: ConnectionPhase
  systemCostRm: number
  afaRateSenPerKwh: number
  systemKwp: number
}

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
  carbonOffsetKg: number
  activePanelCount: number
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const ANALYSIS_DISCLAIMERS = [
  'Estimates are based on published TNB tariff rates under Regulatory Period 4 (effective 1 July 2025) and NEM Rakyat 3.0 rules. Actual bills may vary due to billing cycle length, meter reading dates, and tariff adjustments.',
  'The Automatic Fuel Adjustment (AFA) rate changes monthly. Estimates use the latest known rate and may not reflect future changes.',
  'PETRA has indicated that Energy Efficiency Incentive (EEI) rates may be adjusted for NEM users. Current calculations use standard EEI rates pending official modification.',
  'Solar generation estimates are based on average irradiance data. Actual output varies with weather, shading, panel orientation, soiling, and equipment condition.',
  'Excess credits are forfeited at the end of each calendar year. No cash payment is made for unused credits.'
]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getConnectionPhase(value: unknown): ConnectionPhase | null {
  return value === 'single' || value === 'three' ? value : null
}

export function aggregateMonthlyGeneration(activePanels: PanelEdit[]): number[] {
  const totals = Array.from({ length: 12 }, () => 0)

  for (const panel of activePanels) {
    for (let index = 0; index < 12; index += 1) {
      totals[index] += panel.monthlyEnergyDcKwh[index] ?? 0
    }
  }

  return totals.map((value) => round2(value))
}

export function parseSavedAnalysisConfig(raw: unknown): Partial<AnalysisConfig> | null {
  if (!isRecord(raw)) {
    return null
  }

  const monthlyConsumptionKwh = getNumber(raw.monthlyConsumptionKwh)
  const connectionPhase = getConnectionPhase(raw.connectionPhase)
  const systemCostRm = getNumber(raw.systemCostRm)
  const afaRateSenPerKwh = getNumber(raw.afaRateSenPerKwh)
  const systemKwp = getNumber(raw.systemKwp)

  return {
    ...(monthlyConsumptionKwh !== null ? { monthlyConsumptionKwh } : {}),
    ...(connectionPhase ? { connectionPhase } : {}),
    ...(systemCostRm !== null ? { systemCostRm } : {}),
    ...(afaRateSenPerKwh !== null ? { afaRateSenPerKwh } : {}),
    ...(systemKwp !== null ? { systemKwp } : {})
  }
}

export function buildAnalysisResults({
  simulation,
  systemCostRm,
  carbonOffsetFactorKgPerMwh,
  activePanelCount
}: {
  simulation: AnnualSimulationResult
  systemCostRm: number
  carbonOffsetFactorKgPerMwh: number
  activePanelCount: number
}): AnalysisResultsRecord {
  const averageMonthlySavingsRm = round2(simulation.totalSavingsRm / 12)
  const averageMonthlySavingsPct =
    simulation.totalBaselineRm > 0 ? round2((simulation.totalSavingsRm / simulation.totalBaselineRm) * 100) : 0
  const paybackYears = simulation.totalSavingsRm > 0 ? round2(systemCostRm / simulation.totalSavingsRm) : null
  const tenYearNetBenefitRm = round2(simulation.totalSavingsRm * 10 - systemCostRm)
  const tenYearRoiPercent =
    systemCostRm > 0 ? round2(((simulation.totalSavingsRm * 10 - systemCostRm) / systemCostRm) * 100) : null
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
      `This month drops below ${thresholds.retailWaiver} kWh after NEM offset, so retail charge, AFA, and SST are waived.`
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
