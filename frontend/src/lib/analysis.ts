import type { PanelEdit, TariffThresholds } from '@shared/types'
import type { AnnualSimulationResult, NemMonthResult } from './billingEngine'

export type ConnectionPhase = 'single' | 'three'

export type AnalysisConfig = {
  monthlyConsumptionKwh: number
  connectionPhase: ConnectionPhase
  systemCostRm: number
  afaRateSenPerKwh: number
  systemKwp: number
  degradationRate: number // e.g. 0.005 = 0.5%/year
  consumptionProfile: ConsumptionProfile
  performanceRatio: number // e.g. 0.80 = 80%
  assumedLosses: number // e.g. 0.20 = 20%
  dcAcRatio: number // e.g. 1.2
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

export type ConsumptionProfile = 'flat' | 'seasonal'

/**
 * Malaysian seasonal monthly multipliers for residential electricity consumption.
 * Based on typical patterns: higher AC usage during hot dry months (Mar–Jun),
 * moderate during transition (Jul–Oct), lower during northeast monsoon (Nov–Feb).
 * Normalised so the 12-month average equals 1.0 (annual total unchanged).
 */
export const SEASONAL_MULTIPLIERS: readonly number[] = [
  0.93, // Jan — monsoon, cooler
  0.95, // Feb — monsoon tail
  1.08, // Mar — hot dry season starts
  1.1, // Apr — peak hot season
  1.1, // May — peak hot season
  1.08, // Jun — hot, school holidays
  1.02, // Jul — transition
  1.0, // Aug — transition
  0.98, // Sep — transition
  0.95, // Oct — monsoon onset
  0.9, // Nov — northeast monsoon
  0.91 // Dec — monsoon, school holidays
] as const

/** Apply seasonal multipliers to a base consumption value, returning 12 monthly values. */
export function applySeasonalProfile(baseKwh: number): number[] {
  return SEASONAL_MULTIPLIERS.map((m) => round2(baseKwh * m))
}

/**
 * Default installation multiplier applied to panel module cost (costPerWp) to estimate
 * turnkey installed system cost. Panel modules are roughly 50% of total installed cost;
 * the remainder covers inverter (~15-20%), mounting/wiring (~15%), labour (~15%), and
 * permitting (~5%). A 2.0× multiplier yields RM 4,000–5,000/kWp — consistent with
 * Malaysian residential turnkey pricing (2025-2026).
 */
export const DEFAULT_INSTALLATION_MULTIPLIER = 2.0

export const ANALYSIS_DISCLAIMERS = [
  'Estimates are based on published TNB tariff rates under Regulatory Period 4 (effective 1 July 2025) and NEM Rakyat 3.0 rules. Actual bills may vary due to billing cycle length, meter reading dates, and tariff adjustments.',
  'The Automatic Fuel Adjustment (AFA) rate changes monthly. Estimates use the latest known rate and may not reflect future changes.',
  'PETRA has indicated that Energy Efficiency Incentive (EEI) rates may be adjusted for NEM users. Current calculations use standard EEI rates pending official modification.',
  'Solar generation estimates are based on average irradiance data. Actual output varies with weather, shading, panel orientation, soiling, and equipment condition.',
  'Excess credits are forfeited at the end of each calendar year. No cash payment is made for unused credits.',
  'System cost is estimated using panel module pricing with a 2.0× installation multiplier (covering inverter, mounting hardware, wiring, labour, and permitting). This reflects typical Malaysian residential turnkey pricing of RM 3,500–5,500 per kWp as of 2025–2026. Always confirm with a licensed SEDA-registered installer.',
  'Payback and savings projections do not account for annual maintenance (~RM 500/yr), inverter replacement (typically needed at year 10–15, costing ~RM 3,000–6,000), electricity tariff escalation, or inflation. Actual long-term returns may differ.'
]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Sum year1Savings degraded by (1 - rate)^(yr-1) for yr = 1..years */
export function computeDegradedSavings(year1Savings: number, degradationRate: number, years: number): number {
  let total = 0
  for (let yr = 1; yr <= years; yr++) {
    total += year1Savings * Math.pow(1 - degradationRate, yr - 1)
  }
  return round2(total)
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

function getConsumptionProfile(value: unknown): ConsumptionProfile | null {
  return value === 'flat' || value === 'seasonal' ? value : null
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
  const degradationRate = getNumber(raw.degradationRate)
  const consumptionProfile = getConsumptionProfile(raw.consumptionProfile)
  const performanceRatio = getNumber(raw.performanceRatio)
  const assumedLosses = getNumber(raw.assumedLosses)
  const dcAcRatio = getNumber(raw.dcAcRatio)

  return {
    ...(monthlyConsumptionKwh !== null ? { monthlyConsumptionKwh } : {}),
    ...(connectionPhase ? { connectionPhase } : {}),
    ...(systemCostRm !== null ? { systemCostRm } : {}),
    ...(afaRateSenPerKwh !== null ? { afaRateSenPerKwh } : {}),
    ...(systemKwp !== null ? { systemKwp } : {}),
    ...(degradationRate !== null ? { degradationRate } : {}),
    ...(consumptionProfile ? { consumptionProfile } : {}),
    ...(performanceRatio !== null ? { performanceRatio } : {}),
    ...(assumedLosses !== null ? { assumedLosses } : {}),
    ...(dcAcRatio !== null ? { dcAcRatio } : {})
  }
}

export function buildAnalysisResults({
  simulation,
  systemCostRm,
  carbonOffsetFactorKgPerMwh,
  activePanelCount,
  degradationRate = 0.005
}: {
  simulation: AnnualSimulationResult
  systemCostRm: number
  carbonOffsetFactorKgPerMwh: number
  activePanelCount: number
  degradationRate?: number
}): AnalysisResultsRecord {
  const year1Savings = simulation.totalSavingsRm
  const averageMonthlySavingsRm = round2(year1Savings / 12)
  const averageMonthlySavingsPct =
    simulation.totalBaselineRm > 0 ? round2((year1Savings / simulation.totalBaselineRm) * 100) : 0

  // Degradation-aware payback: iterate year-by-year
  let paybackYears: number | null = null
  if (year1Savings > 0) {
    let cumulative = 0
    for (let yr = 1; yr <= 50; yr++) {
      cumulative += year1Savings * Math.pow(1 - degradationRate, yr - 1)
      if (cumulative >= systemCostRm) {
        paybackYears = round2(
          yr -
            1 +
            (systemCostRm - (cumulative - year1Savings * Math.pow(1 - degradationRate, yr - 1))) /
              (year1Savings * Math.pow(1 - degradationRate, yr - 1))
        )
        break
      }
    }
  }

  // Degradation-aware 10-year totals
  const tenYearSavings = computeDegradedSavings(year1Savings, degradationRate, 10)

  const tenYearNetBenefitRm = round2(tenYearSavings - systemCostRm)
  const tenYearRoiPercent = systemCostRm > 0 ? round2(((tenYearSavings - systemCostRm) / systemCostRm) * 100) : null
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
