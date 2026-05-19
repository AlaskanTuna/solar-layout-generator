/**
 * Installed-system cost model shared between backend and frontend.
 *
 * Computes the all-in installation cost for a residential solar system from
 * a few primary inputs (panel count, panel watts, panel cost per watt, roof
 * type, supply phase). Picks an appropriately-sized Huawei SUN2000 inverter
 * from the SKU table, adds permit / electrical balance-of-system /
 * scaffolding / labour / installer margin, and returns a transparent
 * breakdown.
 *
 * Defaults under `costModelDefaults` are anchored to Malaysian residential
 * installation pricing as of mid-2025. They are treated as data, not magic
 * numbers, so cost assumptions can be tuned in one place.
 */

/** Roof types accepted by the cost model. Drives mounting and scaffolding cost. */
export type RoofType = 'metal' | 'tile' | 'flat'
/** Electrical supply phases. Single-phase is capped at lower NEM AC capacity. */
export type SupplyPhase = 'single' | 'three'

/**
 * Itemised installed-system cost breakdown.
 *
 * All RM values are pre-tax. `inverterSku` / `inverterKwac` identify the
 * Huawei SUN2000 picked by `selectInverter`. `cccFeeTriggered` flags when
 * the SEDA Certificate of Conformance fee applies (single-phase > 5 kWac).
 */
export type CostBreakdown = {
  panels: number
  inverter: number
  mounting: number
  electricalBos: number
  scaffolding: number
  permit: number
  hardwareSubtotal: number
  labour: number
  installerMargin: number
  total: number
  inverterSku: string
  inverterKwac: number
  cccFeeTriggered: boolean
}

/** Inputs required to compute a system cost. */
export type CostInputs = {
  panelCount: number
  panelWattageWp: number
  panelCostPerWp: number
  roofType: RoofType
  supplyPhase: SupplyPhase
}

type InverterSku = {
  model: string
  kwac: number
  phase: SupplyPhase
  priceRm: number
}

/**
 * Default assumptions used by the pricing model. Centralised so cost
 * adjustments touch one place. See module-level header for sourcing notes.
 */
export const costModelDefaults = {
  /** Per-panel mounting cost by roof type (metal cheapest, flat most expensive). */
  mountingPerPanel: {
    metal: 200,
    tile: 330,
    flat: 450
  } satisfies Record<RoofType, number>,
  /** Huawei SUN2000 SKU table. Sorted ascending by capacity in `selectInverter`. */
  inverterSkus: [
    { model: 'Huawei SUN2000-3KTL-L1', kwac: 3, phase: 'single', priceRm: 3050 },
    { model: 'Huawei SUN2000-5KTL-L1', kwac: 5, phase: 'single', priceRm: 4350 },
    { model: 'Huawei SUN2000-6KTL-M1', kwac: 6, phase: 'three', priceRm: 5700 },
    { model: 'Huawei SUN2000-8KTL-M1', kwac: 8, phase: 'three', priceRm: 6550 },
    { model: 'Huawei SUN2000-10KTL-M1', kwac: 10, phase: 'three', priceRm: 7500 },
    { model: 'Huawei SUN2000-15KTL-M2', kwac: 15, phase: 'three', priceRm: 8550 }
  ] as readonly InverterSku[],
  /** Max DC:AC oversizing ratio. Huawei specs allow ~1.33. */
  dcAcMaxRatio: 1.33,
  /** Tariff Rakyat AC capacity caps by supply phase. */
  nemRakyatCapKwac: {
    single: 5,
    three: 12.5
  } satisfies Record<SupplyPhase, number>,
  /** SEDA Certificate of Conformance fee — only single-phase > 5 kWac. */
  cccFeeRm: 1000,
  electricalBosBaseRm: 1600,
  electricalBosPerKwpRm: 250,
  scaffoldingTileRm: 2000,
  /** Labour markup as a fraction of hardware subtotal. */
  labourMarkup: 0.18,
  /** Installer profit margin as a fraction of (hardware + labour). */
  installerMargin: 0.15
}

/** Mounting cost per panel by roof type — re-exported for the frontend cost UI. */
export const MOUNTING_PER_PANEL = costModelDefaults.mountingPerPanel

/**
 * SEDA permit cost (RM 7.50/kWac feed-in plus RM 10 stamp duty) plus the
 * CCC fee when the system is single-phase above 5 kWac.
 */
function permitCost(kwac: number, phase: SupplyPhase): { total: number; cccTriggered: boolean } {
  const sedaFee = 7.5 * kwac
  const stampDuty = 10
  const cccTriggered = phase === 'single' && kwac > 5
  return {
    total: sedaFee + stampDuty + (cccTriggered ? costModelDefaults.cccFeeRm : 0),
    cccTriggered
  }
}

/** Electrical balance-of-system: fixed base cost plus a per-kWp adder. */
function electricalBosCost(kwp: number): number {
  return costModelDefaults.electricalBosBaseRm + costModelDefaults.electricalBosPerKwpRm * kwp
}

/** Tile roofs need scaffolding; metal and flat roofs do not. */
function scaffoldingCost(roofType: RoofType): number {
  return roofType === 'tile' ? costModelDefaults.scaffoldingTileRm : 0
}

/**
 * Picks the smallest inverter SKU whose AC capacity (× the DC:AC oversize
 * ratio) can carry the array's DC kWp, constrained by the phase's Tariff
 * Rakyat cap. Falls back to the largest eligible SKU when no candidate fits
 * within the oversize ratio.
 */
function selectInverter(kwp: number, phase: SupplyPhase): InverterSku {
  const phaseCap = costModelDefaults.nemRakyatCapKwac[phase]
  const candidates = costModelDefaults.inverterSkus
    .filter((sku) => sku.phase === phase && sku.kwac <= phaseCap)
    .sort((a, b) => a.kwac - b.kwac)
  for (const sku of candidates) {
    if (sku.kwac * costModelDefaults.dcAcMaxRatio >= kwp) return sku
  }
  return candidates[candidates.length - 1]!
}

/**
 * Computes the all-in installed system cost from a panel count and the
 * chosen roof + supply-phase combination. Returns an itemised breakdown so
 * the frontend can show users where their money goes.
 *
 * @param inputs - Panel count, watts, cost-per-watt, roof type, supply phase
 * @returns Itemised cost breakdown in RM
 */
export function computeSystemCost(inputs: CostInputs): CostBreakdown {
  const kwp = (inputs.panelCount * inputs.panelWattageWp) / 1000

  const panels = inputs.panelCount * inputs.panelWattageWp * inputs.panelCostPerWp
  const inverter = selectInverter(kwp, inputs.supplyPhase)
  const mounting = inputs.panelCount * MOUNTING_PER_PANEL[inputs.roofType]
  const electricalBos = electricalBosCost(kwp)
  const scaffolding = scaffoldingCost(inputs.roofType)
  const permit = permitCost(inverter.kwac, inputs.supplyPhase)

  const hardwareSubtotal = panels + inverter.priceRm + mounting + electricalBos + scaffolding + permit.total
  const labour = hardwareSubtotal * costModelDefaults.labourMarkup
  const installerMargin = (hardwareSubtotal + labour) * costModelDefaults.installerMargin
  const total = hardwareSubtotal + labour + installerMargin

  return {
    panels: Math.round(panels),
    inverter: inverter.priceRm,
    mounting: Math.round(mounting),
    electricalBos: Math.round(electricalBos),
    scaffolding,
    permit: permit.total,
    hardwareSubtotal: Math.round(hardwareSubtotal),
    labour: Math.round(labour),
    installerMargin: Math.round(installerMargin),
    total: Math.round(total),
    inverterSku: inverter.model,
    inverterKwac: inverter.kwac,
    cccFeeTriggered: permit.cccTriggered
  }
}
