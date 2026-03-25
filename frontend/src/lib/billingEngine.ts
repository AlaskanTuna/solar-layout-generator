import type { TariffRates, TariffThresholds } from '@shared/types'

// ── Output types ──

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

export interface AnnualSimulationResult {
  months: NemMonthResult[]
  totalConsumptionKwh: number
  totalGenerationKwh: number
  totalBaselineRm: number
  totalNemRm: number
  totalSavingsRm: number
  totalCreditsForfeited: number
}

// ── Config ──

export interface BillingConfig {
  rates: TariffRates
  thresholds: TariffThresholds
  eeiTable: [number, number][]
  afaRate: number // sen/kWh for the billing period
}

// ── Helpers ──

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round5sen(n: number): number {
  return Math.round(n * 20) / 20
}

/**
 * Look up EEI rebate rate (sen/kWh) for a given consumption level.
 * The table is sorted ascending by upper-bound kWh.
 * Returns 0 if consumption is 0, negative, or above the cutoff.
 */
export function lookupEeiRebate(consumptionKwh: number, eeiTable: [number, number][]): number {
  if (consumptionKwh <= 0) return 0
  for (const [upperBound, rebateSen] of eeiTable) {
    if (consumptionKwh <= upperBound) return rebateSen
  }
  return 0
}

// ── Core billing ──

/**
 * Compute a monthly TNB domestic bill under RP4 tariff.
 * All tariff parameters come from BillingConfig — nothing is hardcoded.
 *
 * Follows the 10-step algorithm from the Knowledge Vault §4.
 * Returns amounts in RM (ringgit), converting from sen internally.
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

  // 1. Energy charge — threshold-based (not block-based)
  const energyRateSen = kwh <= thresholds.energyCliff ? rates.energyLow : rates.energyHigh
  const energy = (kwh * energyRateSen) / 100

  // 2. Capacity charge
  const capacity = (kwh * rates.capacity) / 100

  // 3. Network charge
  const network = (kwh * rates.network) / 100

  // 4. Retail charge — waived at or below threshold
  const retail = kwh > thresholds.retailWaiver ? rates.retailChargeRm : 0

  // 5. AFA — waived at or below threshold
  const afa = kwh > thresholds.afaWaiver ? (kwh * afaRate) / 100 : 0

  // 6. EEI rebate
  const eeiRateSen = lookupEeiRebate(kwh, eeiTable)
  const eeiRebate = (kwh * eeiRateSen) / 100

  // Round each line item individually (matches real utility billing where
  // each component appears as a rounded RM amount on the bill)
  const rEnergy = round2(energy)
  const rCapacity = round2(capacity)
  const rNetwork = round2(network)
  const rRetail = round2(retail)
  const rAfa = round2(afa)
  const rEei = round2(eeiRebate)

  // 7. Pre-tax subtotal (from rounded line items)
  const preTaxSubtotal = round2(rEnergy + rCapacity + rNetwork + rRetail + rAfa - rEei)

  // 8. RE Fund — exempt at or below threshold (from rounded base charges)
  const reFund = kwh > thresholds.reFundExemption ? round2(rates.reFundRate * (rEnergy + rCapacity + rNetwork)) : 0

  // 9. SST — exempt at or below threshold; prorated to >600 kWh portion only
  const sstFraction = kwh > thresholds.sstExemption ? (kwh - thresholds.sstExemption) / kwh : 0
  const sst = sstFraction > 0 ? round2(rates.sstRate * (preTaxSubtotal + reFund) * sstFraction) : 0

  // 10. Total with minimum charge floor, rounded to nearest 5 sen
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

// ── NEM monthly computation ──

/**
 * Compute one month of NEM billing with credit carry-forward.
 *
 * Implements the 3-phase algorithm from the Knowledge Vault §4:
 * Phase 1: Net import + credit offset
 * Phase 2: Bill on billable kWh
 * Phase 3: Savings = baseline − NEM bill
 *
 * December triggers year-end credit forfeiture.
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

  // Phase 1 — Net import and credit logic
  const withinMonthNet = consumptionKwh - generationKwh
  let billableKwh: number
  let creditUsed: number

  if (withinMonthNet >= 0) {
    // Consumer needs grid power — apply credits
    creditUsed = Math.min(currentCredit, withinMonthNet)
    billableKwh = withinMonthNet - creditUsed
    currentCredit -= creditUsed
  } else {
    // Surplus generation — no bill on generation, earn credit
    billableKwh = 0
    creditUsed = 0
    currentCredit += Math.abs(withinMonthNet)
  }

  // Year-end forfeiture (December = month 12)
  if (month === 12) {
    forfeited = currentCredit
    currentCredit = 0
  }

  // Phase 2 — Bill computation
  const baselineBill = computeBill(consumptionKwh, config)
  const nemBill = computeBill(billableKwh, config)

  // Phase 3 — Savings
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

// ── Annual simulation ──

/**
 * Run a 12-month NEM billing simulation.
 *
 * @param monthlyConsumption - constant or per-month consumption (kWh). A single number is applied to all 12 months;
 *                             an array of 12 values supplies per-month consumption.
 * @param monthlyGeneration  - array of 12 monthly generation values (kWh), index 0 = January
 * @param config             - tariff parameters from TariffConfig
 * @returns Annual simulation with per-month breakdown and totals
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
