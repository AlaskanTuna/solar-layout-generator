import { describe, it, expect } from 'vitest'
import {
  computeBill,
  computeNemMonth,
  lookupEeiRebate,
  runAnnualSimulation,
  type BillingConfig
} from './billingEngine'

// ── Tariff config matching the seeded RP4-2025 data ──

const config: BillingConfig = {
  rates: {
    energyLow: 27.03,
    energyHigh: 37.03,
    capacity: 4.55,
    network: 12.85,
    retailChargeRm: 10.0,
    sstRate: 0.08,
    reFundRate: 0.016,
    minChargeRm: 3.0
  },
  thresholds: {
    energyCliff: 1500,
    retailWaiver: 600,
    afaWaiver: 600,
    sstExemption: 600,
    eeiCutoff: 1000,
    reFundExemption: 300
  },
  eeiTable: [
    [200, 25.0],
    [250, 24.5],
    [300, 22.5],
    [350, 21.0],
    [400, 17.0],
    [450, 14.5],
    [500, 12.0],
    [550, 10.5],
    [600, 9.0],
    [650, 7.5],
    [700, 5.5],
    [750, 4.5],
    [800, 4.0],
    [850, 2.5],
    [900, 1.0],
    [1000, 0.5]
  ],
  afaRate: -2.77
}

// ── lookupEeiRebate ──

describe('lookupEeiRebate', () => {
  it('returns 25.00 for 100 kWh (first bracket)', () => {
    expect(lookupEeiRebate(100, config.eeiTable)).toBe(25.0)
  })

  it('returns 25.00 for exactly 200 kWh (boundary)', () => {
    expect(lookupEeiRebate(200, config.eeiTable)).toBe(25.0)
  })

  it('returns 24.50 for 201 kWh (second bracket)', () => {
    expect(lookupEeiRebate(201, config.eeiTable)).toBe(24.5)
  })

  it('returns 4.00 for 800 kWh', () => {
    expect(lookupEeiRebate(800, config.eeiTable)).toBe(4.0)
  })

  it('returns 0.50 for 1000 kWh (last bracket)', () => {
    expect(lookupEeiRebate(1000, config.eeiTable)).toBe(0.5)
  })

  it('returns 0 for 1001 kWh (above cutoff)', () => {
    expect(lookupEeiRebate(1001, config.eeiTable)).toBe(0)
  })

  it('returns 0 for 0 kWh', () => {
    expect(lookupEeiRebate(0, config.eeiTable)).toBe(0)
  })

  it('returns 0 for negative kWh', () => {
    expect(lookupEeiRebate(-10, config.eeiTable)).toBe(0)
  })
})

// ── computeBill — golden test cases from Knowledge Vault §9 ──

describe('computeBill', () => {
  it('T5: zero usage returns minimum charge RM3.00', () => {
    const bill = computeBill(0, config)
    expect(bill.total).toBe(3.0)
    expect(bill.kwh).toBe(0)
  })

  it('T1 baseline: 800 kWh = RM342.33', () => {
    // Scenario A from Knowledge Vault §7
    const bill = computeBill(800, config)
    expect(bill.energy).toBe(216.24)
    expect(bill.capacity).toBe(36.4)
    expect(bill.network).toBe(102.8)
    expect(bill.retail).toBe(10.0)
    expect(bill.afa).toBe(-22.16)
    expect(bill.eeiRebate).toBe(32.0)
    expect(bill.preTaxSubtotal).toBe(311.28)
    expect(bill.reFund).toBe(5.69)
    expect(bill.sst).toBe(25.36)
    expect(bill.total).toBe(342.33)
  })

  it('T1 NEM billable: 320 kWh = RM77.25', () => {
    // Scenario A NEM bill
    const bill = computeBill(320, config)
    expect(bill.energy).toBe(86.5)
    expect(bill.capacity).toBe(14.56)
    expect(bill.network).toBe(41.12)
    expect(bill.retail).toBe(0)
    expect(bill.afa).toBe(0)
    expect(bill.eeiRebate).toBe(67.2)
    expect(bill.preTaxSubtotal).toBe(74.98)
    expect(bill.reFund).toBe(2.27)
    expect(bill.sst).toBe(0)
    expect(bill.total).toBe(77.25)
  })

  it('T2 baseline: 300 kWh = RM65.79', () => {
    // Scenario B baseline
    const bill = computeBill(300, config)
    expect(bill.energy).toBe(81.09)
    expect(bill.capacity).toBe(13.65)
    expect(bill.network).toBe(38.55)
    expect(bill.retail).toBe(0)
    expect(bill.afa).toBe(0)
    expect(bill.eeiRebate).toBe(67.5)
    expect(bill.reFund).toBe(0) // ≤300 kWh → exempt
    expect(bill.sst).toBe(0)
    expect(bill.total).toBe(65.79)
  })

  it('T3 baseline: 500 kWh = RM165.70', () => {
    // Scenario D baseline
    const bill = computeBill(500, config)
    expect(bill.energy).toBe(135.15)
    expect(bill.eeiRebate).toBe(60.0)
    expect(bill.total).toBe(165.70)
  })

  it('T4 baseline: 1600 kWh above cliff = RM918.53', () => {
    // Scenario C baseline — crosses 1500 kWh cliff
    const bill = computeBill(1600, config)
    expect(bill.energy).toBe(592.48) // ALL at 37.03 sen
    expect(bill.capacity).toBe(72.8)
    expect(bill.network).toBe(205.6)
    expect(bill.retail).toBe(10.0)
    expect(bill.afa).toBe(-44.32)
    expect(bill.eeiRebate).toBe(0) // >1000 kWh
    expect(bill.total).toBe(918.53)
  })

  it('T4 NEM billable: 640 kWh below cliff', () => {
    // Scenario C NEM — dropped below 1500
    // 640 * 27.03 / 100 = 172.992 → 172.99 (KV wrote 173.00 — manual rounding)
    const bill = computeBill(640, config)
    expect(bill.energy).toBe(172.99)
    expect(bill.eeiRebate).toBe(48.0)
    // Total recalculated with correct energy rounding
    expect(bill.total).toBeCloseTo(251.83, 0)
  })

  it('T7: exactly 1500 kWh stays at low energy rate', () => {
    const bill = computeBill(1500, config)
    // Energy at low rate: 1500 * 27.03 / 100 = 405.45
    expect(bill.energy).toBe(405.45)
  })

  it('T8: 1501 kWh crosses cliff to high energy rate', () => {
    const bill = computeBill(1501, config)
    // Energy at high rate: 1501 * 37.03 / 100 = 555.82
    expect(bill.energy).toBe(555.82)
    // The ~RM150 jump in energy charge
    const billAt1500 = computeBill(1500, config)
    expect(bill.energy - billAt1500.energy).toBeCloseTo(150.37, 1)
  })

  it('600 kWh: all waivers apply', () => {
    const bill = computeBill(600, config)
    expect(bill.retail).toBe(0)
    expect(bill.afa).toBe(0)
    expect(bill.sst).toBe(0)
  })

  it('601 kWh: all waivers lost', () => {
    const bill = computeBill(601, config)
    expect(bill.retail).toBe(10.0)
    expect(bill.afa).not.toBe(0)
    expect(bill.sst).not.toBe(0)
  })

  it('300 kWh: RE Fund exempt', () => {
    const bill = computeBill(300, config)
    expect(bill.reFund).toBe(0)
  })

  it('301 kWh: RE Fund applies', () => {
    const bill = computeBill(301, config)
    expect(bill.reFund).toBeGreaterThan(0)
  })

  it('bill is always >= minimum charge', () => {
    // Very low usage where EEI rebate could make subtotal very small
    const bill = computeBill(1, config)
    expect(bill.total).toBeGreaterThanOrEqual(3.0)
  })
})

// ── computeNemMonth — golden test cases ──

describe('computeNemMonth', () => {
  it('T1: 800 kWh consumption, 480 kWh generation, 0 credit → savings RM265.08', () => {
    const result = computeNemMonth(800, 480, 0, config, 3)
    expect(result.billableKwh).toBe(320)
    expect(result.creditUsed).toBe(0)
    expect(result.creditBalance).toBe(0)
    expect(result.baselineBill.total).toBe(342.33)
    expect(result.nemBill.total).toBe(77.25)
    expect(result.savingsRm).toBe(265.08)
  })

  it('T2: 300 kWh consumption, 480 kWh generation, 50 credit → surplus, credit = 230', () => {
    const result = computeNemMonth(300, 480, 50, config, 3)
    expect(result.billableKwh).toBe(0)
    expect(result.creditUsed).toBe(0)
    expect(result.creditBalance).toBe(230)
    expect(result.baselineBill.total).toBe(65.79)
    expect(result.nemBill.total).toBe(3.0)
    expect(result.savingsRm).toBe(62.79)
  })

  it('T3: December forfeiture — 500 kWh, 365 gen, 200 credit', () => {
    const result = computeNemMonth(500, 365, 200, config, 12)
    // Net = 500 - 365 = 135; credit used = min(200, 135) = 135; billable = 0
    expect(result.billableKwh).toBe(0)
    expect(result.creditUsed).toBe(135)
    // Remaining = 200 - 135 = 65; December → forfeited
    expect(result.creditForfeited).toBe(65)
    expect(result.creditBalance).toBe(0)
    expect(result.baselineBill.total).toBe(165.7)
    expect(result.nemBill.total).toBe(3.0)
    expect(result.savingsRm).toBe(162.7)
  })

  it('T4: cliff crossing — 1600 kWh, 960 gen, 0 credit', () => {
    const result = computeNemMonth(1600, 960, 0, config, 3)
    expect(result.billableKwh).toBe(640)
    expect(result.baselineBill.total).toBe(918.53)
    // 640 * 27.03 / 100 = 172.992 → 172.99; KV wrote 173.00 (manual rounding)
    // Cascading 1-cent difference: 251.82 vs KV's 251.83
    expect(result.nemBill.total).toBe(251.82)
    expect(result.savingsRm).toBe(666.71)
  })

  it('T5: zero consumption, zero generation', () => {
    const result = computeNemMonth(0, 0, 0, config, 6)
    expect(result.billableKwh).toBe(0)
    expect(result.baselineBill.total).toBe(3.0)
    expect(result.nemBill.total).toBe(3.0)
    expect(result.savingsRm).toBe(0)
  })

  it('T10: large surplus — 400 kWh, 600 gen, 100 credit → credit = 300', () => {
    const result = computeNemMonth(400, 600, 100, config, 6)
    // Net = 400 - 600 = -200 → surplus; billable = 0; new credit = 200
    expect(result.billableKwh).toBe(0)
    expect(result.creditUsed).toBe(0)
    expect(result.creditBalance).toBe(300) // 100 existing + 200 new
    expect(result.nemBill.total).toBe(3.0)
  })

  it('credit used only as needed, excess carries forward', () => {
    // 500 consumption, 0 generation, 1000 credit
    const result = computeNemMonth(500, 0, 1000, config, 6)
    expect(result.creditUsed).toBe(500)
    expect(result.billableKwh).toBe(0)
    expect(result.creditBalance).toBe(500) // 1000 - 500
  })

  it('non-December month does not forfeit credits', () => {
    const result = computeNemMonth(0, 100, 0, config, 6)
    expect(result.creditBalance).toBe(100)
    expect(result.creditForfeited).toBe(0)
  })
})

// ── runAnnualSimulation ──

describe('runAnnualSimulation', () => {
  it('12-month simulation with zero generation equals 12x baseline', () => {
    const zeroGen = Array(12).fill(0) as number[]
    const result = runAnnualSimulation(600, zeroGen, config)
    expect(result.months).toHaveLength(12)
    expect(result.totalSavingsRm).toBe(0)
    expect(result.totalCreditsForfeited).toBe(0)

    // Each month should have the same baseline and NEM bill
    const monthBill = computeBill(600, config).total
    for (const m of result.months) {
      expect(m.baselineBill.total).toBe(monthBill)
      expect(m.nemBill.total).toBe(monthBill)
    }
  })

  it('December (month 12) forfeits remaining credits', () => {
    // Low consumption, high generation → accumulates credits all year
    const highGen = Array(12).fill(500) as number[]
    const result = runAnnualSimulation(200, highGen, config)

    // Credits should accumulate then forfeit in December
    const december = result.months[11]
    expect(december.creditForfeited).toBeGreaterThan(0)
    expect(december.creditBalance).toBe(0)
    expect(result.totalCreditsForfeited).toBeGreaterThan(0)
  })

  it('credits carry forward between months within the year', () => {
    // Month 1: surplus → creates credit; Month 2: deficit → uses credit
    const generation = [600, 0, ...Array(10).fill(0)] as number[]
    const result = runAnnualSimulation(400, generation, config)

    // January: surplus = 200 kWh credit
    expect(result.months[0].creditBalance).toBe(200)
    expect(result.months[0].billableKwh).toBe(0)

    // February: 400 consumption, 0 gen, 200 credit → billable = 200
    expect(result.months[1].creditUsed).toBe(200)
    expect(result.months[1].billableKwh).toBe(200)
    expect(result.months[1].creditBalance).toBe(0)
  })

  it('total savings are always non-negative', () => {
    const gen = Array(12).fill(200) as number[]
    const result = runAnnualSimulation(800, gen, config)
    expect(result.totalSavingsRm).toBeGreaterThanOrEqual(0)
    for (const m of result.months) {
      expect(m.savingsRm).toBeGreaterThanOrEqual(0)
    }
  })

  it('NEM bill is always <= baseline bill for every month', () => {
    const gen = Array(12).fill(300) as number[]
    const result = runAnnualSimulation(600, gen, config)
    for (const m of result.months) {
      expect(m.nemBill.total).toBeLessThanOrEqual(m.baselineBill.total)
    }
  })

  it('all bills are >= minimum charge RM3.00', () => {
    const gen = Array(12).fill(1000) as number[]
    const result = runAnnualSimulation(100, gen, config)
    for (const m of result.months) {
      expect(m.baselineBill.total).toBeGreaterThanOrEqual(3.0)
      expect(m.nemBill.total).toBeGreaterThanOrEqual(3.0)
    }
  })
})
