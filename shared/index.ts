// ── Location ──

export type LocationStatus = 'processing' | 'ready' | 'failed'

// ── Project ──

export type ProjectStatus = 'draft' | 'layout_saved' | 'analysis_saved'

// ── Panel Edit (stored as JSONB in Project.editedLayout) ──

export type PanelEdit = {
  id: string
  status: 'kept' | 'moved' | 'deleted'
  center: { lat: number; lng: number }
  rotation: number
  monthlyEnergyDcKwh: number[]
}

// ── API Request / Response Types ──

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
}

export type FluxRecomputeResponse = {
  panelId: string
  monthlyEnergyDcKwh: number[]
}

export type CreateProjectRequest = {
  name: string
  locationId: string
}

export type SaveLayoutRequest = {
  editedLayout: PanelEdit[]
}

export type SaveAnalysisRequest = {
  analysisConfig: Record<string, unknown>
  analysisResults: Record<string, unknown>
}

export type TariffConfigResponse = {
  rates: Record<string, unknown>
  thresholds: Record<string, unknown>
  eeiTable: Record<string, unknown>
  afaRateDefault: number
}

export type HealthResponse = {
  status: 'ok'
}
