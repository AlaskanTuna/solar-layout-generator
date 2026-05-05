// Tests for §5.2.1.1 Location Search > MapPage (TCNO prefix MP)
// Covers frontend/src/pages/MapPage.tsx behavioural surface (form validation, phase
// state machine, error handling). Real Google Maps + Places autocomplete interaction
// is non-automatable under jsdom; the map-loading and place-selection flows are
// folded into manual cases.

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const navigateMock = vi.fn()
const resolveLocationMock = vi.fn()
const probeLocationMock = vi.fn()
const getLocationStatusMock = vi.fn()
const getProjectMock = vi.fn()
const createProjectMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}))

vi.mock('@/hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => ({ isLoaded: false, error: null })
}))

vi.mock('@/api/locations', () => ({
  resolveLocation: (...args: unknown[]) => resolveLocationMock(...args),
  probeLocation: (...args: unknown[]) => probeLocationMock(...args),
  getLocationStatus: (...args: unknown[]) => getLocationStatusMock(...args)
}))

vi.mock('@/api/projects', () => ({
  getProject: (...args: unknown[]) => getProjectMock(...args),
  createProject: (...args: unknown[]) => createProjectMock(...args)
}))

vi.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
  apiFetch: vi.fn()
}))

vi.mock('@/components/ui/toastConfig', () => ({
  notify: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() }
}))

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/map/LowerResolutionConsentModal', () => ({
  LowerResolutionConsentModal: () => null
}))

vi.mock('@/components/map/CoverageNoticeModal', () => ({
  CoverageNoticeModal: () => null,
  readCoverageNoticeDismissed: () => true
}))

vi.mock('@/components/ui/LoadingOverlay', () => ({
  LoadingOverlay: () => <div data-testid="loading-overlay">loading</div>
}))

vi.mock('@/components/ui/GuidedTour', () => ({
  GuidedTour: () => null
}))

vi.mock('@/lib/projectDraftStorage', () => ({
  readNewProjectDraft: () => null,
  writeNewProjectDraft: vi.fn(),
  clearNewProjectDraft: vi.fn()
}))

vi.mock('@/lib/recentProjectActivity', () => ({
  markProjectVisited: vi.fn()
}))

import { MapPage } from '../MapPage'

function renderPage(initialPath = '/project/new/map', state?: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: initialPath, state: state ?? { projectName: 'My Project' } }]}>
        <Routes>
          <Route path="/project/:projectId/map" element={<MapPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MapPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    resolveLocationMock.mockReset()
    probeLocationMock.mockReset()
    getLocationStatusMock.mockReset()
    getProjectMock.mockReset()
    createProjectMock.mockReset()
  })

  // MP-01
  it('shows the loading overlay while Google Maps is still initialising', () => {
    renderPage()
    expect(screen.getByTestId('loading-overlay')).toBeTruthy()
  })

  // MP-02
  it('exposes the manual coordinate entry toggle for users without a place match', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'search.manualToggleShow' })).toBeTruthy()
  })

  // MP-03
  it('redirects to /dashboard when /project/new/map is opened without a project name', () => {
    renderPage('/project/new/map', {})
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  // MP-04
  it('rejects manual coordinates outside the Malaysia bounding box', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'search.manualToggleShow' }))

    const inputs = document.querySelectorAll('input[inputmode="decimal"]')
    expect(inputs.length).toBe(2)
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: '-5.0' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '101.7' } })
    fireEvent.click(screen.getByRole('button', { name: /search\.manualForm\.submitButton/i }))

    expect(screen.getByText('search.manualForm.errorOutOfBounds')).toBeTruthy()
  })

  // MP-05
  it('rejects manual coordinates that are not numeric', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'search.manualToggleShow' }))

    const inputs = document.querySelectorAll('input[inputmode="decimal"]')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'abc' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '101.7' } })
    fireEvent.click(screen.getByRole('button', { name: /search\.manualForm\.submitButton/i }))

    expect(screen.getByText('search.manualForm.errorInvalidCoords')).toBeTruthy()
  })
})
