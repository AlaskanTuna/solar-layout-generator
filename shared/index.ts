import type { LayoutPreferences } from './layoutPreferences.ts'
import type { PanelEdit } from './panelTypes.ts'
import type { AnalysisConfigDto, AnalysisResultsDto, BuildingInsightsDto } from './projectDtos.ts'
import type { TariffDefaults } from './tariffDefaults.ts'

/* LOCATION */

export type LocationStatus = 'processing' | 'ready' | 'failed'

export type ImageryQuality = 'HIGH' | 'BASE'

/* PROJECT */

export type ProjectStatus = 'draft' | 'layout_saved' | 'analysis_saved'

/* LAYOUT PRESET (W-1) */

export {
  BILL_RANGE_TO_KWH_PER_MONTH,
  billRangeSchema,
  layoutPreferencesPartialSchema,
  layoutPreferencesSchema,
  roofDirectionSchema,
  sizingGoalSchema
} from './layoutPreferences.ts'
export type { BillRange, LayoutPreferences, RoofDirection, SizingGoal } from './layoutPreferences.ts'

/* PANEL EDIT */

export { panelEditSchema } from './panelTypes.ts'
export type { PanelEdit } from './panelTypes.ts'

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
  buildingInsights: BuildingInsightsDto
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
  analysisConfig: AnalysisConfigDto
  analysisResults: AnalysisResultsDto
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

/* PANEL MODEL */

export type { PanelModel } from './panelTypes.ts'
export { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from './panelModels.ts'

export { computeSystemCost, MOUNTING_PER_PANEL } from './costModel.ts'
export type { CostBreakdown, CostInputs, RoofType, SupplyPhase } from './costModel.ts'

export { TIER_DAILY_LIMITS, WARNING_THRESHOLD } from './quota.ts'
export type { UserTier, QuotaSummary } from './quota.ts'

export { tariffDefaults } from './tariffDefaults.ts'
export type { TariffDefaults } from './tariffDefaults.ts'
