/**
 * Project API client.
 *
 * A Project is the user's editable solar plan for a Location: their panel
 * layout, sizing preferences, analysis inputs, and computed billing results.
 * Projects are mutable; Locations are not.
 *
 * Endpoints:
 *   - `createProject` / `listProjects` / `getProject` / `deleteProject` — CRUD
 *   - `saveLayout`              — persist the workbench panel arrangement
 *   - `saveAnalysis`            — persist analysis inputs + computed results
 *   - `saveLayoutPreferences`   — sizing goal + roof direction hints
 *   - `requestPdfExportToken`   — short-lived token for the PDF render route
 *   - `getProjectForPdf`        — token-auth fetch used by the PDF page
 */

import { apiFetch } from './client'
import type {
  AnalysisResultsDto,
  BuildingInsightsDto,
  CreateProjectRequest,
  PanelEdit,
  SaveLayoutRequest,
  SaveAnalysisRequest,
  StoredAnalysisConfigDto,
  UpdateLayoutPreferencesRequest,
  LayoutPreferences,
  ImageryQuality,
  ProjectStatus
} from '@shared/types'
import type { LocationImageGeoTransform } from './locations'

/** Partial after layout save (only selectedPanelModelId), fuller after analysis save */
export type ProjectAnalysisConfig = StoredAnalysisConfigDto

/**
 * The Project shape returned by every project endpoint.
 *
 * `editedLayout`, `analysisConfig`, and `analysisResults` are nullable because
 * a freshly-created project has no layout or analysis yet — they fill in as
 * the user progresses through Map → Workbench → Analysis.
 *
 * `rgbSignedUrl` and `imageGeoTransform` are populated only on the `/pdf-data`
 * endpoint and let the PDF route render the panel layout over the satellite
 * image without holding a Supabase session.
 */
export type ProjectResponse = {
  id: string
  userId: string
  locationId: string
  name: string
  status: ProjectStatus
  editedLayout: PanelEdit[] | null
  analysisConfig: ProjectAnalysisConfig | null
  analysisResults: AnalysisResultsDto | null
  layoutPreferences: LayoutPreferences | null
  createdAt: string
  updatedAt: string
  location?: {
    id: string
    lat: number
    lng: number
    status: 'processing' | 'ready' | 'failed'
    imageryQuality: ImageryQuality | null
    buildingInsightsJson?: BuildingInsightsDto
    rgbImageUrl?: string | null
  }
  /** Populated only by `/pdf-data` — a short-lived signed URL for the RGB satellite image. */
  rgbSignedUrl?: string | null
  /** Populated only by `/pdf-data` — proj4-based transform so the print view can place panels. */
  imageGeoTransform?: LocationImageGeoTransform | null
}

/** Creates a new project anchored to a resolved Location. */
export function createProject(req: CreateProjectRequest) {
  return apiFetch<ProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

/** Lists every project owned by the authenticated user, newest first. */
export function listProjects() {
  return apiFetch<ProjectResponse[]>('/projects')
}

/** Fetches a single project the user owns; 404 if absent or not theirs. */
export function getProject(id: string) {
  return apiFetch<ProjectResponse>(`/projects/${id}`)
}

/** Deletes a project. Does not refund the user's daily project quota slot. */
export function deleteProject(id: string) {
  return apiFetch<{ success: boolean }>(`/projects/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Persists the workbench layout. Also tucks `selectedPanelModelId` into
 * `analysisConfig` so the analysis page knows which model to size against.
 */
export function saveLayout(id: string, req: SaveLayoutRequest) {
  return apiFetch<ProjectResponse>(`/projects/${id}/layout`, {
    method: 'PATCH',
    body: JSON.stringify(req)
  })
}

/**
 * Persists both the analysis inputs (tariff, consumption, escalation rates)
 * and the computed NEM simulation results. Moves the project status to
 * `analysis_saved`, unlocking the PDF export.
 */
export function saveAnalysis(id: string, req: SaveAnalysisRequest) {
  return apiFetch<ProjectResponse>(`/projects/${id}/analysis`, {
    method: 'PATCH',
    body: JSON.stringify(req)
  })
}

/**
 * Persists sizing-modal answers (bill range, sizing goal, roof direction).
 * Drives the panel auto-layout heuristics in the workbench.
 */
export function saveLayoutPreferences(id: string, req: UpdateLayoutPreferencesRequest) {
  return apiFetch<ProjectResponse>(`/projects/${id}/layout-preferences`, {
    method: 'PATCH',
    body: JSON.stringify(req)
  })
}

/** Short-lived bearer token issued just for the PDF render route. */
export type PdfExportToken = { token: string; expiresAt: string }

/**
 * Mints a one-shot PDF token. Used because the headless PDF renderer (a
 * Vercel function with no Supabase cookie) can't carry the user's session.
 */
export function requestPdfExportToken(id: string) {
  return apiFetch<PdfExportToken>(`/projects/${id}/pdf-token`, { method: 'POST' })
}

/** Token-auth'd (no session cookie); used by the PDF preview route the Vercel function navigates to. */
export async function getProjectForPdf(id: string, token: string): Promise<ProjectResponse> {
  const response = await fetch(`/api/projects/${id}/pdf-data?token=${encodeURIComponent(token)}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load PDF data (${response.status})`)
  }
  return response.json() as Promise<ProjectResponse>
}
