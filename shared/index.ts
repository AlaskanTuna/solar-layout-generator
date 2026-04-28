import type { LayoutPreferences } from './layoutPreferences.ts'
import type { PanelEdit } from './panelTypes.ts'
import type { AnalysisConfigDto, AnalysisResultsDto, BuildingInsightsDto } from './projectDtos.ts'
import type { TariffDefaults } from './tariffDefaults.ts'

/**
 * Location processing state shared across API responses
 */
export type LocationStatus = 'processing' | 'ready' | 'failed'

/**
 * Solar imagery quality levels exposed by location APIs
 */
export type ImageryQuality = 'HIGH' | 'BASE'

/**
 * Projects lifecycle state
 */
export type ProjectStatus = 'draft' | 'layout_saved' | 'analysis_saved'

export {
  BILL_RANGE_TO_KWH_PER_MONTH,
  billRangeSchema,
  layoutPreferencesPartialSchema,
  layoutPreferencesSchema,
  roofDirectionSchema,
  sizingGoalSchema
} from './layoutPreferences.ts'
export type { BillRange, LayoutPreferences, RoofDirection, SizingGoal } from './layoutPreferences.ts'

export { panelEditSchema } from './panelTypes.ts'
export type { PanelEdit } from './panelTypes.ts'

/**
 * Resolves location request body
 */
export type ResolveLocationRequest = {
  lat: number
  lng: number
  projectId?: string
  requiredQuality?: ImageryQuality
  expandedCoverage?: boolean
}

/**
 * Resolves location response body
 */
export type ResolveLocationResponse = {
  locationId: string
  status: LocationStatus
}

/**
 * Location status response body
 */
export type LocationStatusResponse = {
  status: LocationStatus
}

/**
 * Location data response body
 */
export type LocationDataResponse = {
  buildingInsights: BuildingInsightsDto
  rgbImageUrl: string
  imageryQuality: ImageryQuality | null
}

/**
 * Probes location response body
 */
export type ProbeLocationResponse = {
  availableQualities: ImageryQuality[]
  bestQuality: ImageryQuality | null
  expandedCoverage: boolean
}

/**
 * Flux recompute request body
 */
export type FluxRecomputeRequest = {
  panelId: string
  center: { lat: number; lng: number }
  rotation: number
  widthM?: number
  heightM?: number
  capacityWp?: number
}

/**
 * Flux recompute response body
 */
export type FluxRecomputeResponse = {
  panelId: string
  monthlyEnergyDcKwh: number[]
}

/**
 * Batch flux recompute request body
 */
export type FluxRecomputeBatchRequest = {
  panels: FluxRecomputeRequest[]
}

/**
 * Batch flux recompute response body
 */
export type FluxRecomputeBatchResponse = {
  results: FluxRecomputeResponse[]
}

/**
 * Creates project request body
 */
export type CreateProjectRequest = {
  name: string
  locationId: string
}

/**
 * Saves layout request body
 */
export type SaveLayoutRequest = {
  editedLayout: PanelEdit[]
  selectedPanelModelId?: string
}

/**
 * Updates layout preferences request body
 */
export type UpdateLayoutPreferencesRequest = {
  layoutPreferences: Partial<LayoutPreferences>
}

/**
 * Saves analysis request body
 */
export type SaveAnalysisRequest = {
  analysisConfig: AnalysisConfigDto
  analysisResults: AnalysisResultsDto
}

/**
 * Tariff rates returned by the config endpoint
 */
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

/**
 * Tariff thresholds returned by the config endpoint
 */
export type TariffThresholds = {
  energyCliff: number
  retailWaiver: number
  afaWaiver: number
  sstExemption: number
  eeiCutoff: number
  reFundExemption: number
}

/**
 * Tariff config response body
 */
export type TariffConfigResponse = {
  rates: TariffRates
  thresholds: TariffThresholds
  eeiTable: [number, number][]
  afaRateDefault: number
  defaults: TariffDefaults
  /** When the seeded rates and AFA were last verified */
  effectiveDate: string | null
  /** Short human-readable source note */
  sourceNote: string | null
}

/**
 * Health check response body
 */
export type HealthResponse = {
  status: 'ok'
}

export {
  analysisConfigSchema,
  analysisResultsSchema,
  buildingInsightsSchema,
  createProjectRequestSchema,
  saveAnalysisRequestSchema,
  saveLayoutRequestSchema,
  storedAnalysisConfigSchema,
  updateLayoutPreferencesRequestSchema
} from './projectDtos.ts'
export type {
  AnalysisConfigDto,
  AnalysisResultsDto,
  BuildingInsightsDto,
  StoredAnalysisConfigDto
} from './projectDtos.ts'

export type { PanelModel } from './panelTypes.ts'
export { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from './panelModels.ts'

export { computeSystemCost, MOUNTING_PER_PANEL } from './costModel.ts'
export type { CostBreakdown, CostInputs, RoofType, SupplyPhase } from './costModel.ts'

export { TIER_DAILY_LIMITS, WARNING_THRESHOLD } from './quota.ts'
export type { UserTier, QuotaSummary } from './quota.ts'

export { tariffDefaults } from './tariffDefaults.ts'
export type { TariffDefaults } from './tariffDefaults.ts'
