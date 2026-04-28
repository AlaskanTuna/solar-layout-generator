import type { PanelEdit } from '@shared/types'
import type { NemMonthResult } from '../billingEngine'
import type { RoofSegment, SolarPanel } from '../buildingInsights'
import type { ConsumptionProfile } from './config'

/**
 * Defines the MONTH_LABELS constant
 */
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']/**
 * Defines the SEASONAL_MULTIPLIERS constant
 */
/**
 * Defines the SEASONAL_MULTIPLIERS constant
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

/**
 * Defines the AnalysisChartDataPoint type
 */
export type AnalysisChartDataPoint = {
  month: string
  baselineBill: number
  nemBill: number
  cumulativeSavings: number
}

/**
 * Defines the LayoutOrientationSummary type
 */
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
 * Defines the applySeasonalProfile function
 * @param {number} baseKwh - Value used for base kwh
 * @returns {number[]} The resulting collection
 */
export function applySeasonalProfile(baseKwh: number): number[] {
  return SEASONAL_MULTIPLIERS.map((multiplier) => round2(baseKwh * multiplier))
}

/**
 * Defines the aggregateMonthlyGeneration function
 * @param {PanelEdit[]} activePanels - Collection of active panels values
 * @returns {number[]} The resulting collection
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
 * Defines the azimuthToCompass function
 * @param {number} deg - Value used for deg
 * @returns {string} The resulting azimuth to compass value
 */
export function azimuthToCompass(deg: number): string {
  return COMPASS_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

/**
 * Defines the summarizeLayoutOrientation function
 * @param {PanelEdit[]} activePanels - Collection of active panels values
 * @param {SolarPanel[]} solarPanels - Collection of solar panels values
 * @param {RoofSegment[]} roofSegments - Collection of roof segments values
 * @returns {LayoutOrientationSummary} The resulting summarize layout orientation value
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
 * Defines the applyPerformanceRatio function
 * @param {number[]} monthlyKwh - Collection of monthly kwh values
 * @param {number} performanceRatio - Value used for performance ratio
 * @returns {number[]} The resulting collection
 */
export function applyPerformanceRatio(monthlyKwh: number[], performanceRatio: number): number[] {
  return monthlyKwh.map((kwh) => round2(kwh * performanceRatio))
}

/**
 * Defines the buildMonthlyBillChartData function
 * @param {NemMonthResult[]} monthlyBreakdown - Collection of monthly breakdown values
 * @returns {AnalysisChartDataPoint[]} The built monthly bill chart data
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
 * Defines the isSeasonalProfile function
 * @param {ConsumptionProfile} profile - Value used for profile
 */
export function isSeasonalProfile(profile: ConsumptionProfile): boolean {
  return profile === 'seasonal'
}
