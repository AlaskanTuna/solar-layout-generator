import { apiFetch } from './client'
import type { CreateProjectRequest, SaveLayoutRequest, SaveAnalysisRequest } from '@shared/types'

export type ProjectResponse = {
  id: string
  userId: string
  locationId: string
  name: string
  status: 'draft' | 'layout_saved' | 'analysis_saved'
  editedLayout: unknown[] | null
  analysisConfig: Record<string, unknown> | null
  analysisResults: Record<string, unknown> | null
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
