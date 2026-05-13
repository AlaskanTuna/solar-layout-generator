// Tests for §5.2.1.4 Dashboard > AnalyticsPage (TCNO prefix AN)
// Covers frontend/src/pages/AnalyticsPage.tsx empty-state and aggregation surface.

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const navigateMock = vi.fn()
const listProjectsMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) })
}))

vi.mock('@/api/projects', () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args)
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ resolved: 'light' })
}))

vi.mock('@/lib/constants', () => ({
  COLORS: { primary: '#000', secondary: '#fff' },
  getChartTooltipStyle: () => ({})
}))

vi.mock('@/components/analysis/ChartTooltipContent', () => ({
  ChartTooltipContent: () => null
}))

vi.mock('@/components/dashboard/StatCard', () => ({
  StatCard: ({ label, value }: { label: string; value: string }) => <div>{label}: {value}</div>
}))

vi.mock('@/components/dashboard/helpers', () => ({
  aggregatePortfolio: (projects: unknown[]) => {
    const completed = (projects as { status: string; analysisResults?: unknown }[]).filter(
      (p) => p.status === 'analysis_saved' && p.analysisResults
    )
    return {
      completedCount: completed.length,
      totalMonthlySavingsRm: 0,
      totalCarbonKg: 0,
      bestPaybackYears: null,
      worstPaybackYears: null,
      averagePaybackYears: null,
      totalKwhPerYear: 0,
      averageRoiPercent: null,
      totalNetBenefitRm: 0,
      totalSystemCostRm: 0
    }
  }
}))

vi.mock('@/components/layout/PageContainer', () => ({
  PageContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/layout/PageHeaderCard', () => ({
  PageHeaderCard: ({ children }: React.PropsWithChildren) => <header>{children}</header>
}))

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (v: number) => `RM ${v.toFixed(0)}`
}))

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  LabelList: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null
}))

import { AnalyticsPage } from '../AnalyticsPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    listProjectsMock.mockReset()
  })

  // AN-01
  it('renders the empty-state when no completed projects exist', async () => {
    listProjectsMock.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText('analytics.noData.title')).toBeTruthy())
    expect(screen.getByText('analytics.noData.subtitle')).toBeTruthy()
  })

  // AN-02
  it('renders the empty-state when all projects are still in progress', async () => {
    listProjectsMock.mockResolvedValue([
      { id: 'p1', name: 'WIP', status: 'layout_saved', analysisResults: null }
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('analytics.noData.title')).toBeTruthy())
  })

  // AN-03
  it('renders the populated header with the completed count when at least one project has analysisResults', async () => {
    listProjectsMock.mockResolvedValue([
      {
        id: 'p1',
        name: 'Done',
        status: 'analysis_saved',
        analysisResults: {
          paybackYears: 7.5,
          averageMonthlySavingsRm: 200,
          twentyFiveYearNetBenefitRm: 30000,
          tenYearRoiPercent: 35
        }
      }
    ])
    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/analytics\.subtitleWithCount/)).toBeTruthy()
    )
  })

  // AN-04
  it('renders KPI stat cards when completed projects exist', async () => {
    listProjectsMock.mockResolvedValue([
      {
        id: 'p1',
        name: 'Done',
        status: 'analysis_saved',
        analysisResults: {
          paybackYears: 7.5,
          averageMonthlySavingsRm: 200,
          twentyFiveYearNetBenefitRm: 30000,
          tenYearRoiPercent: 35
        }
      }
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText(/analytics\.stats\.totalMonthlySavings/)).toBeTruthy())
  })
})
