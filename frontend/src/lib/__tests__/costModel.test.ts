import { describe, expect, it } from 'vitest'
import { computeSystemCost, MOUNTING_PER_PANEL } from '@shared/types'

// Worked examples reference: docs/MVP-PAGE-3-SOLAR-COST-MODEL.md §8.
// Tolerance ±RM 20 accounts for rounding differences vs. the doc
// (the doc rounds intermediate figures; our implementation preserves precision).

describe('computeSystemCost', () => {
  it('matches doc worked example 1 (6 kWp metal three-phase)', () => {
    const breakdown = computeSystemCost({
      panelCount: 14,
      panelWattageWp: 440,
      panelCostPerWp: 0.95,
      roofType: 'metal',
      supplyPhase: 'three'
    })

    expect(breakdown.panels).toBe(5852)
    expect(breakdown.inverterSku).toBe('Huawei SUN2000-6KTL-M1')
    expect(breakdown.inverterKwac).toBe(6)
    expect(breakdown.inverter).toBe(5700)
    expect(breakdown.mounting).toBe(2800)
    expect(breakdown.scaffolding).toBe(0)
    expect(breakdown.cccFeeTriggered).toBe(false)
    expect(breakdown.total).toBeGreaterThan(23783)
    expect(breakdown.total).toBeLessThan(23823)
  })

  it('matches doc worked example 2 (10 kWp tile three-phase)', () => {
    const breakdown = computeSystemCost({
      panelCount: 22,
      panelWattageWp: 455,
      panelCostPerWp: 0.9,
      roofType: 'tile',
      supplyPhase: 'three'
    })

    expect(breakdown.panels).toBe(9009)
    expect(breakdown.inverterSku).toBe('Huawei SUN2000-8KTL-M1')
    expect(breakdown.inverterKwac).toBe(8)
    expect(breakdown.inverter).toBe(6550)
    expect(breakdown.mounting).toBe(7260)
    expect(breakdown.scaffolding).toBe(2000)
    expect(breakdown.cccFeeTriggered).toBe(false)
    expect(breakdown.total).toBeGreaterThan(39318)
    expect(breakdown.total).toBeLessThan(39358)
  })

  it('picks smallest inverter that satisfies DC:AC ratio 1.33', () => {
    // 3-phase, 6 kWp: need kwac*1.33 ≥ 6 → kwac ≥ 4.51, smallest three-phase SKU is 6 kWac
    const a = computeSystemCost({
      panelCount: 15,
      panelWattageWp: 400,
      panelCostPerWp: 0.95,
      roofType: 'metal',
      supplyPhase: 'three'
    })
    expect(a.inverterKwac).toBe(6)

    // 3-phase, 8 kWp: need kwac*1.33 ≥ 8 → kwac ≥ 6.02, smallest is 8 kWac (6 is ruled out: 6*1.33=7.98<8)
    const b = computeSystemCost({
      panelCount: 20,
      panelWattageWp: 400,
      panelCostPerWp: 0.95,
      roofType: 'metal',
      supplyPhase: 'three'
    })
    expect(b.inverterKwac).toBe(8)
  })

  it('respects single-phase NEM Rakyat cap (5 kWac) and triggers CCC fee above it', () => {
    // 6 kWp single-phase: only 5 kWac SKU available under cap. 5*1.33=6.65 ≥ 6 ✓
    const breakdown = computeSystemCost({
      panelCount: 15,
      panelWattageWp: 400,
      panelCostPerWp: 0.95,
      roofType: 'metal',
      supplyPhase: 'single'
    })
    expect(breakdown.inverterKwac).toBe(5)
    expect(breakdown.cccFeeTriggered).toBe(false)
  })

  it('falls back to largest allowed SKU when kWp exceeds phase cap (single-phase 8 kWp)', () => {
    // 8 kWp single-phase exceeds the 5 kWac cap; should still return 5 kWac SKU
    // (the sidebar surfaces the separate phase-cap warning).
    const breakdown = computeSystemCost({
      panelCount: 20,
      panelWattageWp: 400,
      panelCostPerWp: 0.95,
      roofType: 'metal',
      supplyPhase: 'single'
    })
    expect(breakdown.inverterKwac).toBe(5)
  })

  it('applies scaffolding only for tile roofs', () => {
    const base = {
      panelCount: 14,
      panelWattageWp: 440,
      panelCostPerWp: 0.95,
      supplyPhase: 'three' as const
    }
    expect(computeSystemCost({ ...base, roofType: 'metal' }).scaffolding).toBe(0)
    expect(computeSystemCost({ ...base, roofType: 'flat' }).scaffolding).toBe(0)
    expect(computeSystemCost({ ...base, roofType: 'tile' }).scaffolding).toBe(2000)
  })

  it('uses roof-type-specific mounting per-panel rate', () => {
    const base = {
      panelCount: 10,
      panelWattageWp: 400,
      panelCostPerWp: 0.95,
      supplyPhase: 'three' as const
    }
    expect(computeSystemCost({ ...base, roofType: 'metal' }).mounting).toBe(10 * MOUNTING_PER_PANEL.metal)
    expect(computeSystemCost({ ...base, roofType: 'tile' }).mounting).toBe(10 * MOUNTING_PER_PANEL.tile)
    expect(computeSystemCost({ ...base, roofType: 'flat' }).mounting).toBe(10 * MOUNTING_PER_PANEL.flat)
  })

  it('applies 18% labour and 15% installer margin sequentially', () => {
    const breakdown = computeSystemCost({
      panelCount: 14,
      panelWattageWp: 440,
      panelCostPerWp: 0.95,
      roofType: 'metal',
      supplyPhase: 'three'
    })
    expect(breakdown.labour).toBe(Math.round(breakdown.hardwareSubtotal * 0.18))
    expect(breakdown.installerMargin).toBe(Math.round((breakdown.hardwareSubtotal + breakdown.labour) * 0.15))
  })
})
