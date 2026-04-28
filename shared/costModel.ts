export type RoofType = 'metal' | 'tile' | 'flat'
export type SupplyPhase = 'single' | 'three'

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

export const costModelDefaults = {
  mountingPerPanel: {
    metal: 200,
    tile: 330,
    flat: 450
  } satisfies Record<RoofType, number>,
  inverterSkus: [
    { model: 'Huawei SUN2000-3KTL-L1', kwac: 3, phase: 'single', priceRm: 3050 },
    { model: 'Huawei SUN2000-5KTL-L1', kwac: 5, phase: 'single', priceRm: 4350 },
    { model: 'Huawei SUN2000-6KTL-M1', kwac: 6, phase: 'three', priceRm: 5700 },
    { model: 'Huawei SUN2000-8KTL-M1', kwac: 8, phase: 'three', priceRm: 6550 },
    { model: 'Huawei SUN2000-10KTL-M1', kwac: 10, phase: 'three', priceRm: 7500 },
    { model: 'Huawei SUN2000-15KTL-M2', kwac: 15, phase: 'three', priceRm: 8550 }
  ] as readonly InverterSku[],
  dcAcMaxRatio: 1.33,
  nemRakyatCapKwac: {
    single: 5,
    three: 12.5
  } satisfies Record<SupplyPhase, number>,
  cccFeeRm: 1000,
  electricalBosBaseRm: 1600,
  electricalBosPerKwpRm: 250,
  scaffoldingTileRm: 2000,
  labourMarkup: 0.18,
  installerMargin: 0.15
}

// Mid-range mounting RM/panel by roof type. Source: docs/MVP-PAGE-3-SOLAR-COST-MODEL.md §3.
export const MOUNTING_PER_PANEL = costModelDefaults.mountingPerPanel

function permitCost(kwac: number, phase: SupplyPhase): { total: number; cccTriggered: boolean } {
  const sedaFee = 7.5 * kwac
  const stampDuty = 10
  const cccTriggered = phase === 'single' && kwac > 5
  return {
    total: sedaFee + stampDuty + (cccTriggered ? costModelDefaults.cccFeeRm : 0),
    cccTriggered
  }
}

function electricalBosCost(kwp: number): number {
  return costModelDefaults.electricalBosBaseRm + costModelDefaults.electricalBosPerKwpRm * kwp
}

// Fires on tile roofs (per doc §3). We don't expose a storeys input, so 2-storey
// metal-roof installations under-book scaffolding by ~RM 2,000 — users can nudge
// the System Cost field manually if needed.
function scaffoldingCost(roofType: RoofType): number {
  return roofType === 'tile' ? costModelDefaults.scaffoldingTileRm : 0
}

function selectInverter(kwp: number, phase: SupplyPhase): InverterSku {
  const phaseCap = costModelDefaults.nemRakyatCapKwac[phase]
  const candidates = costModelDefaults.inverterSkus.filter((sku) => sku.phase === phase && sku.kwac <= phaseCap).sort(
    (a, b) => a.kwac - b.kwac
  )
  for (const sku of candidates) {
    if (sku.kwac * costModelDefaults.dcAcMaxRatio >= kwp) return sku
  }
  // kWp exceeds the NEM Rakyat cap for this phase — pick the largest cap-compliant SKU.
  // AnalysisSidebar already warns when system size exceeds the phase capacity cap.
  return candidates[candidates.length - 1]!
}

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
