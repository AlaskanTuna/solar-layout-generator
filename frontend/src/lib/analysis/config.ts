import type { RoofType, TariffRates } from '@shared/types'

/**
 * Defines the ConnectionPhase type
 */
export type ConnectionPhase = 'single' | 'three'/**
 * Defines the AnalysisMode type
 */
/**
 * Defines the AnalysisMode type
 */


export type AnalysisMode = 'simple' | 'lifecycle'

/**
 * Defines the ConsumptionProfile type
 */
export type ConsumptionProfile = 'flat' | 'seasonal'/**
 * Defines the InverterReplacement type
 */
/**
 * Defines the InverterReplacement type
 */


export type InverterReplacement = {
  year: number
  costRm: number
}

/**
 * Defines the DEFAULT_ANNUAL_MAINTENANCE_RM constant
 */
export const DEFAULT_ANNUAL_MAINTENANCE_RM = 500/**
 * Defines the DEFAULT_INVERTER_REPLACEMENT constant
 */
/**
 * Defines the DEFAULT_INVERTER_REPLACEMENT constant
 */
export const DEFAULT_INVERTER_REPLACEMENT: InverterReplacement = { year: 12, costRm: 4500 }/**
 * Defines the AnalysisConfig type
 */
/**
 * Defines the AnalysisConfig type
 */


export type AnalysisConfig = {
  monthlyConsumptionKwh: number
  connectionPhase: ConnectionPhase
  roofType: RoofType
  systemCostRm: number
  afaRateSenPerKwh: number
  systemKwp: number
  degradationRate: number
  tariffEscalationRate: number
  consumptionProfile: ConsumptionProfile
  performanceRatio: number
  assumedLosses: number
  dcAcRatio: number
  tariffRatesOverride?: Partial<TariffRates>
  analysisMode?: AnalysisMode
  annualMaintenanceRm?: number
  inverterReplacements?: InverterReplacement[]
  inverterReplacementCostRm?: number
  inverterReplacementYear?: number
}

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

function getRoofType(value: unknown): RoofType | null {
  return value === 'metal' || value === 'tile' || value === 'flat' ? value : null
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

/**
 * Defines the parseSavedAnalysisConfig function
 * @param {unknown} raw - Value used for raw
 * @returns {Partial<AnalysisConfig>} The parsed saved analysis config
 */
export function parseSavedAnalysisConfig(raw: unknown): Partial<AnalysisConfig> | null {
  if (!isRecord(raw)) return null

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
