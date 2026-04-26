/* LOCATION */

export type LocationStatus = 'processing' | 'ready' | 'failed'

export type ImageryQuality = 'HIGH' | 'BASE'

/* PROJECT */

export type ProjectStatus = 'draft' | 'layout_saved' | 'analysis_saved'

/* LAYOUT PRESET (W-1) */

export type BillRange = '<100' | '100-200' | '200-400' | '400-600' | '600+' | 'unknown'

export type SizingGoal = 'conservative' | 'balanced' | 'maximum' | 'custom'

export type RoofDirection = 'any' | 'south' | 'east' | 'west' | 'north'

export type LayoutPreferences = {
  billRange?: BillRange
  sizingGoal: SizingGoal
  roofDirection?: RoofDirection
  dismissedAt?: string
}

// Estimated monthly kWh consumption by bill bucket — derived from average TNB blended
// residential tariff (~RM 0.35/kWh after capacity, network, retail, AFA, and SST).
// Midpoints chosen to err slightly conservative so balanced/conservative presets do
// not over-size systems.
export const BILL_RANGE_TO_KWH_PER_MONTH: Record<BillRange, number> = {
  '<100': 250,
  '100-200': 450,
  '200-400': 800,
  '400-600': 1300,
  '600+': 1800,
  unknown: 600
}

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
  requiredQuality?: ImageryQuality
  expandedCoverage?: boolean
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
  imageryQuality: ImageryQuality | null
}

export type ProbeLocationResponse = {
  availableQualities: ImageryQuality[]
  bestQuality: ImageryQuality | null
  expandedCoverage: boolean
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

export type UpdateLayoutPreferencesRequest = {
  layoutPreferences: Partial<LayoutPreferences>
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
  /** When the seeded rates/AFA were last verified against TNB sources. ISO-8601 string when present. */
  effectiveDate: string | null
  /** Short human-readable note about the source publication or revision cycle. */
  sourceNote: string | null
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

export { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from './panelModels.ts'

export { computeSystemCost, MOUNTING_PER_PANEL } from './costModel.ts'
export type { CostBreakdown, CostInputs, RoofType, SupplyPhase } from './costModel.ts'

export { TIER_DAILY_LIMITS, WARNING_THRESHOLD } from './quota.ts'
export type { UserTier, QuotaSummary } from './quota.ts'
