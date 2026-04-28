import type { PanelEdit } from '@shared/types'
import type { NemMonthResult } from '../billingEngine'
import type { RoofSegment, SolarPanel } from '../buildingInsights'
import type { ConsumptionProfile } from './config'

/** Three-letter English month labels for chart x-axes; mirror order of monthly billing arrays. */
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Per-month consumption multipliers applied when `consumptionProfile === 'seasonal'`.
 * Centered around 1.0 so the annual sum matches a flat profile; peaks in Mar-Jun reflect
 * Malaysian aircon-heavy hot months.
 */
export const SEASONAL_MULTIPLIERS: readonly number[] = [
  0.93,
  0.95,
  1.08,
  1.1,
  1.1,
  1.08,
  1.02,
  1,
  0.98,
  0.95,
  0.9,
  0.91
] as const

/** One x-axis tick of the analysis bill-comparison chart — month label plus baseline / NEM / cumulative-savings amounts. */
export type AnalysisChartDataPoint = {
  month: string
  baselineBill: number
  nemBill: number
  cumulativeSavings: number
}

/** Roof-orientation summary derived from the active panel set — count-weighted azimuth/pitch + dominant segment. */
export type LayoutOrientationSummary = {
  azimuthDegrees: number
  pitchDegrees: number
  dominantSegmentIndex: number
  segmentCount: number
  panelCount: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Spreads a flat monthly consumption value across the year using {@link SEASONAL_MULTIPLIERS}.
 *
 * @param baseKwh - Flat monthly consumption (the user's "average month" estimate)
 * @returns 12-element array (Jan→Dec) of seasonally-adjusted monthly kWh, 2 dp
 */
export function applySeasonalProfile(baseKwh: number): number[] {
  return SEASONAL_MULTIPLIERS.map((multiplier) => round2(baseKwh * multiplier))
}

/**
 * Sums per-panel monthly DC kWh into a single 12-element annual generation array.
 *
 * @param activePanels - Panels currently kept/moved (deletions excluded by caller)
 * @returns 12 monthly DC kWh totals (Jan→Dec), 2 dp; missing months treated as zero
 */
export function aggregateMonthlyGeneration(activePanels: PanelEdit[]): number[] {
  const totals = Array.from({ length: 12 }, () => 0)

  for (const panel of activePanels) {
    for (let index = 0; index < 12; index += 1) {
      totals[index] += panel.monthlyEnergyDcKwh[index] ?? 0
    }
  }

  return totals.map((value) => round2(value))
}

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/**
 * Converts a compass azimuth into the closest 8-point label (`'N'`, `'NE'`, …, `'NW'`).
 *
 * @param deg - Azimuth in degrees (any range; normalized into 0–360 first)
 * @returns Three-letter compass label
 */
export function azimuthToCompass(deg: number): string {
  return COMPASS_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

/**
 * Computes a count-weighted azimuth/pitch summary across the active panel set.
 * Azimuth uses circular mean (atan2 of sin/cos sums) so 350°/10° average to 0°, not 180°.
 *
 * @param activePanels - User's current edited layout (kept + moved panels)
 * @param solarPanels - All Solar API panels (used to map panel id → segment index)
 * @param roofSegments - Roof segments aligned to the segment index in `solarPanels`
 * @returns {@link LayoutOrientationSummary} or `null` when no active panels resolve to a known segment
 */
export function summarizeLayoutOrientation(
  activePanels: PanelEdit[],
  solarPanels: SolarPanel[],
  roofSegments: RoofSegment[]
): LayoutOrientationSummary | null {
  if (activePanels.length === 0 || roofSegments.length === 0) return null

  const segmentByPanelId = new Map<string, number>()
  for (const solarPanel of solarPanels) {
    segmentByPanelId.set(solarPanel.id, solarPanel.segmentIndex)
  }

  const countBySegment = new Map<number, number>()
  for (const activePanel of activePanels) {
    const segmentIndex = segmentByPanelId.get(activePanel.id)
    if (segmentIndex === undefined) continue
    if (segmentIndex < 0 || segmentIndex >= roofSegments.length) continue
    countBySegment.set(segmentIndex, (countBySegment.get(segmentIndex) ?? 0) + 1)
  }

  if (countBySegment.size === 0) return null

  let dominantSegmentIndex = -1
  let dominantCount = -1
  for (const [segmentIndex, count] of countBySegment) {
    if (count > dominantCount) {
      dominantCount = count
      dominantSegmentIndex = segmentIndex
    }
  }

  let sumSin = 0
  let sumCos = 0
  let sumPitchWeighted = 0
  let totalWeight = 0

  for (const [segmentIndex, count] of countBySegment) {
    const segment = roofSegments[segmentIndex]
    const azimuthRadians = (segment.azimuthDegrees * Math.PI) / 180
    sumSin += Math.sin(azimuthRadians) * count
    sumCos += Math.cos(azimuthRadians) * count
    sumPitchWeighted += segment.pitchDegrees * count
    totalWeight += count
  }

  const meanAzimuthRadians = Math.atan2(sumSin, sumCos)
  const azimuthDegrees = ((meanAzimuthRadians * 180) / Math.PI + 360) % 360
  const pitchDegrees = sumPitchWeighted / totalWeight

  return {
    azimuthDegrees: round2(azimuthDegrees),
    pitchDegrees: round2(pitchDegrees),
    dominantSegmentIndex,
    segmentCount: countBySegment.size,
    panelCount: totalWeight
  }
}

/**
 * Applies the system performance ratio (PR) to convert raw DC kWh into delivered AC kWh.
 *
 * @param monthlyKwh - Raw DC kWh per month (from Solar API + GeoTIFF sampling)
 * @param performanceRatio - Combined PR including inverter efficiency, soiling, wiring (typically 0.75–0.85)
 * @returns Derated monthly kWh, 2 dp
 */
export function applyPerformanceRatio(monthlyKwh: number[], performanceRatio: number): number[] {
  return monthlyKwh.map((kwh) => round2(kwh * performanceRatio))
}

/**
 * Reshapes the 12-month NEM simulation into the chart points used by the bill-comparison
 * chart on AnalysisPage and in the PDF. Adds a running cumulative-savings field.
 *
 * @param monthlyBreakdown - 12 NEM month rows from the simulation
 * @returns Array of {@link AnalysisChartDataPoint} ready to feed Recharts
 */
export function buildMonthlyBillChartData(monthlyBreakdown: NemMonthResult[]): AnalysisChartDataPoint[] {
  let cumulativeSavings = 0

  return monthlyBreakdown.map((month, index) => {
    cumulativeSavings += month.savingsRm

    return {
      month: MONTH_LABELS[index] ?? String(index + 1),
      baselineBill: month.baselineBill.total,
      nemBill: month.nemBill.total,
      cumulativeSavings: round2(cumulativeSavings)
    }
  })
}

/**
 * Narrowing helper used in conditional branches so the consumption-profile literal stays a single source of truth.
 *
 * @param profile - Consumption-profile setting from the analysis config
 * @returns `true` when the profile is `'seasonal'`
 */
export function isSeasonalProfile(profile: ConsumptionProfile): boolean {
  return profile === 'seasonal'
}
