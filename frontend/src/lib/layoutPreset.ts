import {
  BILL_RANGE_TO_KWH_PER_MONTH,
  type BillRange,
  type LayoutPreferences,
  type RoofDirection,
  type SizingGoal
} from '@shared/types'
import { azimuthMatchesRoofDirection } from '@/lib/workbench/roofDirection'

export type PanelYieldEntry = {
  yearlyEnergyDcKwh: number
  segmentIndex?: number
}

export type RoofSegmentEntry = {
  azimuthDegrees: number
}

const SIZING_GOAL_OFFSET: Record<Exclude<SizingGoal, 'custom'>, number> = {
  conservative: 0.3,
  balanced: 0.5,
  maximum: Number.POSITIVE_INFINITY
}

/** Convert a bill range bucket to annual kWh */
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

/** Resolve the visible panel count for the current sizing goal */
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

/** Human-readable label for the sidebar preset pill */
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
