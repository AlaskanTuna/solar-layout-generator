import { apiFetch } from './client'
import type { CreateProjectRequest, SaveLayoutRequest, SaveAnalysisRequest } from '@shared/types'
import type { AnalysisConfig, AnalysisResultsRecord } from '@/lib/analysis'

/** Partial after layout save (only selectedPanelModelId), full after analysis save */
export type ProjectAnalysisConfig = Partial<AnalysisConfig> & { selectedPanelModelId?: string }

export type ProjectResponse = {
  id: string
  userId: string
  locationId: string
  name: string
  status: 'draft' | 'layout_saved' | 'analysis_saved'
  editedLayout: unknown[] | null
  analysisConfig: ProjectAnalysisConfig | null
  analysisResults: AnalysisResultsRecord | null
  createdAt: string
  updatedAt: string
  location?: {
    id: string
    lat: number
    lng: number
    status: 'processing' | 'ready' | 'failed'
    buildingInsightsJson?: Record<string, unknown>
    rgbImageUrl?: string | null
  }
}

export function createProject(req: CreateProjectRequest) {
  return apiFetch<ProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(req)
  })
}

export function listProjects() {
  return apiFetch<ProjectResponse[]>('/projects')
}

export function getProject(id: string) {
  return apiFetch<ProjectResponse>(`/projects/${id}`)
}

export function deleteProject(id: string) {
  return apiFetch<{ success: boolean }>(`/projects/${id}`, {
    method: 'DELETE'
  })
}

export function saveLayout(id: string, req: SaveLayoutRequest) {
  return apiFetch<ProjectResponse>(`/projects/${id}/layout`, {
    method: 'PATCH',
    body: JSON.stringify(req)
  })
}

export function saveAnalysis(id: string, req: SaveAnalysisRequest) {
  return apiFetch<ProjectResponse>(`/projects/${id}/analysis`, {
    method: 'PATCH',
    body: JSON.stringify(req)
  })
}

export type PdfExportToken = { token: string; expiresAt: string }

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
