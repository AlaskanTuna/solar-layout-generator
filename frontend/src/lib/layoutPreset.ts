import {
  BILL_RANGE_TO_KWH_PER_MONTH,
  type BillRange,
  type LayoutPreferences,
  type RoofDirection,
  type SizingGoal
} from '@shared/types'

export type PanelYieldEntry = {
  yearlyEnergyDcKwh: number
  segmentIndex?: number
}

export type RoofSegmentEntry = {
  azimuthDegrees: number
}

// Offset multipliers calibrated for tropical Malaysian residential under NEM 3.0:
// daytime AC + appliance load typically draws 50-65% of daily kWh, so a 50%
// system maximizes self-consumption with minimal credit forfeiture from overnight
// export. 100% offset is wasteful here — excess credits expire after 24 months.
// 30% is the budget-first bracket — fastest payback per RM, smallest install.
const SIZING_GOAL_OFFSET: Record<Exclude<SizingGoal, 'custom'>, number> = {
  conservative: 0.3,
  balanced: 0.5,
  maximum: Number.POSITIVE_INFINITY
}

// Compass-bearing windows (0=N, 90=E, 180=S, 270=W). South is widest because
// most Malaysian roofs lean toward the equator-facing aspect.
const DIRECTION_WINDOWS: Record<Exclude<RoofDirection, 'any'>, (azimuth: number) => boolean> = {
  south: (a) => a >= 135 && a <= 225,
  east: (a) => a >= 45 && a < 135,
  west: (a) => a > 225 && a <= 315,
  north: (a) => a < 45 || a > 315
}

// Convert a bill range bucket to an estimated annual kWh consumption target.
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
  const inWindow = DIRECTION_WINDOWS[direction]
  if (!inWindow) return panels
  const filtered = panels.filter((p) => {
    if (typeof p.segmentIndex !== 'number') return false
    const seg = segments[p.segmentIndex]
    if (!seg) return false
    return inWindow(seg.azimuthDegrees)
  })
  // If the roof has no panels in the chosen direction, fall back to the full set
  // rather than show zero panels — keeps the preset graceful for funky roof shapes.
  return filtered.length === 0 ? panels : filtered
}

// Resolve the panel count that satisfies the chosen sizing goal.
// Panels are assumed pre-sorted by yearlyEnergyDcKwh desc (matches usePanelState's
// stable order). For balanced/conservative we sum highest-yield panels in the
// roof-direction-filtered set until the target offset is met. For maximum (or any
// infinite multiplier) we return the size of the filtered set. Custom is unhandled
// here — caller should keep the user's manual visibleCount.
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
  // Target exceeds total roof yield — give them everything in the filtered set.
  return sorted.length
}

// Short label for the sidebar pill — keeps the user-facing copy free of internal
// offset percentages so non-technical homeowners aren't confused by the math.
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
