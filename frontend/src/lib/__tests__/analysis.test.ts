import { describe, expect, it } from 'vitest'
import {
  aggregateMonthlyGeneration,
  buildAnalysisResults,
  buildThresholdWarnings,
  computeDegradedSavings,
  parseSavedAnalysisConfig
} from '../analysis'
import type { AnnualSimulationResult, NemMonthResult } from '../billingEngine'

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

describe('computeDegradedSavings with tariff escalation', () => {
  it('reproduces legacy degradation-only result when escalation is 0 (default)', () => {
    const legacy = computeDegradedSavings(2400, 0.005, 10)
    const explicit = computeDegradedSavings(2400, 0.005, 10, 0)
    expect(explicit).toBe(legacy)
  })

  it('grows total when escalation is positive', () => {
    const flat = computeDegradedSavings(2400, 0.005, 25, 0)
    const escalated = computeDegradedSavings(2400, 0.005, 25, 0.04)
    expect(escalated).toBeGreaterThan(flat)
  })

  it('compounds escalation on top of degradation per year', () => {
    const year1 = computeDegradedSavings(1000, 0, 1, 0.05)
    const year2 = computeDegradedSavings(1000, 0, 2, 0.05)
    expect(year1).toBeCloseTo(1000, 5) // year 1 = 1000 * 1 * 1
    expect(year2).toBeCloseTo(1000 + 1050, 5) // year 2 = 1000 + 1000*1.05
  })

  it('treats negative degradation*escalation interaction correctly per-year', () => {
    // year1 = year1Savings; year2 = year1 * (1-0.005) * (1+0.04)
    const result = computeDegradedSavings(1000, 0.005, 2, 0.04)
    const expected = 1000 + 1000 * 0.995 * 1.04
    expect(result).toBeCloseTo(expected, 5)
  })
})

const baselineSimulation: AnnualSimulationResult = {
  months: [],
  totalConsumptionKwh: 7200,
  totalGenerationKwh: 6000,
  totalBaselineRm: 3600,
  totalNemRm: 1200,
  totalSavingsRm: 2400,
  totalCreditsForfeited: 0
}

describe('buildAnalysisResults with tariff escalation', () => {
  it('shortens payback when tariff escalation is positive', () => {
    const flat = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0
    })
    const escalated = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0.04
    })
    expect(flat.paybackYears).not.toBeNull()
    expect(escalated.paybackYears).not.toBeNull()
    expect(escalated.paybackYears!).toBeLessThan(flat.paybackYears!)
  })

  it('grows 10-year net benefit when tariff escalation is positive', () => {
    const flat = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0
    })
    const escalated = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0.04
    })
    expect(escalated.tenYearNetBenefitRm).toBeGreaterThan(flat.tenYearNetBenefitRm)
  })

  it('defaults tariffEscalationRate to 0 — backward-compatible signature', () => {
    const explicitZero = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0
    })
    const omitted = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005
    })
    expect(omitted.paybackYears).toEqual(explicitZero.paybackYears)
    expect(omitted.tenYearNetBenefitRm).toEqual(explicitZero.tenYearNetBenefitRm)
  })
})

describe('parseSavedAnalysisConfig (tariff escalation field)', () => {
  it('parses tariffEscalationRate when present', () => {
    const result = parseSavedAnalysisConfig({ tariffEscalationRate: 0.04 })
    expect(result?.tariffEscalationRate).toBe(0.04)
  })

  it('omits tariffEscalationRate when missing', () => {
    const result = parseSavedAnalysisConfig({ degradationRate: 0.005 })
    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).tariffEscalationRate).toBeUndefined()
  })

  it('omits tariffEscalationRate when value is non-numeric', () => {
    const result = parseSavedAnalysisConfig({ tariffEscalationRate: '4%' })
    expect((result as Record<string, unknown>).tariffEscalationRate).toBeUndefined()
  })
})
