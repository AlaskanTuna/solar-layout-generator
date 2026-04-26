import { describe, expect, it } from 'vitest'
import {
  aggregateMonthlyGeneration,
  applyPerformanceRatio,
  buildAnalysisResults,
  buildThresholdWarnings,
  classifyNemFit,
  computeDegradedSavings,
  parseSavedAnalysisConfig,
  summarizeLayoutOrientation
} from '../analysis'
import type { AnnualSimulationResult, NemMonthResult } from '../billingEngine'
import type { RoofSegment, SolarPanel } from '../buildingInsights'
import type { PanelEdit } from '@shared/types'

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

describe('applyPerformanceRatio', () => {
  it('multiplies each month by the given PR and rounds to 2 decimals', () => {
    const result = applyPerformanceRatio([100, 200, 300], 0.8)
    expect(result).toEqual([80, 160, 240])
  })

  it('returns the input unchanged at PR=1.0', () => {
    const raw = [123.45, 50, 0, 999.99]
    expect(applyPerformanceRatio(raw, 1.0)).toEqual(raw)
  })

  it('zeroes generation at PR=0', () => {
    expect(applyPerformanceRatio([100, 200, 300], 0)).toEqual([0, 0, 0])
  })

  it('changing PR from 0.8 to 0.7 reduces every month by 12.5%', () => {
    const baseline = applyPerformanceRatio([1000, 800, 600], 0.8)
    const reduced = applyPerformanceRatio([1000, 800, 600], 0.7)
    baseline.forEach((b, i) => {
      // 0.7 / 0.8 = 0.875 → reduced is 87.5% of baseline (12.5% drop)
      expect(reduced[i]).toBeCloseTo(b * 0.875, 1)
    })
  })

  it('preserves the 12-month length', () => {
    const raw = Array.from({ length: 12 }, (_, i) => (i + 1) * 100)
    const adjusted = applyPerformanceRatio(raw, 0.8)
    expect(adjusted).toHaveLength(12)
  })
})

describe('classifyNemFit', () => {
  it('returns Good when generation ratio ≤ 0.9 and forfeiture rate ≤ 5%', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 8000, // ratio = 0.8
      totalCreditsForfeitedKwh: 200 // forfeiture = 2.5%
    })
    expect(result.fit).toBe('good')
    expect(result.detail).toBe('Low unused credits')
    expect(result.generationRatio).toBeCloseTo(0.8, 4)
    expect(result.forfeitureRate).toBeCloseTo(0.025, 4)
  })

  it('returns Moderate when ratio is 0.9-1.1 and forfeiture is moderate', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 10500, // ratio = 1.05
      totalCreditsForfeitedKwh: 1000 // forfeiture ≈ 9.5%
    })
    expect(result.fit).toBe('moderate')
    expect(result.detail).toBe('Some credit buildup')
  })

  it('returns Oversized when generation ratio > 1.1', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 12000, // ratio = 1.2
      totalCreditsForfeitedKwh: 0
    })
    expect(result.fit).toBe('oversized')
    expect(result.detail).toBe('Excess credits likely')
  })

  it('returns Oversized when forfeiture rate > 15%, even at low ratio', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 8000,
      totalCreditsForfeitedKwh: 1500 // 18.75%
    })
    expect(result.fit).toBe('oversized')
  })

  it('boundary: ratio exactly 0.9 + forfeiture 5% classifies Good', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 9000,
      totalCreditsForfeitedKwh: 450
    })
    expect(result.fit).toBe('good')
  })

  it('boundary: ratio exactly 1.1 + forfeiture 15% classifies Moderate', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 11000,
      totalCreditsForfeitedKwh: 1650
    })
    expect(result.fit).toBe('moderate')
  })

  it('handles zero consumption gracefully (ratio=0)', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 0,
      totalGenerationKwh: 5000,
      totalCreditsForfeitedKwh: 0
    })
    expect(result.generationRatio).toBe(0)
    expect(result.fit).toBe('good')
  })

  it('handles zero generation gracefully (forfeiture=0)', () => {
    const result = classifyNemFit({
      totalConsumptionKwh: 10000,
      totalGenerationKwh: 0,
      totalCreditsForfeitedKwh: 0
    })
    expect(result.forfeitureRate).toBe(0)
    expect(result.generationRatio).toBe(0)
    expect(result.fit).toBe('good')
  })
})

describe('summarizeLayoutOrientation', () => {
  // Three roof segments: south, east, north
  const segments: RoofSegment[] = [
    { azimuthDegrees: 180, pitchDegrees: 22 },
    { azimuthDegrees: 90, pitchDegrees: 18 },
    { azimuthDegrees: 0, pitchDegrees: 30 }
  ]

  // Five source panels: 3 on south, 1 on east, 1 on north
  const solarPanels: SolarPanel[] = [
    { id: 'p0', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
    { id: 'p1', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
    { id: 'p2', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 400, segmentIndex: 0 },
    { id: 'p3', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 350, segmentIndex: 1 },
    { id: 'p4', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 200, segmentIndex: 2 }
  ]

  const editFor = (id: string): PanelEdit => ({
    id,
    status: 'kept',
    center: { lat: 0, lng: 0 },
    rotation: 0,
    monthlyEnergyDcKwh: Array(12).fill(30)
  })

  it('returns null when there are no active panels', () => {
    expect(summarizeLayoutOrientation([], solarPanels, segments)).toBeNull()
  })

  it('returns null when there are no roof segments', () => {
    expect(summarizeLayoutOrientation([editFor('p0')], solarPanels, [])).toBeNull()
  })

  it('returns the segment azimuth/pitch for a single-segment layout', () => {
    const result = summarizeLayoutOrientation(
      [editFor('p0'), editFor('p1'), editFor('p2')],
      solarPanels,
      segments
    )
    expect(result).not.toBeNull()
    expect(result!.azimuthDegrees).toBeCloseTo(180, 0)
    expect(result!.pitchDegrees).toBeCloseTo(22, 1)
    expect(result!.dominantSegmentIndex).toBe(0)
    expect(result!.segmentCount).toBe(1)
    expect(result!.panelCount).toBe(3)
  })

  it('weights azimuth and pitch by panel count across segments', () => {
    const result = summarizeLayoutOrientation(
      [editFor('p0'), editFor('p1'), editFor('p2'), editFor('p3')],
      solarPanels,
      segments
    )
    expect(result).not.toBeNull()
    expect(result!.dominantSegmentIndex).toBe(0)
    expect(result!.segmentCount).toBe(2)
    expect(result!.panelCount).toBe(4)
    // Pitch: weighted = (3*22 + 1*18) / 4 = 21
    expect(result!.pitchDegrees).toBeCloseTo(21, 1)
    // Azimuth: circular mean of 3×180° + 1×90° leans heavily toward south
    expect(result!.azimuthDegrees).toBeGreaterThan(135)
    expect(result!.azimuthDegrees).toBeLessThan(180)
  })

  it('handles azimuths near 0/360 boundary via circular mean (no naïve average)', () => {
    const wrapSegs: RoofSegment[] = [
      { azimuthDegrees: 350, pitchDegrees: 20 },
      { azimuthDegrees: 10, pitchDegrees: 20 }
    ]
    const wrapPanels: SolarPanel[] = [
      { id: 'a', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 1, segmentIndex: 0 },
      { id: 'b', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 1, segmentIndex: 1 }
    ]
    const result = summarizeLayoutOrientation([editFor('a'), editFor('b')], wrapPanels, wrapSegs)
    // Naïve average would give 180°. Circular mean correctly returns ~0°/360°.
    const az = result!.azimuthDegrees
    expect(az < 5 || az > 355).toBe(true)
  })

  it('skips panel ids that are not in solarPanels', () => {
    const result = summarizeLayoutOrientation(
      [editFor('p0'), editFor('does-not-exist')],
      solarPanels,
      segments
    )
    expect(result).not.toBeNull()
    expect(result!.panelCount).toBe(1)
    expect(result!.dominantSegmentIndex).toBe(0)
  })

  it('skips panels whose segmentIndex is out of bounds', () => {
    const oobPanels: SolarPanel[] = [
      ...solarPanels,
      { id: 'oob', center: { lat: 0, lng: 0 }, orientation: 'PORTRAIT', yearlyEnergyDcKwh: 1, segmentIndex: 99 }
    ]
    const result = summarizeLayoutOrientation([editFor('p0'), editFor('oob')], oobPanels, segments)
    expect(result!.panelCount).toBe(1)
    expect(result!.segmentCount).toBe(1)
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

describe('buildAnalysisResults with lifecycle mode', () => {
  it('returns simple payback equal to lifecycle payback when no maintenance/inverter cost is set', () => {
    const result = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0
    })
    expect(result.simplePaybackYears).not.toBeNull()
    expect(result.lifecyclePaybackYears).toEqual(result.simplePaybackYears)
  })

  it('lifecycle payback is longer than simple payback when maintenance is set', () => {
    const result = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0,
      annualMaintenanceRm: 500
    })
    expect(result.simplePaybackYears).not.toBeNull()
    expect(result.lifecyclePaybackYears).not.toBeNull()
    expect(result.lifecyclePaybackYears!).toBeGreaterThan(result.simplePaybackYears!)
  })

  it('lifecycle 25-year net benefit is exactly 25×maintenance + inverter less than simple', () => {
    const annualMaintenanceRm = 500
    const inverterReplacementCostRm = 4500
    const result = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0,
      annualMaintenanceRm,
      inverterReplacementCostRm
    })
    const expectedDelta = 25 * annualMaintenanceRm + inverterReplacementCostRm
    expect(result.simpleTwentyFiveYearNetBenefitRm - result.lifecycleTwentyFiveYearNetBenefitRm).toBeCloseTo(
      expectedDelta,
      1
    )
  })

  it('paybackYears reflects simple mode when analysisMode is "simple"', () => {
    const result = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0,
      analysisMode: 'simple',
      annualMaintenanceRm: 500,
      inverterReplacementCostRm: 4500
    })
    expect(result.paybackYears).toEqual(result.simplePaybackYears)
    expect(result.twentyFiveYearNetBenefitRm).toEqual(result.simpleTwentyFiveYearNetBenefitRm)
    expect(result.analysisMode).toBe('simple')
  })

  it('paybackYears reflects lifecycle mode when analysisMode is "lifecycle"', () => {
    const result = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0.005,
      tariffEscalationRate: 0,
      analysisMode: 'lifecycle',
      annualMaintenanceRm: 500,
      inverterReplacementCostRm: 4500
    })
    expect(result.paybackYears).toEqual(result.lifecyclePaybackYears)
    expect(result.twentyFiveYearNetBenefitRm).toEqual(result.lifecycleTwentyFiveYearNetBenefitRm)
    expect(result.analysisMode).toBe('lifecycle')
  })

  it('inverter replacement is timed correctly via inverterReplacementYear', () => {
    // With 0% degradation/escalation, year1Savings flat at 2400/yr.
    // Annual maintenance 500 → net 1900/yr. Upfront 30000.
    // Without inverter: payback = 30000/1900 = 15.79 years.
    // Inverter cost 6000 added at year 12: cumulative target jumps to 36000 → payback ~18.95 years.
    const result = buildAnalysisResults({
      simulation: baselineSimulation,
      systemCostRm: 30000,
      carbonOffsetFactorKgPerMwh: 720,
      activePanelCount: 12,
      degradationRate: 0,
      tariffEscalationRate: 0,
      analysisMode: 'lifecycle',
      annualMaintenanceRm: 500,
      inverterReplacementCostRm: 6000,
      inverterReplacementYear: 12
    })
    expect(result.lifecyclePaybackYears).not.toBeNull()
    expect(result.lifecyclePaybackYears!).toBeGreaterThan(15)
    expect(result.lifecyclePaybackYears!).toBeLessThan(20)
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
