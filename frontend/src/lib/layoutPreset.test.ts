import { describe, it, expect } from 'vitest'
import { inferVisibleCount, billRangeToAnnualKwh, describeLayoutPreset } from './layoutPreset'

const panels = (yields: number[]) => yields.map((y) => ({ yearlyEnergyDcKwh: y }))

describe('inferVisibleCount', () => {
  it('returns all panels for sizingGoal=maximum', () => {
    const ps = panels([400, 380, 350])
    expect(inferVisibleCount(ps, { sizingGoal: 'maximum' })).toBe(3)
  })

  it('returns all panels for sizingGoal=custom', () => {
    const ps = panels([500, 400])
    expect(inferVisibleCount(ps, { sizingGoal: 'custom' })).toBe(2)
  })

  it('matches balanced (50% offset) target with high-yield panels first', () => {
    // 600 kWh/mo unknown → 7200 kWh/yr × 0.5 = 3600 kWh target
    // panels sorted desc: 4000 covers target alone → 1 panel
    const ps = panels([4000, 3500, 1000])
    expect(inferVisibleCount(ps, { sizingGoal: 'balanced', billRange: 'unknown' })).toBe(1)
  })

  it('uses 30% target for conservative', () => {
    // unknown → 7200 kWh/yr × 0.3 = 2160 → first 4000-yield panel covers it
    const ps = panels([4000, 3500, 1000])
    expect(inferVisibleCount(ps, { sizingGoal: 'conservative', billRange: 'unknown' })).toBe(1)
  })

  it('returns 0 when no panels', () => {
    expect(inferVisibleCount([], { sizingGoal: 'balanced', billRange: '<100' })).toBe(0)
  })

  it('returns all panels when target exceeds total roof yield', () => {
    // 600+ → 1800 kWh/mo × 12 × 0.5 = 10800 kWh target; total roof = 1500 → exceed → return all
    const ps = panels([800, 700])
    expect(inferVisibleCount(ps, { sizingGoal: 'balanced', billRange: '600+' })).toBe(2)
  })

  it('sorts panels even when input is in random order', () => {
    // Same input, scrambled — balanced 50% of 7200 = 3600; first 4000 covers → 1 panel
    const ps = panels([1000, 4000, 3500])
    expect(inferVisibleCount(ps, { sizingGoal: 'balanced', billRange: 'unknown' })).toBe(1)
  })
})

describe('inferVisibleCount with roofDirection', () => {
  // segment 0 = south-facing (180°), 1 = east-facing (90°), 2 = north-facing (0°)
  const segments = [{ azimuthDegrees: 180 }, { azimuthDegrees: 90 }, { azimuthDegrees: 0 }]
  // 2 south panels, 2 east panels, 1 north panel
  const mixedPanels = [
    { yearlyEnergyDcKwh: 4500, segmentIndex: 0 },
    { yearlyEnergyDcKwh: 4400, segmentIndex: 0 },
    { yearlyEnergyDcKwh: 3500, segmentIndex: 1 },
    { yearlyEnergyDcKwh: 3400, segmentIndex: 1 },
    { yearlyEnergyDcKwh: 2000, segmentIndex: 2 }
  ]

  it('south filter keeps only segment 0 panels', () => {
    // balanced @ unknown = 7200 × 0.5 = 3600; 4500 covers alone → 1 panel
    expect(
      inferVisibleCount(mixedPanels, { sizingGoal: 'balanced', billRange: 'unknown', roofDirection: 'south' }, segments)
    ).toBe(1)
  })

  it('east filter keeps only segment 1 panels', () => {
    // east subset: 3500 first → 3500 < 3600, 3500+3400=6900 ≥ 3600 → 2 panels
    expect(
      inferVisibleCount(mixedPanels, { sizingGoal: 'balanced', billRange: 'unknown', roofDirection: 'east' }, segments)
    ).toBe(2)
  })

  it('"any" direction does not filter', () => {
    // All 5 sorted desc; 4500 alone covers 3600 target → 1 panel
    expect(
      inferVisibleCount(mixedPanels, { sizingGoal: 'balanced', billRange: 'unknown', roofDirection: 'any' }, segments)
    ).toBe(1)
  })

  it('falls back to full set when no panels match the direction', () => {
    // West has zero panels — should fall back to all 5
    expect(
      inferVisibleCount(mixedPanels, { sizingGoal: 'maximum', billRange: 'unknown', roofDirection: 'west' }, segments)
    ).toBe(5)
  })

  it('maximum returns filtered subset size for the chosen direction', () => {
    expect(
      inferVisibleCount(mixedPanels, { sizingGoal: 'maximum', billRange: 'unknown', roofDirection: 'south' }, segments)
    ).toBe(2)
  })

  it('handles missing segments gracefully (no filter applied)', () => {
    expect(inferVisibleCount(mixedPanels, { sizingGoal: 'maximum', roofDirection: 'south' })).toBe(5)
  })
})

describe('billRangeToAnnualKwh', () => {
  it('multiplies the bucket map by 12', () => {
    expect(billRangeToAnnualKwh('<100')).toBe(250 * 12)
    expect(billRangeToAnnualKwh('100-200')).toBe(450 * 12)
    expect(billRangeToAnnualKwh('600+')).toBe(1800 * 12)
  })

  it('falls back to "unknown" when undefined', () => {
    expect(billRangeToAnnualKwh(undefined)).toBe(600 * 12)
  })
})

describe('describeLayoutPreset', () => {
  it('formats each sizing goal', () => {
    expect(describeLayoutPreset({ sizingGoal: 'conservative' })).toBe('Economy')
    expect(describeLayoutPreset({ sizingGoal: 'balanced' })).toBe('Self-Consumption')
    expect(describeLayoutPreset({ sizingGoal: 'maximum' })).toBe('Maximum')
    expect(describeLayoutPreset({ sizingGoal: 'custom' })).toBe('Custom')
  })

  it('returns "Not set" for null/undefined prefs', () => {
    expect(describeLayoutPreset(null)).toBe('Not set')
    expect(describeLayoutPreset(undefined)).toBe('Not set')
  })
})
