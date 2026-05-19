/**
 * Shared type and schema barrel.
 *
 * Single import surface for the backend and frontend. Re-exports the public
 * schemas, types, and helpers from the workspace-scoped files in this folder
 * (project DTOs, panel models, cost model, layout preferences, quota, tariff
 * defaults) and defines a handful of small request/response types used by
 * both sides.
 */

import type { LayoutPreferences } from './layoutPreferences.ts'
import type { PanelEdit } from './panelTypes.ts'
import type { AnalysisConfigDto, AnalysisResultsDto, BuildingInsightsDto } from './projectDtos.ts'
import type { TariffDefaults } from './tariffDefaults.ts'

/** Location processing state shared across API responses. */
export type LocationStatus = 'processing' | 'ready' | 'failed'

/** Solar API imagery quality tiers exposed by location APIs. */
export type ImageryQuality = 'HIGH' | 'BASE'

/** Project lifecycle state — drives badge colour and status filtering. */
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

/** Body for `POST /locations/resolve` — start the Solar API pipeline for a coordinate. */
export type ResolveLocationRequest = {
  lat: number
  lng: number
  projectId?: string
  requiredQuality?: ImageryQuality
  expandedCoverage?: boolean
}

/** Response for `POST /locations/resolve` — location id + current status. */
export type ResolveLocationResponse = {
  locationId: string
  status: LocationStatus
}

/** Response for `GET /locations/:id/status` — used while polling. */
export type LocationStatusResponse = {
  status: LocationStatus
}

/** Response for `GET /locations/:id/data` — the cached Solar API record. */
export type LocationDataResponse = {
  buildingInsights: BuildingInsightsDto
  rgbImageUrl: string
  imageryQuality: ImageryQuality | null
}

/** Response for `GET /locations/probe` — quality tiers available without resolving. */
export type ProbeLocationResponse = {
  availableQualities: ImageryQuality[]
  bestQuality: ImageryQuality | null
  expandedCoverage: boolean
}

/** Body for `POST /locations/:id/panels/recompute` — flux recompute for one panel. */
export type FluxRecomputeRequest = {
  panelId: string
  center: { lat: number; lng: number }
  rotation: number
  widthM?: number
  heightM?: number
  capacityWp?: number
}

/** Response for `POST /locations/:id/panels/recompute` — 12-month DC energy. */
export type FluxRecomputeResponse = {
  panelId: string
  monthlyEnergyDcKwh: number[]
}

/** Body for `POST /locations/:id/panels/recompute-batch` — many panels at once. */
export type FluxRecomputeBatchRequest = {
  panels: FluxRecomputeRequest[]
}

/** Response for `POST /locations/:id/panels/recompute-batch`. */
export type FluxRecomputeBatchResponse = {
  results: FluxRecomputeResponse[]
}

/** Body for `POST /projects` — create a project anchored to a location. */
export type CreateProjectRequest = {
  name: string
  locationId: string
}

/** Body for `PATCH /projects/:id/layout` — persist the workbench layout. */
export type SaveLayoutRequest = {
  editedLayout: PanelEdit[]
  selectedPanelModelId?: string
}

/** Body for `PATCH /projects/:id/layout-preferences` — sizing-modal updates. */
export type UpdateLayoutPreferencesRequest = {
  layoutPreferences: Partial<LayoutPreferences>
}

/** Body for `PATCH /projects/:id/analysis` — analysis inputs + computed results. */
export type SaveAnalysisRequest = {
  analysisConfig: AnalysisConfigDto
  analysisResults: AnalysisResultsDto
}

/**
 * Per-kWh tariff rates from the Malaysian NEM 3.0 / Tariff Rakyat structure.
 * See `projectDtos.ts` `tariffRatesSchema` for field-by-field descriptions.
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
 * Threshold values that gate the tiered tariff and waiver logic.
 *
 * - `energyCliff`        — kWh threshold above which `energyHigh` applies
 * - `retailWaiver`       — kWh threshold below which the retail charge is waived
 * - `afaWaiver`          — kWh threshold below which AFA is waived
 * - `sstExemption`       — kWh threshold below which SST is exempt
 * - `eeiCutoff`          — kWh threshold above which the EEI rebate stops
 * - `reFundExemption`    — kWh threshold below which the RE Fund levy is exempt
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
 * Response for `GET /tariff/config` — the seeded NEM tariff configuration plus
 * the EEI rebate ladder and AFA defaults. Used by the analysis page to
 * populate the simulation inputs.
 */
export type TariffConfigResponse = {
  rates: TariffRates
  thresholds: TariffThresholds
  /** Step-table mapping consumption thresholds (kWh) → rebate (sen/kWh). */
  eeiTable: [number, number][]
  /** Default AFA rate in sen/kWh used when the user doesn't override it. */
  afaRateDefault: number
  defaults: TariffDefaults
  /** When the seeded rates and AFA were last verified */
  effectiveDate: string | null
  /** Short human-readable source note */
  sourceNote: string | null
}

/** Response for `GET /health` — basic liveness probe. */
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
