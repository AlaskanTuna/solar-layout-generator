import type { AnalysisMode, InverterReplacement } from './config'

/** One year of the cumulative net-benefit series rendered by the lifecycle chart. */
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
 * Sums year-1 savings projected over `years` with annual panel degradation and optional tariff escalation.
 * Each year's contribution is `year1Savings × (1 - degradation)^(yr-1) × (1 + escalation)^(yr-1)`.
 *
 * @param year1Savings - Cash savings in the first year (RM)
 * @param degradationRate - Annual panel output loss (e.g. `0.005` = 0.5%/yr)
 * @param years - Number of years to project, inclusive
 * @param tariffEscalationRate - Annual tariff inflation (defaults to `0` = flat tariff)
 * @returns Cumulative RM saved over the projection window, rounded to 2 dp
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
 * Validates and sorts user-provided inverter-replacement events.
 * Accepts a legacy single-event pair (`costRm` + `year`) for projects saved before
 * multi-event support was added.
 *
 * @param replacements - User-edited list of replacement events; invalid entries are dropped
 * @param legacyCostRm - Single-event fallback cost (used only when `replacements` is empty)
 * @param legacyYear - Single-event fallback year; defaults to 12 when omitted but `legacyCostRm` is present
 * @returns Validated, year-sorted replacement list (possibly empty)
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
 * Builds the year-by-year net-benefit series shown on the AnalysisPage chart and in the PDF.
 * In `lifecycle` mode subtracts annual maintenance and any inverter replacements that have
 * occurred by year `n` from the gross savings; in `simple` mode only system cost is deducted.
 *
 * @param options - Inputs from the AnalysisConfig (savings, degradation, mode, costs)
 * @returns Array of {@link NetBenefitPoint} entries, one per year up to `options.years`
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
