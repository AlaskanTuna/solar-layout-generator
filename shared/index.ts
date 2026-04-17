/* LOCATION */

export type LocationStatus = 'processing' | 'ready' | 'failed'

/* PROJECT */

export type ProjectStatus = 'draft' | 'layout_saved' | 'analysis_saved'

/* PANEL EDIT */

export type PanelEdit = {
  id: string
  status: 'kept' | 'moved' | 'deleted'
  center: { lat: number; lng: number }
  rotation: number
  monthlyEnergyDcKwh: number[]
}

/* API REQUEST / RESPONSE TYPES */

export type ResolveLocationRequest = {
  lat: number
  lng: number
  projectId?: string
}

export type ResolveLocationResponse = {
  locationId: string
  status: LocationStatus
}

export type LocationStatusResponse = {
  status: LocationStatus
}

export type LocationDataResponse = {
  buildingInsights: Record<string, unknown>
  rgbImageUrl: string
}

export type FluxRecomputeRequest = {
  panelId: string
  center: { lat: number; lng: number }
  rotation: number
  widthM?: number
  heightM?: number
  capacityWp?: number
}

export type FluxRecomputeResponse = {
  panelId: string
  monthlyEnergyDcKwh: number[]
}

export type FluxRecomputeBatchRequest = {
  panels: FluxRecomputeRequest[]
}

export type FluxRecomputeBatchResponse = {
  results: FluxRecomputeResponse[]
}

export type CreateProjectRequest = {
  name: string
  locationId: string
}

export type SaveLayoutRequest = {
  editedLayout: PanelEdit[]
  selectedPanelModelId?: string
}

export type SaveAnalysisRequest = {
  analysisConfig: Record<string, unknown>
  analysisResults: Record<string, unknown>
}

export type TariffRates = {
  energyLow: number
  energyHigh: number
  capacity: number
  network: number
  retailChargeRm: number
  sstRate: number
  reFundRate: number
  minChargeRm: number
}

export type TariffThresholds = {
  energyCliff: number
  retailWaiver: number
  afaWaiver: number
  sstExemption: number
  eeiCutoff: number
  reFundExemption: number
}

export type TariffDefaults = {
  nemCapSinglePhaseKw: number
  nemCapThreePhaseKw: number
  systemCostPerKwp: number
  annualYieldPerKwp: number
}

export type TariffConfigResponse = {
  rates: TariffRates
  thresholds: TariffThresholds
  eeiTable: [number, number][]
  afaRateDefault: number
  defaults: TariffDefaults
}

export type HealthResponse = {
  status: 'ok'
}

/* PANEL MODEL */

export interface PanelModel {
  id: string
  name: string
  manufacturer: string
  widthM: number
  heightM: number
  capacityWp: number
  efficiency: number
  costPerWp: number // RM per Wp (panel module cost only; installation multiplier applied at analysis time)
  tagline?: string // short distinguishing factor shown in the model picker
}

export { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from './panelModels'

export { computeSystemCost, MOUNTING_PER_PANEL } from './costModel'
export type { CostBreakdown, CostInputs, RoofType, SupplyPhase } from './costModel'

export { TIER_DAILY_LIMITS, WARNING_THRESHOLD } from './quota'
export type { UserTier, QuotaSummary } from './quota'
