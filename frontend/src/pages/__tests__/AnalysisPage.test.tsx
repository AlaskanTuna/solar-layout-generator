import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalysisPage } from '../AnalysisPage'

const navigateMock = vi.fn()
const saveAnalysisMock = vi.fn()
const handleExportPdfMock = vi.fn()
const notifySuccessMock = vi.fn()
const notifyErrorMock = vi.fn()
const markProjectVisitedMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ projectId: 'project-1' })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/api/projects', () => ({
  saveAnalysis: (...args: unknown[]) => saveAnalysisMock(...args)
}))

vi.mock('@/components/ui/toastConfig', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccessMock(...args),
    error: (...args: unknown[]) => notifyErrorMock(...args)
  }
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ resolved: 'light' })
}))

vi.mock('@/hooks/useAnalysisPdf', () => ({
  useAnalysisPdf: () => ({
    isExporting: false,
    handleExportPdf: (...args: unknown[]) => handleExportPdfMock(...args)
  })
}))

vi.mock('@/hooks/useAnalysisForm', () => ({
  useAnalysisForm: () => ({
    projectQuery: {
      isLoading: false,
      error: null,
      data: {
        id: 'project-1',
        name: 'Unsaved Analysis Project',
        status: 'layout_saved'
      }
    },
    tariffQuery: {
      isLoading: false,
      error: null,
      data: {
        rates: {},
        effectiveDate: '2026-01-01'
      }
    },
    locationQuery: {
      isLoading: false,
      error: null,
      data: {}
    },
    buildingInsights: {
      solarPotential: {
        solarPanels: [],
        roofSegmentStats: []
      }
    },
    activePanels: [],
    panelsMissingMonthlyEnergy: [],
    selectedPanelModel: undefined,
    systemKwp: 4.2,
    formState: {
      monthlyConsumptionKwh: 600,
      connectionPhase: 'single',
      roofType: 'tile',
      systemCostRm: 18000,
      afaRateSenPerKwh: 0,
      degradationRate: 0.005,
      tariffEscalationRate: 0,
      tariffRatesOverride: undefined,
      consumptionProfile: 'flat',
      performanceRatio: 0.8,
      assumedLosses: 0.2,
      dcAcRatio: 1.2,
      analysisMode: 'simple',
      annualMaintenanceRm: 0,
      inverterReplacements: []
    },
    setFormState: vi.fn(),
    viewMode: 'simple',
    setViewMode: vi.fn(),
    selectedMonthIndex: 0,
    setSelectedMonthIndex: vi.fn(),
    monthTableOpen: false,
    setMonthTableOpen: vi.fn(),
    simulation: {
      totalSavingsRm: 2400,
      months: []
    },
    analysisResults: {
      annualSavingsRm: 2400
    },
    chartData: [],
    selectedMonth: null,
    thresholdWarnings: [],
    phaseCapacityCapKw: 5,
    costBreakdown: null,
    panelCostPerWp: 0.95
  })
}))

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/layout/PageContainer', () => ({
  PageContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/ui/GuidedTour', () => ({
  GuidedTour: () => null
}))

vi.mock('@/components/ui/LoadingOverlay', () => ({
  LoadingOverlay: () => <div>loading</div>
}))

vi.mock('@/components/analysis/AnalysisSidebar', () => ({
  AnalysisSidebar: ({ onExportPdf, onSaveAnalysis }: { onExportPdf: () => void; onSaveAnalysis: () => void }) => (
    <div>
      <button type="button" onClick={onExportPdf}>
        export
      </button>
      <button type="button" onClick={onSaveAnalysis}>
        save
      </button>
    </div>
  )
}))

vi.mock('@/components/analysis/BillComparisonChart', () => ({ BillComparisonChart: () => null }))
vi.mock('@/components/analysis/FinancialRoadmap', () => ({ FinancialRoadmap: () => null }))
vi.mock('@/components/analysis/NetBenefitChart', () => ({ NetBenefitChart: () => null }))
vi.mock('@/components/analysis/BillBreakdown', () => ({ BillBreakdown: () => null }))
vi.mock('@/components/analysis/MonthTable', () => ({ MonthTable: () => null }))
vi.mock('@/components/analysis/SystemAssumptions', () => ({ SystemAssumptions: () => null }))
vi.mock('@/components/analysis/SystemCostCard', () => ({ SystemCostCard: () => null }))
vi.mock('@/components/analysis/SolarVerdict', () => ({ SolarVerdict: () => null }))
vi.mock('@/components/analysis/SortableCardContainer', () => ({ SortableCardContainer: () => null }))
vi.mock('@/components/analysis/ChartTooltipContent', () => ({ ChartTooltipContent: () => null }))
vi.mock('@/components/ui/InfoTooltip', () => ({ InfoTooltip: () => null }))

vi.mock('@/lib/constants', () => ({
  getChartTooltipStyle: () => ({
    cursor: false,
    contentStyle: {},
    labelStyle: {}
  })
}))

vi.mock('@/lib/recentProjectActivity', () => ({
  markProjectVisited: (...args: unknown[]) => markProjectVisitedMock(...args)
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AnalysisPage />
    </QueryClientProvider>
  )
}

describe('AnalysisPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    saveAnalysisMock.mockReset()
    handleExportPdfMock.mockReset()
    notifySuccessMock.mockReset()
    notifyErrorMock.mockReset()
    markProjectVisitedMock.mockReset()
  })

  it('saves the current analysis before exporting the PDF without redirecting away', async () => {
    const callOrder: string[] = []

    saveAnalysisMock.mockImplementation(async () => {
      callOrder.push('save')
      return {
        id: 'project-1',
        name: 'Unsaved Analysis Project',
        status: 'analysis_saved'
      }
    })

    handleExportPdfMock.mockImplementation(
      async (_projectId: string, _projectName: string, beforeExport?: () => Promise<void>) => {
        await beforeExport?.()
        callOrder.push('export')
      }
    )

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'export' }))

    await waitFor(() => expect(saveAnalysisMock).toHaveBeenCalledTimes(1))
    expect(handleExportPdfMock).toHaveBeenCalledTimes(1)
    expect(handleExportPdfMock).toHaveBeenCalledWith('project-1', 'Unsaved Analysis Project', expect.any(Function))
    expect(callOrder).toEqual(['save', 'export'])
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('keeps the standalone save button redirect behavior', async () => {
    saveAnalysisMock.mockResolvedValue({
      id: 'project-1',
      name: 'Unsaved Analysis Project',
      status: 'analysis_saved'
    })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(saveAnalysisMock).toHaveBeenCalledTimes(1))
    expect(navigateMock).toHaveBeenCalledWith('/dashboard/projects')
    expect(handleExportPdfMock).not.toHaveBeenCalled()
  })
})
