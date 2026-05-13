// Tests for §5.2.1.2 Layout Workbench > WorkbenchPage (TCNO prefix WB)
// Covers frontend/src/pages/WorkbenchPage.tsx mount surface and route guards.
// Detailed canvas interaction (drag, rotate, snap, layout-preset modal flow)
// requires real Konva pointer geometry that jsdom cannot reproduce; those flows
// are folded into manual cases.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'

beforeAll(() => {
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      })
    })
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ projectId: 'project-1' })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) })
}))

vi.mock('react-konva', () => ({
  Stage: ({ children }: React.PropsWithChildren) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Image: () => null,
  Line: () => null,
  Rect: () => null
}))

vi.mock('@/hooks/usePanelState', () => ({
  usePanelState: () => ({
    panels: [],
    visiblePanels: [],
    visiblePanelCount: 0,
    selectedSourceCount: 0,
    setVisiblePanelCount: vi.fn(),
    movePanel: vi.fn(),
    rotatePanel: vi.fn(),
    deletePanel: vi.fn(),
    updatePanelEnergy: vi.fn(),
    bulkUpdatePanels: vi.fn(),
    pushSnapshot: vi.fn(),
    getPanel: vi.fn(),
    layoutSerialised: '',
    initBatchStatus: 'idle',
    setInitBatchStatus: vi.fn(),
    initialPanelEdits: [],
    panelInventoryReady: true,
    isHydrated: true,
    needsAdditionalRecompute: false,
    panelsMissingEnergy: 0,
    runOnDemandBatchRecompute: vi.fn()
  })
}))

vi.mock('@/hooks/useWorkbenchData', () => ({
  useWorkbenchData: () => ({
    isLoading: false,
    project: { id: 'project-1', name: 'Test Project', layoutPreferences: null, status: 'location_saved' },
    location: null,
    buildingInsights: { solarPotential: { solarPanels: [], roofSegmentStats: [] } },
    imageGeoTransform: null,
    decodedRoofMask: null
  })
}))

vi.mock('@/hooks/useWorkbenchKeyboard', () => ({
  useWorkbenchKeyboard: () => undefined
}))

vi.mock('@/hooks/useIrradiance', () => ({
  useIrradiance: () => ({ azimuth: 0, intensity: 0 })
}))

vi.mock('@/hooks/useOverlayImages', () => ({
  useOverlayImages: () => ({
    backgroundImage: { width: 800, height: 600 } as unknown as HTMLImageElement,
    displayImage: { width: 800, height: 600 } as unknown as HTMLImageElement,
    imageError: null,
    isOverlayLoading: false
  })
}))

vi.mock('@/hooks/useWorkbenchSave', () => ({
  useWorkbenchSave: () => ({
    handleSaveLayout: vi.fn(),
    isSaving: false,
    saveError: null
  })
}))

vi.mock('@/hooks/useCanvasZoom', () => ({
  useCanvasZoom: () => ({
    stageScale: 1,
    stagePosition: { x: 0, y: 0 },
    handleWheel: vi.fn(),
    handleStageDragEnd: vi.fn(),
    resetZoom: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn()
  })
}))

vi.mock('@/hooks/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({
    geo: { resolutionMeters: 0.1, originLat: 3.14, originLng: 101.69 },
    panelDimensions: { width: 20, height: 36 },
    stageReady: true,
    selectedPanelIds: new Set<string>(),
    setSelectedPanelIds: vi.fn(),
    selectedPanel: null,
    snapEnabled: false,
    setSnapEnabled: vi.fn(),
    snapGuides: [],
    pendingPanelId: null,
    message: null,
    renderPanels: [],
    segmentHulls: [],
    isModelRecomputing: false,
    marqueeMode: false,
    setMarqueeMode: vi.fn(),
    marqueeRect: null,
    handleSnapDragMove: vi.fn(),
    handlePanelSelect: vi.fn(),
    handlePanelDragStart: vi.fn(),
    handlePanelDragMove: vi.fn(),
    handlePanelDragEnd: vi.fn(),
    handleCanvasRotate: vi.fn(),
    handleGroupRotateStart: vi.fn(),
    handleGroupRotateMove: vi.fn(),
    handleGroupRotateEnd: vi.fn(),
    handleDeleteSelected: vi.fn(),
    handleModelChange: vi.fn(),
    handleMarqueeStart: vi.fn(),
    handleMarqueeMove: vi.fn(),
    handleMarqueeEnd: vi.fn()
  })
}))

vi.mock('@/hooks/useStageSize', () => ({
  useStageSize: () => ({ width: 800, height: 600 })
}))

vi.mock('@/lib/buildingInsights', () => ({
  annualEnergyFromMonthly: () => 0
}))

vi.mock('@/lib/constants', () => ({
  COLORS: {}
}))

vi.mock('@/lib/workbenchTour', () => ({
  getWorkbenchTourSteps: () => []
}))

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/layout/PageContainer', () => ({
  PageContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))

vi.mock('@/components/ui/InfoTooltip', () => ({ InfoTooltip: () => null }))
vi.mock('@/components/ui/LoadingOverlay', () => ({ LoadingOverlay: () => <div>loading</div> }))
vi.mock('@/components/ui/GuidedTour', () => ({ GuidedTour: () => null }))
vi.mock('@/components/workbench/CanvasControls', () => ({ CanvasControls: () => null }))
vi.mock('@/components/workbench/CanvasLegends', () => ({ CanvasLegends: () => null }))
vi.mock('@/components/workbench/WorkbenchSidebar', () => ({ WorkbenchSidebar: () => <aside data-testid="workbench-sidebar" /> }))
vi.mock('@/components/workbench/LayoutPresetModal', () => ({ LayoutPresetModal: ({ open }: { open: boolean }) => (open ? <div data-testid="layout-preset-modal">preset</div> : null) }))
vi.mock('@/components/workbench/WorkbenchHintOverlay', () => ({ WorkbenchHintOverlay: () => null }))
vi.mock('@/components/workbench/PanelLayer', () => ({ PanelLayer: () => null }))
vi.mock('@/components/workbench/IrradianceGlow', () => ({
  MONTHLY_AZIMUTH: [],
  MONTH_LABELS: []
}))

vi.mock('@/components/chat/ChatProvider', () => {
  const ctx = React.createContext({ getState: () => ({ isOpen: false }), setState: vi.fn(), reset: vi.fn(), isAnyOpen: false })
  return { ChatContext: ctx, ChatProvider: ({ children }: React.PropsWithChildren) => <div>{children}</div> }
})

vi.mock('@/components/chat/ChatLauncher', () => ({
  ChatLauncher: ({ page }: { page: string }) => <div data-testid={`chat-launcher-${page}`}>chat</div>
}))

vi.mock('@/api/projects', () => ({
  saveLayoutPreferences: vi.fn()
}))

vi.mock('@/lib/layoutPreset', () => ({
  describeLayoutPreset: () => 'preset',
  inferVisibleCount: () => 0
}))

vi.mock('@/lib/recentProjectActivity', () => ({
  markProjectVisited: vi.fn()
}))

import { WorkbenchPage } from '../WorkbenchPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/project/project-1/workbench']}>
        <Routes>
          <Route path="/project/:projectId/workbench" element={<WorkbenchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // WB-01
  it('mounts the workbench Konva stage when project data is ready', () => {
    renderPage()
    expect(screen.getByTestId('konva-stage')).toBeTruthy()
  })

  // WB-02
  it('mounts the workbench sidebar', () => {
    renderPage()
    expect(screen.getByTestId('workbench-sidebar')).toBeTruthy()
  })

  // WB-03
  it('opens the LayoutPresetModal on first entry when no preference is saved', () => {
    renderPage()
    expect(screen.getByTestId('layout-preset-modal')).toBeTruthy()
  })

  // WB-04
  it('mounts the Sol chatbot launcher with page="workbench"', () => {
    renderPage()
    expect(screen.getByTestId('chat-launcher-workbench')).toBeTruthy()
  })
})
