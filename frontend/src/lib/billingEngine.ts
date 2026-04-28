import type { TariffRates, TariffThresholds } from '@shared/types'

/** Itemized monthly TNB bill — every line that appears on a printed bill, plus subtotals. */
export interface BillBreakdown {
  kwh: number
  energy: number
  capacity: number
  network: number
  retail: number
  afa: number
  eeiRebate: number
  preTaxSubtotal: number
  reFund: number
  sst: number
  total: number
}

/** Single-month output of the NEM simulation: baseline bill, NEM bill, savings, and credit flow. */
export interface NemMonthResult {
  month: number
  consumptionKwh: number
  generationKwh: number
  billableKwh: number
  creditUsed: number
  creditBalance: number
  creditForfeited: number
  baselineBill: BillBreakdown
  nemBill: BillBreakdown
  savingsRm: number
}

/** 12-month aggregate of {@link NemMonthResult} entries plus annual totals (RM, kWh, forfeited credits). */
export interface AnnualSimulationResult {
  months: NemMonthResult[]
  totalConsumptionKwh: number
  totalGenerationKwh: number
  totalBaselineRm: number
  totalNemRm: number
  totalSavingsRm: number
  totalCreditsForfeited: number
}

/** Tariff configuration consumed by {@link computeBill} — rates, tier thresholds, EEI table, and AFA rate. */
export interface BillingConfig {
  rates: TariffRates
  thresholds: TariffThresholds
  eeiTable: [number, number][]
  afaRate: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round5sen(n: number): number {
  return Math.round(n * 20) / 20
}

/**
 * Looks up the EEI rebate rate (sen/kWh) for a given monthly consumption.
 * `eeiTable` is sorted ascending; first row whose `upperBound >= consumptionKwh` wins.
 *
 * @param consumptionKwh - Monthly billable consumption (kWh)
 * @param eeiTable - Sorted `[upperBound, rebateSen]` pairs from the tariff config
 * @returns Rebate rate in sen per kWh, or `0` if outside the table or non-positive consumption
 */
export function lookupEeiRebate(consumptionKwh: number, eeiTable: [number, number][]): number {
  if (consumptionKwh <= 0) return 0
  for (const [upperBound, rebateSen] of eeiTable) {
    if (consumptionKwh <= upperBound) return rebateSen
  }
  return 0
}

/**
 * Computes a monthly TNB domestic bill under the post-July-2025 RP4 tariff.
 * Applies energy/capacity/network rates with tier cliffs, EEI rebate, AFA, RE Fund, and SST.
 * Returns a fully itemized breakdown.
 *
 * @param kwh - Billable consumption for the month. `<= 0` returns the `minChargeRm` floor
 * @param config - Tariff rates, thresholds, EEI table, and AFA rate
 * @returns Itemized {@link BillBreakdown} including pre-tax subtotal and final total
 */
export function computeBill(kwh: number, config: BillingConfig): BillBreakdown {
  if (kwh <= 0) {
    return {
      kwh: 0,
      energy: 0,
      capacity: 0,
      network: 0,
      retail: 0,
      afa: 0,
      eeiRebate: 0,
      preTaxSubtotal: 0,
      reFund: 0,
      sst: 0,
      total: config.rates.minChargeRm
    }
  }

  const { rates, thresholds, eeiTable, afaRate } = config

  const energyRateSen = kwh <= thresholds.energyCliff ? rates.energyLow : rates.energyHigh
  const energy = (kwh * energyRateSen) / 100

  const capacity = (kwh * rates.capacity) / 100

  const network = (kwh * rates.network) / 100

  const retail = kwh > thresholds.retailWaiver ? rates.retailChargeRm : 0

  const afa = kwh > thresholds.afaWaiver ? (kwh * afaRate) / 100 : 0

  const eeiRateSen = lookupEeiRebate(kwh, eeiTable)
  const eeiRebate = (kwh * eeiRateSen) / 100

  const rEnergy = round2(energy)
  const rCapacity = round2(capacity)
  const rNetwork = round2(network)
  const rRetail = round2(retail)
  const rAfa = round2(afa)
  const rEei = round2(eeiRebate)

  const preTaxSubtotal = round2(rEnergy + rCapacity + rNetwork + rRetail + rAfa - rEei)

  const reFund = kwh > thresholds.reFundExemption ? round2(rates.reFundRate * (rEnergy + rCapacity + rNetwork)) : 0

  const sstFraction = kwh > thresholds.sstExemption ? (kwh - thresholds.sstExemption) / kwh : 0
  const sst = sstFraction > 0 ? round2(rates.sstRate * (preTaxSubtotal + reFund) * sstFraction) : 0

  const total = round5sen(Math.max(preTaxSubtotal + reFund + sst, rates.minChargeRm))

  return {
    kwh: round2(kwh),
    energy: rEnergy,
    capacity: rCapacity,
    network: rNetwork,
    retail: rRetail,
    afa: rAfa,
    eeiRebate: rEei,
    preTaxSubtotal,
    reFund,
    sst,
    total
  }
}

/**
 * Simulates one month of NEM billing with credit carry-forward.
 * If solar generation exceeds consumption, the surplus is added to `creditBalance`.
 * If consumption exceeds generation, the shortfall is offset by available credits before
 * being billed. December (`month === 12`) forfeits any remaining balance per NEM rules.
 *
 * @param consumptionKwh - Household consumption for the month
 * @param generationKwh - Solar generation for the month (DC kWh, post-PR derate)
 * @param creditBalance - Credits carried in from the previous month
 * @param config - Tariff config used for both baseline and NEM bills
 * @param month - 1–12 (December triggers credit forfeiture)
 * @returns {@link NemMonthResult} with both the baseline and NEM-adjusted bills, savings, and updated credits
 */
export function computeNemMonth(
  consumptionKwh: number,
  generationKwh: number,
  creditBalance: number,
  config: BillingConfig,
  month: number // 1–12
): NemMonthResult {
  let currentCredit = creditBalance
  let forfeited = 0

  const withinMonthNet = consumptionKwh - generationKwh
  let billableKwh: number
  let creditUsed: number

  if (withinMonthNet >= 0) {
    creditUsed = Math.min(currentCredit, withinMonthNet)
    billableKwh = withinMonthNet - creditUsed
    currentCredit -= creditUsed
  } else {
    billableKwh = 0
    creditUsed = 0
    currentCredit += Math.abs(withinMonthNet)
  }

  if (month === 12) {
    forfeited = currentCredit
    currentCredit = 0
  }

  const baselineBill = computeBill(consumptionKwh, config)
  const nemBill = computeBill(billableKwh, config)

  const savingsRm = round2(baselineBill.total - nemBill.total)

  return {
    month,
    consumptionKwh: round2(consumptionKwh),
    generationKwh: round2(generationKwh),
    billableKwh: round2(billableKwh),
    creditUsed: round2(creditUsed),
    creditBalance: round2(currentCredit),
    creditForfeited: round2(forfeited),
    baselineBill,
    nemBill,
    savingsRm
  }
}

/**
 * Run a 12-month NEM billing simulation with credit carry-forward
 * @param {number | number[]} monthlyConsumption - Collection of monthly consumption values
 * @param {number[]} monthlyGeneration - Collection of monthly generation values
 * @param {BillingConfig} config - Value used for config
 * @returns {AnnualSimulationResult} The resulting run annual simulation value
 */
export function runAnnualSimulation(
  monthlyConsumption: number | number[],
  monthlyGeneration: number[],
  config: BillingConfig
): AnnualSimulationResult {
  const consumptionArr = Array.isArray(monthlyConsumption)
    ? monthlyConsumption
    : Array.from({ length: 12 }, () => monthlyConsumption)

  const months: NemMonthResult[] = []
  let creditBalance = 0

  for (let i = 0; i < 12; i++) {
    const consumption = consumptionArr[i] ?? 0
    const generation = monthlyGeneration[i] ?? 0
    const result = computeNemMonth(consumption, generation, creditBalance, config, i + 1)
    creditBalance = result.creditBalance
    months.push(result)
  }

  const totalConsumptionKwh = round2(months.reduce((sum, m) => sum + m.consumptionKwh, 0))
  const totalGenerationKwh = round2(months.reduce((sum, m) => sum + m.generationKwh, 0))
  const totalBaselineRm = round2(months.reduce((sum, m) => sum + m.baselineBill.total, 0))
  const totalNemRm = round2(months.reduce((sum, m) => sum + m.nemBill.total, 0))
  const totalSavingsRm = round2(months.reduce((sum, m) => sum + m.savingsRm, 0))
  const totalCreditsForfeited = round2(months.reduce((sum, m) => sum + m.creditForfeited, 0))

  return {
    months,
    totalConsumptionKwh,
    totalGenerationKwh,
    totalBaselineRm,
    totalNemRm,
    totalSavingsRm,
    totalCreditsForfeited
  }
}
