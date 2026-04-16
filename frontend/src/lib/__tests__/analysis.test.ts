import { describe, expect, it } from 'vitest'
import { aggregateMonthlyGeneration, buildThresholdWarnings } from '../analysis'
import type { NemMonthResult } from '../billingEngine'

const monthResult: NemMonthResult = {
  month: 3,
  consumptionKwh: 800,
  generationKwh: 480,
  billableKwh: 320,
  creditUsed: 0,
  creditBalance: 0,
  creditForfeited: 0,
  baselineBill: {
    kwh: 800,
    energy: 216.24,
    capacity: 36.4,
    network: 102.8,
    retail: 10,
    afa: -22.16,
    eeiRebate: 32,
    preTaxSubtotal: 311.28,
    reFund: 5.69,
    sst: 25.36,
    total: 342.33
  },
  nemBill: {
    kwh: 320,
    energy: 86.5,
    capacity: 14.56,
    network: 41.12,
    retail: 0,
    afa: 0,
    eeiRebate: 67.2,
    preTaxSubtotal: 74.98,
    reFund: 2.27,
    sst: 0,
    total: 77.25
  },
  savingsRm: 265.08
}

describe('aggregateMonthlyGeneration', () => {
  it('sums monthly generation across active panels', () => {
    const totals = aggregateMonthlyGeneration([
      {
        id: 'panel_0',
        status: 'kept',
        center: { lat: 0, lng: 0 },
        rotation: 0,
        monthlyEnergyDcKwh: [10, 20, 30]
      },
      {
        id: 'panel_1',
        status: 'moved',
        center: { lat: 0, lng: 0 },
        rotation: 0,
        monthlyEnergyDcKwh: [1.11, 2.22, 3.33]
      }
    ])

    expect(totals[0]).toBe(11.11)
    expect(totals[1]).toBe(22.22)
    expect(totals[2]).toBe(33.33)
    expect(totals.slice(3)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('buildThresholdWarnings', () => {
  it('combines retail, AFA and SST warnings when the thresholds match', () => {
    const warnings = buildThresholdWarnings(monthResult, {
      energyCliff: 1500,
      retailWaiver: 600,
      afaWaiver: 600,
      sstExemption: 600,
      eeiCutoff: 1000,
      reFundExemption: 300
    })

    expect(warnings).toContain(
      'This month drops below 600 kWh after NEM offset, so retail charge, AFA and SST are waived.'
    )
  })

  it('splits threshold warnings when retail, AFA and SST thresholds differ', () => {
    const warnings = buildThresholdWarnings(monthResult, {
      energyCliff: 1500,
      retailWaiver: 700,
      afaWaiver: 650,
      sstExemption: 600,
      eeiCutoff: 1000,
      reFundExemption: 300
    })

    expect(warnings).toContain('This month drops below 700 kWh after NEM offset, so the retail charge is waived.')
    expect(warnings).toContain('This month drops below 650 kWh after NEM offset, so AFA is waived.')
    expect(warnings).toContain('This month drops below 600 kWh after NEM offset, so SST is waived.')
  })
})
