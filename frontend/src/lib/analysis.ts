import type { PanelEdit, RoofType, TariffRates, TariffThresholds } from '@shared/types'
import type { AnnualSimulationResult, NemMonthResult } from './billingEngine'
import type { RoofSegment, SolarPanel } from './buildingInsights'

export type ConnectionPhase = 'single' | 'three'

export type AnalysisMode = 'simple' | 'lifecycle'

export type InverterReplacement = {
  year: number
  costRm: number
}

export const DEFAULT_ANNUAL_MAINTENANCE_RM = 500
export const DEFAULT_INVERTER_REPLACEMENT: InverterReplacement = { year: 12, costRm: 4500 }

export type AnalysisConfig = {
  monthlyConsumptionKwh: number
  connectionPhase: ConnectionPhase
  roofType: RoofType
  systemCostRm: number
  afaRateSenPerKwh: number
  systemKwp: number
  degradationRate: number // e.g. 0.005 = 0.5%/year
  tariffEscalationRate: number // e.g. 0.04 = 4%/year compounding tariff revision
  consumptionProfile: ConsumptionProfile
  performanceRatio: number // e.g. 0.80 = 80%
  assumedLosses: number // e.g. 0.20 = 20%
  dcAcRatio: number // e.g. 1.2
  /** Per-project overrides for individual TNB RP4 tariff rate fields. Sparse — only stores diffs from defaults. */
  tariffRatesOverride?: Partial<TariffRates>
  /** 'simple' (default) = upfront cost only; 'lifecycle' = include maintenance + inverter replacements. */
  analysisMode?: AnalysisMode
  annualMaintenanceRm?: number // RM/year, e.g. 500 for typical Malaysian residential
  /** One entry per planned replacement. Empty array = no inverter swaps factored in. */
  inverterReplacements?: InverterReplacement[]
  /** @deprecated Legacy single-replacement field, retained for migrating saved projects. */
  inverterReplacementCostRm?: number
  /** @deprecated Legacy single-replacement field, retained for migrating saved projects. */
  inverterReplacementYear?: number
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
  /** Active-mode payback (simple or lifecycle, depending on `analysisMode`). */
  paybackYears: number | null
  tenYearNetBenefitRm: number
  tenYearRoiPercent: number | null
  /** Active-mode 25-year net benefit. */
  twentyFiveYearNetBenefitRm: number
  /** Always exposed for direct comparison. Simple = upfront cost only. */
  simplePaybackYears: number | null
  simpleTwentyFiveYearNetBenefitRm: number
  /** Always exposed. Lifecycle = upfront + 25 yrs of maintenance + 1× inverter replacement. */
  lifecyclePaybackYears: number | null
  lifecycleTwentyFiveYearNetBenefitRm: number
  /** Echoes which mode produced `paybackYears` / `twentyFiveYearNetBenefitRm`. */
  analysisMode: AnalysisMode
  carbonOffsetKg: number
  activePanelCount: number
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type ConsumptionProfile = 'flat' | 'seasonal'

/** Malaysian seasonal monthly consumption multipliers, normalised to average 1.0 */
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

/** Apply seasonal multipliers to a base consumption value, returning 12 monthly values */
export function applySeasonalProfile(baseKwh: number): number[] {
  return SEASONAL_MULTIPLIERS.map((m) => round2(baseKwh * m))
}

/**
 * Keys for ANALYSIS_DISCLAIMERS. Consumers call t(`disclaimers.${key}`) from the 'analysis' namespace.
 * Chosen over passing `t` into a function so callers can iterate keys without importing i18n everywhere.
 */
export const ANALYSIS_DISCLAIMER_KEYS = [
  'tnbTariff',
  'afaRate',
  'eeiRebate',
  'solarGeneration',
  'creditForfeiture',
  'systemCost',
  'paybackProjections'
] as const

export type AnalysisDisclaimerKey = (typeof ANALYSIS_DISCLAIMER_KEYS)[number]

/**
 * @deprecated Use ANALYSIS_DISCLAIMER_KEYS + t(`disclaimers.${key}`) instead.
 * Kept temporarily so non-i18n callers (e.g. tests) don't break before migration.
 */
export const ANALYSIS_DISCLAIMERS = [
  'Estimates are based on published TNB tariff rates under Regulatory Period 4 (RP4; effective 1 July 2025) and NEM Rakyat 3.0 rules by default. Actual bills may vary due to billing cycle length, meter reading dates and tariff adjustments. Make your own adjustments in "Advanced" view as needed.',
  'The Automatic Fuel Adjustment (AFA) rate changes monthly. Estimates use the latest known rate and may not reflect future changes.',
  'PETRA has indicated that Energy Efficiency Incentive (EEI) rates may be adjusted for NEM users. Current calculations use standard EEI rates pending official modification.',
  'Solar generation estimates are based on average irradiance data. Actual output varies with weather, shading, panel orientation, soiling and equipment condition.',
  'Excess credits are forfeited at the end of each calendar year. No cash payment is made for unused credits.',
  'System cost is estimated bottom-up: distributor panel pricing + inverter SKU lookup + roof-type-dependent mounting + electrical BOS + permits + labour markup + installer margin. Assumes mid-tier installer pricing and single-storey installation. Typical Malaysian turnkey quotes land within ±10% of this figure. Always confirm with a licensed SEDA-registered installer.',
  'Payback and savings projections do not account for annual maintenance (around RM 500/yr) or inverter replacement (typically needed at year 10 to 15, costing around RM 3,000 to 6,000). Tariff escalation can be configured in Advanced view (default 0%). RP4 revisions in Malaysia have historically trended around 3 to 5% per year. Actual long-term returns may differ.'
]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Sum year1Savings degraded by (1 - degradationRate)^(yr-1) and inflated by
 * (1 + tariffEscalationRate)^(yr-1) for yr = 1..years.
 *
 * Tariff escalation defaults to 0 for backward compatibility — a 0% escalation reproduces
 * the legacy degradation-only projection.
 */
export function computeDegradedSavings(
  year1Savings: number,
  degradationRate: number,
  years: number,
  tariffEscalationRate = 0
): number {
  let total = 0
  for (let yr = 1; yr <= years; yr++) {
    total += year1Savings * Math.pow(1 - degradationRate, yr - 1) * Math.pow(1 + tariffEscalationRate, yr - 1)
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

function getRoofType(value: unknown): RoofType | null {
  return value === 'metal' || value === 'tile' || value === 'flat' ? value : null
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

export type LayoutOrientationSummary = {
  azimuthDegrees: number
  pitchDegrees: number
  dominantSegmentIndex: number
  segmentCount: number
  panelCount: number
}

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function azimuthToCompass(deg: number): string {
  return COMPASS_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

// Summarise the orientation of the user's active panel layout. Counts panels
// per source roof segment via `panel.id → SolarPanel.segmentIndex`, then
// returns a count-weighted circular mean azimuth and weighted mean pitch.
// `dominantSegmentIndex` is the segment hosting the most active panels.
// Returns null when there are no active panels.
//
// Rationale: showing `roofSegmentStats[0]` was misleading once the user moved
// or deleted panels — that segment may no longer host any active panel. This
// helper grounds the displayed azimuth/pitch in the actual layout. We do not
// fold panel rotation deltas into azimuth here because the existing rotation
// math (see `getInitialPanelRotation`) bakes in an image-space convention that
// is not a clean compass offset; segment-level orientation is the honest
// summary of "which roof faces are panels actually on".
export function summarizeLayoutOrientation(
  activePanels: PanelEdit[],
  solarPanels: SolarPanel[],
  roofSegments: RoofSegment[]
): LayoutOrientationSummary | null {
  if (activePanels.length === 0 || roofSegments.length === 0) return null

  const segmentByPanelId = new Map<string, number>()
  for (const sp of solarPanels) {
    segmentByPanelId.set(sp.id, sp.segmentIndex)
  }

  const countBySegment = new Map<number, number>()
  for (const ep of activePanels) {
    const segIdx = segmentByPanelId.get(ep.id)
    if (segIdx === undefined) continue
    if (segIdx < 0 || segIdx >= roofSegments.length) continue
    countBySegment.set(segIdx, (countBySegment.get(segIdx) ?? 0) + 1)
  }

  if (countBySegment.size === 0) return null

  let dominantSegmentIndex = -1
  let dominantCount = -1
  for (const [segIdx, count] of countBySegment) {
    if (count > dominantCount) {
      dominantCount = count
      dominantSegmentIndex = segIdx
    }
  }

  // Circular mean azimuth weighted by panel count (handles 350°/10° wraparound)
  let sumSin = 0
  let sumCos = 0
  let sumPitchWeighted = 0
  let totalWeight = 0
  for (const [segIdx, count] of countBySegment) {
    const seg = roofSegments[segIdx]
    const az = (seg.azimuthDegrees * Math.PI) / 180
    sumSin += Math.sin(az) * count
    sumCos += Math.cos(az) * count
    sumPitchWeighted += seg.pitchDegrees * count
    totalWeight += count
  }
  const meanAzRad = Math.atan2(sumSin, sumCos)
  const azimuthDegrees = ((meanAzRad * 180) / Math.PI + 360) % 360
  const pitchDegrees = sumPitchWeighted / totalWeight

  return {
    azimuthDegrees: round2(azimuthDegrees),
    pitchDegrees: round2(pitchDegrees),
    dominantSegmentIndex,
    segmentCount: countBySegment.size,
    panelCount: totalWeight
  }
}

// NEM Fit classifies how well-sized a layout is for the user's consumption
// under NEM Rakyat 3.0 netting. Inputs are annual totals from the simulation.
//
// Rationale: with monthly netting + year-end credit forfeiture, a system that
// generates more than the household consumes builds up credits that may go
// unused (forfeited each December). This produces diminishing payback returns
// even though the layout looks bigger on paper. Conversely a small system that
// covers <90% of consumption uses every kWh productively.
//
// Thresholds (initial — calibrate against test projects later):
//   Good      — generation ratio ≤ 0.9 AND forfeiture rate ≤ 5%
//   Moderate  — generation ratio ≤ 1.1 AND forfeiture rate ≤ 15%
//   Oversized — anything else (ratio > 1.1 or forfeiture > 15%)
export type NemFit = 'good' | 'moderate' | 'oversized'

export type NemFitClassification = {
  fit: NemFit
  detail: string
  generationRatio: number
  forfeitureRate: number
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

// Derate raw DC monthly generation by the system's Performance Ratio.
// PR captures real-world losses (soiling, wiring, inverter conversion, heat,
// mismatch) as a single coefficient — typical for Malaysian residential is 0.80.
// In the sidebar UI, PR and `assumedLosses` are coupled (losses = 1 − PR), so
// they are alternative views of the same derate. We apply only PR here to
// avoid double-counting. Panel-level `monthlyEnergyDcKwh` is preserved as the
// raw flux source so this can be re-derived if the assumption changes later.
export function applyPerformanceRatio(monthlyKwh: number[], performanceRatio: number): number[] {
  return monthlyKwh.map((kwh) => round2(kwh * performanceRatio))
}

function getConsumptionProfile(value: unknown): ConsumptionProfile | null {
  return value === 'flat' || value === 'seasonal' ? value : null
}

const TARIFF_RATE_KEYS: ReadonlyArray<keyof TariffRates> = [
  'energyLow',
  'energyHigh',
  'capacity',
  'network',
  'retailChargeRm',
  'sstRate',
  'reFundRate',
  'minChargeRm'
]

function getTariffRatesOverride(value: unknown): Partial<TariffRates> | null {
  if (!isRecord(value)) return null
  const result: Partial<TariffRates> = {}
  for (const key of TARIFF_RATE_KEYS) {
    const raw = value[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

export function parseSavedAnalysisConfig(raw: unknown): Partial<AnalysisConfig> | null {
  if (!isRecord(raw)) {
    return null
  }

  const monthlyConsumptionKwh = getNumber(raw.monthlyConsumptionKwh)
  const connectionPhase = getConnectionPhase(raw.connectionPhase)
  const roofType = getRoofType(raw.roofType)
  const systemCostRm = getNumber(raw.systemCostRm)
  const afaRateSenPerKwh = getNumber(raw.afaRateSenPerKwh)
  const systemKwp = getNumber(raw.systemKwp)
  const degradationRate = getNumber(raw.degradationRate)
  const tariffEscalationRate = getNumber(raw.tariffEscalationRate)
  const tariffRatesOverride = getTariffRatesOverride(raw.tariffRatesOverride)
  const consumptionProfile = getConsumptionProfile(raw.consumptionProfile)
  const performanceRatio = getNumber(raw.performanceRatio)
  const assumedLosses = getNumber(raw.assumedLosses)
  const dcAcRatio = getNumber(raw.dcAcRatio)
  const analysisMode: AnalysisMode | null =
    raw.analysisMode === 'simple' || raw.analysisMode === 'lifecycle' ? raw.analysisMode : null
  const annualMaintenanceRm = getNumber(raw.annualMaintenanceRm)
  const inverterReplacementCostRm = getNumber(raw.inverterReplacementCostRm)
  const inverterReplacementYear = getNumber(raw.inverterReplacementYear)
  const inverterReplacements = parseInverterReplacements(
    raw.inverterReplacements,
    inverterReplacementCostRm,
    inverterReplacementYear
  )

  return {
    ...(monthlyConsumptionKwh !== null ? { monthlyConsumptionKwh } : {}),
    ...(connectionPhase ? { connectionPhase } : {}),
    ...(roofType ? { roofType } : {}),
    ...(systemCostRm !== null ? { systemCostRm } : {}),
    ...(afaRateSenPerKwh !== null ? { afaRateSenPerKwh } : {}),
    ...(systemKwp !== null ? { systemKwp } : {}),
    ...(degradationRate !== null ? { degradationRate } : {}),
    ...(tariffEscalationRate !== null ? { tariffEscalationRate } : {}),
    ...(tariffRatesOverride ? { tariffRatesOverride } : {}),
    ...(consumptionProfile ? { consumptionProfile } : {}),
    ...(performanceRatio !== null ? { performanceRatio } : {}),
    ...(assumedLosses !== null ? { assumedLosses } : {}),
    ...(dcAcRatio !== null ? { dcAcRatio } : {}),
    ...(analysisMode ? { analysisMode } : {}),
    ...(annualMaintenanceRm !== null ? { annualMaintenanceRm } : {}),
    ...(inverterReplacements ? { inverterReplacements } : {})
  }
}

/**
 * Coerce an `InverterReplacement[]` input into a sanitised, sorted array.
 * Falls back to the legacy single-replacement scalar fields if the array
 * is undefined/empty, so callers can keep passing the old shape during the
 * deprecation window.
 */
export function normalizeInverterReplacements(
  replacements: InverterReplacement[] | undefined,
  legacyCostRm?: number,
  legacyYear?: number
): InverterReplacement[] {
  if (replacements && replacements.length > 0) {
    return replacements
      .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.costRm) && r.year >= 1 && r.costRm >= 0)
      .map((r) => ({ year: Math.round(r.year), costRm: round2(r.costRm) }))
      .sort((a, b) => a.year - b.year)
  }
  if (typeof legacyCostRm === 'number' && Number.isFinite(legacyCostRm) && legacyCostRm > 0) {
    const year =
      typeof legacyYear === 'number' && Number.isFinite(legacyYear) && legacyYear > 0
        ? Math.round(legacyYear)
        : DEFAULT_INVERTER_REPLACEMENT.year
    return [{ year, costRm: round2(legacyCostRm) }]
  }
  return []
}

/**
 * Parse the inverter-replacements array, falling back to legacy single-replacement
 * fields when the array is missing. Always returns a sorted, sanitised array (or null
 * when nothing was configured).
 */
function parseInverterReplacements(
  raw: unknown,
  legacyCostRm: number | null,
  legacyYear: number | null
): InverterReplacement[] | null {
  if (Array.isArray(raw)) {
    const items: InverterReplacement[] = []
    for (const entry of raw) {
      if (!isRecord(entry)) continue
      const year = getNumber(entry.year)
      const costRm = getNumber(entry.costRm)
      if (year === null || costRm === null) continue
      if (year < 1 || costRm < 0) continue
      items.push({ year: Math.round(year), costRm: round2(costRm) })
    }
    if (items.length === 0) return null
    return items.sort((a, b) => a.year - b.year)
  }
  if (legacyCostRm !== null && legacyCostRm > 0 && legacyYear !== null && legacyYear > 0) {
    return [{ year: Math.round(legacyYear), costRm: round2(legacyCostRm) }]
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
  /** @deprecated Pass `inverterReplacements` instead. */
  inverterReplacementCostRm?: number
  /** @deprecated Pass `inverterReplacements` instead. */
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

  // Simple payback (upfront cost only). Each year's savings = year1 * (1-deg)^(y-1) * (1+esc)^(y-1).
  let simplePaybackYears: number | null = null
  if (year1Savings > 0) {
    let cumulative = 0
    for (let yr = 1; yr <= 50; yr++) {
      const yearSavings =
        year1Savings * Math.pow(1 - degradationRate, yr - 1) * Math.pow(1 + tariffEscalationRate, yr - 1)
      cumulative += yearSavings
      if (cumulative >= systemCostRm) {
        simplePaybackYears = round2(yr - 1 + (systemCostRm - (cumulative - yearSavings)) / yearSavings)
        break
      }
    }
  }

  // Lifecycle payback subtracts annual maintenance from each year's savings and
  // adds each inverter replacement to the cumulative-cost target in the year it
  // occurs. Iterates year-by-year so replacements land at the correct points.
  let lifecyclePaybackYears: number | null = null
  if (year1Savings > 0 && (annualMaintenanceRm > 0 || replacements.length > 0)) {
    let cumulative = 0
    for (let yr = 1; yr <= 50; yr++) {
      const yearSavings =
        year1Savings * Math.pow(1 - degradationRate, yr - 1) * Math.pow(1 + tariffEscalationRate, yr - 1)
      const yearNet = yearSavings - annualMaintenanceRm
      cumulative += yearNet
      const replacementCostByThisYear = replacements
        .filter((r) => r.year <= yr)
        .reduce((sum, r) => sum + r.costRm, 0)
      const totalCost = systemCostRm + replacementCostByThisYear
      if (cumulative >= totalCost) {
        lifecyclePaybackYears = round2(yr - 1 + (totalCost - (cumulative - yearNet)) / yearNet)
        break
      }
    }
  } else {
    // No lifecycle deltas configured → lifecycle == simple
    lifecyclePaybackYears = simplePaybackYears
  }

  // 10-year totals with degradation + escalation (kept simple-only for backward compat)
  const tenYearSavings = computeDegradedSavings(year1Savings, degradationRate, 10, tariffEscalationRate)
  const tenYearNetBenefitRm = round2(tenYearSavings - systemCostRm)
  const tenYearRoiPercent = systemCostRm > 0 ? round2(((tenYearSavings - systemCostRm) / systemCostRm) * 100) : null

  // 25-year net benefit (simple and lifecycle). Lifecycle subtracts 25 × maintenance
  // and the cost of every replacement scheduled to occur within the 25-year window.
  const twentyFiveYearGrossSavings = computeDegradedSavings(year1Savings, degradationRate, 25, tariffEscalationRate)
  const simpleTwentyFiveYearNetBenefitRm = round2(twentyFiveYearGrossSavings - systemCostRm)
  const replacementsWithin25Yrs = replacements.filter((r) => r.year <= 25).reduce((sum, r) => sum + r.costRm, 0)
  const lifecycleTwentyFiveYearNetBenefitRm = round2(
    twentyFiveYearGrossSavings - systemCostRm - 25 * annualMaintenanceRm - replacementsWithin25Yrs
  )

  // Active-mode aliases drive the existing UI / PDF without forcing every call site to know about both modes.
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
