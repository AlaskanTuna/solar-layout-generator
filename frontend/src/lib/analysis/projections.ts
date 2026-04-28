import type { AnalysisMode, InverterReplacement } from './config'

/**
 * Defines the NetBenefitPoint type
 */
export type NetBenefitPoint = {
  year: number
  grossSavings: number
  maintenanceCost: number
  inverterCost: number
  netBenefit: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Defines the computeDegradedSavings function
 * @param {number} year1Savings - Value used for year1 savings
 * @param {number} degradationRate - Value used for degradation rate
 * @param {number} years - Value used for years
 * @param {number} tariffEscalationRate - Value used for tariff escalation rate
 * @returns {number} The computed degraded savings
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

/**
 * Defines the normalizeInverterReplacements function
 * @param {InverterReplacement[] | undefined} replacements - Collection of replacements values
 * @param {number} legacyCostRm - Value used for legacy cost rm
 * @param {number} legacyYear - Value used for legacy year
 * @returns {InverterReplacement[]} The normalized inverter replacements
 */
export function normalizeInverterReplacements(
  replacements: InverterReplacement[] | undefined,
  legacyCostRm?: number,
  legacyYear?: number
): InverterReplacement[] {
  if (replacements && replacements.length > 0) {
    return replacements
      .filter((replacement) => {
        return (
          Number.isFinite(replacement.year) &&
          Number.isFinite(replacement.costRm) &&
          replacement.year >= 1 &&
          replacement.costRm >= 0
        )
      })
      .map((replacement) => ({
        year: Math.round(replacement.year),
        costRm: round2(replacement.costRm)
      }))
      .sort((left, right) => left.year - right.year)
  }

  if (typeof legacyCostRm === 'number' && Number.isFinite(legacyCostRm) && legacyCostRm > 0) {
    const year =
      typeof legacyYear === 'number' && Number.isFinite(legacyYear) && legacyYear > 0 ? Math.round(legacyYear) : 12
    return [{ year, costRm: round2(legacyCostRm) }]
  }

  return []
}

/**
 * Defines the buildNetBenefitSeries function
 * @param {Object} options - Collection of options values
 * @returns {NetBenefitPoint[]} The built net benefit series
 */
export function buildNetBenefitSeries({
  year1Savings,
  degradationRate,
  years,
  systemCostRm,
  tariffEscalationRate = 0,
  analysisMode = 'simple',
  annualMaintenanceRm = 0,
  inverterReplacements,
  inverterReplacementCostRm,
  inverterReplacementYear
}: {
  year1Savings: number
  degradationRate: number
  years: number
  systemCostRm: number
  tariffEscalationRate?: number
  analysisMode?: AnalysisMode
  annualMaintenanceRm?: number
  inverterReplacements?: InverterReplacement[]
  inverterReplacementCostRm?: number
  inverterReplacementYear?: number
}): NetBenefitPoint[] {
  const replacements = normalizeInverterReplacements(
    inverterReplacements,
    inverterReplacementCostRm,
    inverterReplacementYear
  )

  return Array.from({ length: years }, (_, index) => {
    const year = index + 1
    const grossSavings = computeDegradedSavings(year1Savings, degradationRate, year, tariffEscalationRate)
    const maintenanceCost = analysisMode === 'lifecycle' ? annualMaintenanceRm * year : 0
    const inverterCost =
      analysisMode === 'lifecycle'
        ? replacements.filter((replacement) => replacement.year <= year).reduce((sum, replacement) => sum + replacement.costRm, 0)
        : 0

    return {
      year,
      grossSavings,
      maintenanceCost,
      inverterCost,
      netBenefit: round2(grossSavings - systemCostRm - maintenanceCost - inverterCost)
    }
  })
}
