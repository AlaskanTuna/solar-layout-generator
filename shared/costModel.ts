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

// Mid-range mounting RM/panel by roof type. Source: docs/MVP-PAGE-3-SOLAR-COST-MODEL.md §3.
export const MOUNTING_PER_PANEL: Record<RoofType, number> = {
  metal: 200,
  tile: 330,
  flat: 450
}

type InverterSku = {
  model: string
  kwac: number
  phase: SupplyPhase
  priceRm: number
}

// Mid-tier inverter SKUs. Prices are mid-range retail from doc §2.
// TODO(post-MVP): expose tier selector (budget/mid/premium). See doc §6 for
// tier A/B coefficients (budget A=2400/B=5400, mid A=3300/B=5400, premium A=4200/B=6000).
const INVERTER_SKUS: readonly InverterSku[] = [
  { model: 'Huawei SUN2000-3KTL-L1', kwac: 3, phase: 'single', priceRm: 3050 },
  { model: 'Huawei SUN2000-5KTL-L1', kwac: 5, phase: 'single', priceRm: 4350 },
  { model: 'Huawei SUN2000-6KTL-M1', kwac: 6, phase: 'three', priceRm: 5700 },
  { model: 'Huawei SUN2000-8KTL-M1', kwac: 8, phase: 'three', priceRm: 6550 },
  { model: 'Huawei SUN2000-10KTL-M1', kwac: 10, phase: 'three', priceRm: 7500 },
  { model: 'Huawei SUN2000-15KTL-M2', kwac: 15, phase: 'three', priceRm: 8550 }
]

// Manufacturer-permitted DC:AC upper bound. Matches doc §2 worked examples
// (8 kW inverter paired with 10 kWp array at ratio 1.25).
const DC_AC_MAX_RATIO = 1.33

// NEM Rakyat 3.0 capacity caps per supply phase (5 kWac single / 12.5 kWac three). Doc §5.
const NEM_RAKYAT_CAP_KWAC: Record<SupplyPhase, number> = {
  single: 5,
  three: 12.5
}

const CCC_FEE_RM = 1000

function permitCost(kwac: number, phase: SupplyPhase): { total: number; cccTriggered: boolean } {
  const sedaFee = 7.5 * kwac
  const stampDuty = 10
  const cccTriggered = phase === 'single' && kwac > 5
  return {
    total: sedaFee + stampDuty + (cccTriggered ? CCC_FEE_RM : 0),
    cccTriggered
  }
}

function electricalBosCost(kwp: number): number {
  return 1600 + 250 * kwp
}

// Fires on tile roofs (per doc §3). We don't expose a storeys input, so 2-storey
// metal-roof installations under-book scaffolding by ~RM 2,000 — users can nudge
// the System Cost field manually if needed.
function scaffoldingCost(roofType: RoofType): number {
  return roofType === 'tile' ? 2000 : 0
}

const LABOUR_MARKUP = 0.18
const INSTALLER_MARGIN = 0.15

function selectInverter(kwp: number, phase: SupplyPhase): InverterSku {
  const phaseCap = NEM_RAKYAT_CAP_KWAC[phase]
  const candidates = INVERTER_SKUS.filter((sku) => sku.phase === phase && sku.kwac <= phaseCap).sort(
    (a, b) => a.kwac - b.kwac
  )
  for (const sku of candidates) {
    if (sku.kwac * DC_AC_MAX_RATIO >= kwp) return sku
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
  const labour = hardwareSubtotal * LABOUR_MARKUP
  const installerMargin = (hardwareSubtotal + labour) * INSTALLER_MARGIN
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
