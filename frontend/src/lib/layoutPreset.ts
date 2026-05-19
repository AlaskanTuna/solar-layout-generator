/**
 * Layout-preset helpers shared between the workbench sidebar and the panel
 * auto-layout pipeline.
 *
 * Translates the user's "Layout Preferences" choices (bill range + sizing
 * goal + roof direction) into a concrete visible-panel count by picking the
 * smallest panel set whose summed yearly DC energy meets a fraction of
 * their estimated annual consumption.
 *
 * Sizing-goal multipliers (under `SIZING_GOAL_OFFSET`):
 *   - `conservative` → 30% of annual consumption (small, fast-payback system)
 *   - `balanced`     → 50% (typical residential self-consumption target)
 *   - `maximum`      → unbounded (every roof-direction-eligible panel)
 */

import {
  BILL_RANGE_TO_KWH_PER_MONTH,
  type BillRange,
  type LayoutPreferences,
  type RoofDirection,
  type SizingGoal
} from '@shared/types'
import { azimuthMatchesRoofDirection } from '@/lib/workbench/roofDirection'

/** Subset of `SolarPanel` fields used for preset-driven panel ordering and count inference. */
export type PanelYieldEntry = {
  yearlyEnergyDcKwh: number
  segmentIndex?: number
}

/** Subset of `RoofSegment` fields needed to apply roof-direction filtering. */
export type RoofSegmentEntry = {
  azimuthDegrees: number
}

/**
 * Fraction of annual consumption each sizing goal targets.
 *
 * `conservative` aims to offset 30% of the user's bill (cheap, fast payback);
 * `balanced` targets 50% which is the typical residential self-consumption
 * sweet spot; `maximum` is unbounded so it returns every eligible panel.
 */
const SIZING_GOAL_OFFSET: Record<Exclude<SizingGoal, 'custom'>, number> = {
  conservative: 0.3,
  balanced: 0.5,
  maximum: Number.POSITIVE_INFINITY
}

/**
 * Converts a TNB bill bucket (e.g. `'200_400'`) into estimated annual consumption (kWh).
 * Maps to monthly kWh via {@link BILL_RANGE_TO_KWH_PER_MONTH} then multiplies by 12.
 * Defaults to the `'unknown'` bucket when `billRange` is undefined.
 *
 * @param billRange - Selected bucket from the layout-preset modal
 * @returns Annual consumption estimate in kWh
 */
export function billRangeToAnnualKwh(billRange: BillRange | undefined): number {
  const monthly = BILL_RANGE_TO_KWH_PER_MONTH[billRange ?? 'unknown']
  return monthly * 12
}

function filterByDirection(
  panels: PanelYieldEntry[],
  segments: RoofSegmentEntry[] | undefined,
  direction: RoofDirection | undefined
): PanelYieldEntry[] {
  if (!direction || direction === 'any' || !segments || segments.length === 0) return panels
  const filtered = panels.filter((p) => {
    if (typeof p.segmentIndex !== 'number') return false
    const seg = segments[p.segmentIndex]
    if (!seg) return false
    return azimuthMatchesRoofDirection(seg.azimuthDegrees, direction)
  })
  return filtered.length === 0 ? panels : filtered
}

/**
 * Computes how many panels to leave visible for a given layout preset.
 * `custom` always returns all panels; `maximum` returns all roof-direction-eligible panels;
 * `conservative`/`balanced` pick the smallest panel set whose summed yearly DC kWh meets
 * the daytime self-consumption target derived from `billRange × goalMultiplier`.
 *
 * @param panels - All available panels (sorted upstream by best-yield-first)
 * @param prefs - Resolved layout preferences from the project
 * @param segments - Optional roof-segment list used to filter by `prefs.roofDirection`
 * @returns Number of panels to keep active, never exceeding `panels.length`
 */
export function inferVisibleCount(
  panels: PanelYieldEntry[],
  prefs: LayoutPreferences,
  segments?: RoofSegmentEntry[]
): number {
  if (panels.length === 0) return 0
  if (prefs.sizingGoal === 'custom') return panels.length

  const eligible = filterByDirection(panels, segments, prefs.roofDirection)

  if (prefs.sizingGoal === 'maximum') return eligible.length

  const offsetMultiplier = SIZING_GOAL_OFFSET[prefs.sizingGoal]
  const annualConsumption = billRangeToAnnualKwh(prefs.billRange)
  const targetKwh = annualConsumption * offsetMultiplier

  if (!Number.isFinite(targetKwh) || targetKwh <= 0) return eligible.length

  const sorted = [...eligible].sort((a, b) => b.yearlyEnergyDcKwh - a.yearlyEnergyDcKwh)

  let total = 0
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i]!.yearlyEnergyDcKwh
    if (total >= targetKwh) return i + 1
  }
  return sorted.length
}

/**
 * Returns the human-readable label shown on the sidebar preset pill.
 * Falls back to `'Not set'` when preferences haven't been chosen yet.
 */
export function describeLayoutPreset(prefs: LayoutPreferences | null | undefined): string {
  if (!prefs) return 'Not set'
  switch (prefs.sizingGoal) {
    case 'conservative':
      return 'Economy'
    case 'balanced':
      return 'Self-Consumption'
    case 'maximum':
      return 'Maximum'
    case 'custom':
      return 'Custom'
    default:
      return 'Not set'
  }
}
