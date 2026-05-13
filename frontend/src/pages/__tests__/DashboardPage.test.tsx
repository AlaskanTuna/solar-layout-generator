// Tests for §5.2.1.4 Dashboard > DashboardPage (TCNO prefix DP)
// Covers frontend/src/pages/DashboardPage.tsx behavioural surface.

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const navigateMock = vi.fn()
const listProjectsMock = vi.fn()
const useAuthMock = vi.fn()
const useQuotaMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}))

vi.mock('@/api/projects', () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args)
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args)
}))

vi.mock('@/hooks/useQuota', () => ({
  useQuota: (...args: unknown[]) => useQuotaMock(...args)
}))

vi.mock('@/lib/projectDraftStorage', () => ({
  writeNewProjectDraft: vi.fn()
}))

vi.mock('@/lib/recentProjectActivity', () => ({
  getProjectLastVisitedAt: () => null
}))

vi.mock('@/components/dashboard/helpers', () => ({
  formatRelativeDate: () => 'just now',
  projectRoute: (id: string) => `/project/${id}/workbench`
}))

vi.mock('@/lib/projectStatus', () => ({
  getProjectStatusConfig: () => ({ label: 'status', icon: () => null, color: 'text-foreground' })
}))

vi.mock('@/components/layout/PageContainer', () => ({
  PageContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/layout/PageHeaderCard', () => ({
  PageHeaderCard: ({ children }: React.PropsWithChildren) => <header>{children}</header>
}))

import { DashboardPage } from '../DashboardPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    listProjectsMock.mockReset()
    useAuthMock.mockReset()
    useQuotaMock.mockReset()

    listProjectsMock.mockResolvedValue([])
    useAuthMock.mockReturnValue({ user: { id: 'u1', email: 'tester@example.com' } })
    useQuotaMock.mockReturnValue({ data: { used: 0, limit: 5, resetsAt: new Date(Date.now() + 3600000).toISOString() } })
  })

  // DP-01
  it('renders the dashboard layout with the user-derived greeting context', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText(/quickActions/i).length).toBeGreaterThan(0))
  })

  // DP-02
  it('exposes the three quick-action tiles for projects, analytics, and FAQ', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('quickActions.projects.label')).toBeTruthy()
      expect(screen.getByText('quickActions.analytics.label')).toBeTruthy()
      expect(screen.getByText('quickActions.faq.label')).toBeTruthy()
    })
  })

  // DP-03
  it('opens the new-project dialog and navigates to /project/new/map on submit', async () => {
    renderPage()

    await waitFor(() => expect(screen.getAllByText(/newProject/i).length).toBeGreaterThan(0))

    const newProjectButtons = screen.getAllByRole('button')
    const trigger = newProjectButtons.find((b) => b.textContent?.match(/newProject/i))
    expect(trigger).toBeTruthy()
    fireEvent.click(trigger!)

    await waitFor(() => expect(screen.getByLabelText(/dialog\.nameLabel/i)).toBeTruthy())

    const input = screen.getByLabelText(/dialog\.nameLabel/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'My Roof' } })

    const submitButtons = screen.getAllByRole('button')
    const submit = submitButtons.find((b) => b.textContent?.match(/createProject|submit|continue/i))
    expect(submit).toBeTruthy()
    fireEvent.click(submit!)

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/project/new/map', { state: { projectName: 'My Roof' } })
    )
  })

  // DP-04
  it('does not navigate when the project name input is empty', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText(/newProject/i).length).toBeGreaterThan(0))

    const newProjectButtons = screen.getAllByRole('button')
    const trigger = newProjectButtons.find((b) => b.textContent?.match(/newProject/i))
    fireEvent.click(trigger!)

    await waitFor(() => expect(screen.getByLabelText(/dialog\.nameLabel/i)).toBeTruthy())

    const submitButtons = screen.getAllByRole('button')
    const submit = submitButtons.find((b) => b.textContent?.match(/createProject|submit|continue/i))
    fireEvent.click(submit!)

    expect(navigateMock).not.toHaveBeenCalled()
  })

  // DP-05
  it('renders an empty-state for the recents card when no projects exist', async () => {
    listProjectsMock.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      // Empty state surface should mention "recent" or a localised key reference
      const emptyCandidates = screen.queryAllByText(/recent|empty|noProjects/i)
      expect(emptyCandidates.length).toBeGreaterThan(0)
    })
  })
})
