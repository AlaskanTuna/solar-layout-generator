// Tests for §5.2.1.2 Layout Workbench > Flux Recomputation Core (TCNO prefix FRC)
// Covers backend/src/services/fluxRecomputeService.ts > recomputeSinglePanel (Figure 92)

import { describe, expect, it, vi, beforeEach } from 'vitest'

const downloadFromStorageMock = vi.hoisted(() => vi.fn())
const fromArrayBufferMock = vi.hoisted(() => vi.fn())
const setupGeoTransformMock = vi.hoisted(() => vi.fn())
const latLngToPixelMock = vi.hoisted(() => vi.fn())
const metersToPixelsMock = vi.hoisted(() => vi.fn())
const getRotatedCornersMock = vi.hoisted(() => vi.fn())
const computeMonthlyEnergyMock = vi.hoisted(() => vi.fn())

vi.mock('../storageService.js', () => ({
  downloadFromStorage: (...args: unknown[]) => downloadFromStorageMock(...args)
}))

vi.mock('geotiff', () => ({
  fromArrayBuffer: (...args: unknown[]) => fromArrayBufferMock(...args)
}))

vi.mock('../../geo/transforms.js', () => ({
  setupGeoTransform: (...args: unknown[]) => setupGeoTransformMock(...args),
  latLngToPixel: (...args: unknown[]) => latLngToPixelMock(...args),
  metersToPixels: (...args: unknown[]) => metersToPixelsMock(...args)
}))

vi.mock('../../geo/panelGeometry.js', () => ({
  getRotatedCorners: (...args: unknown[]) => getRotatedCornersMock(...args)
}))

vi.mock('../../geo/fluxSampler.js', () => ({
  computeMonthlyEnergy: (...args: unknown[]) => computeMonthlyEnergyMock(...args),
  preloadFluxRasters: vi.fn(),
  computeMonthlyEnergyFromRasters: vi.fn()
}))

import { recomputeSinglePanel } from '../fluxRecomputeService.js'
import type { PanelSpecs } from '../buildingInsightsService.js'

const PANEL_SPECS: PanelSpecs = {
  panelWidthMeters: 1.0,
  panelHeightMeters: 1.8,
  panelCapacityWatts: 450
}

const FAKE_GEO = { resolutionMeters: 0.1 }
const FAKE_IMAGE = { id: 'fake-image' }
const FAKE_BUFFER = new ArrayBuffer(16)

function setupHappyPath() {
  downloadFromStorageMock.mockResolvedValue(FAKE_BUFFER)
  fromArrayBufferMock.mockResolvedValue({ getImage: vi.fn().mockResolvedValue(FAKE_IMAGE) })
  setupGeoTransformMock.mockReturnValue(FAKE_GEO)
  latLngToPixelMock.mockReturnValue({ px: 100, py: 200 })
  metersToPixelsMock.mockReturnValueOnce(10).mockReturnValueOnce(18)
  getRotatedCornersMock.mockReturnValue([
    [95, 191], [105, 191], [105, 209], [95, 209]
  ])
  computeMonthlyEnergyMock.mockResolvedValue(
    [30, 28, 31, 29, 32, 30, 33, 31, 30, 29, 27, 28]
  )
}

describe('recomputeSinglePanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    downloadFromStorageMock.mockReset()
    fromArrayBufferMock.mockReset()
    setupGeoTransformMock.mockReset()
    latLngToPixelMock.mockReset()
    metersToPixelsMock.mockReset()
    getRotatedCornersMock.mockReset()
    computeMonthlyEnergyMock.mockReset()
  })

  // FRC-01
  it('returns the panel id and a 12-element monthly energy array', async () => {
    setupHappyPath()

    const result = await recomputeSinglePanel('storage/path/monthly.tif', PANEL_SPECS, {
      panelId: 'panel_42',
      center: { lat: 3.14, lng: 101.69 },
      rotation: 0
    })

    expect(result.panelId).toBe('panel_42')
    expect(result.monthlyEnergyDcKwh).toHaveLength(12)
    expect(result.monthlyEnergyDcKwh[0]).toBe(30)
  })

  // FRC-02
  it('converts panel rotation from degrees to radians before computing corners', async () => {
    setupHappyPath()

    await recomputeSinglePanel('storage/path/monthly.tif', PANEL_SPECS, {
      panelId: 'panel_1',
      center: { lat: 3.14, lng: 101.69 },
      rotation: 90
    })

    const cornerCallArgs = getRotatedCornersMock.mock.calls[0]
    const rotationRadArg = cornerCallArgs[4] as number
    expect(rotationRadArg).toBeCloseTo(Math.PI / 2, 6)
  })

  // FRC-03
  it('uses the panel-specs default width and height when widthM/heightM are not provided', async () => {
    setupHappyPath()

    await recomputeSinglePanel('storage/path/monthly.tif', PANEL_SPECS, {
      panelId: 'panel_1',
      center: { lat: 3.14, lng: 101.69 },
      rotation: 0
    })

    expect(metersToPixelsMock).toHaveBeenNthCalledWith(1, PANEL_SPECS.panelWidthMeters, FAKE_GEO)
    expect(metersToPixelsMock).toHaveBeenNthCalledWith(2, PANEL_SPECS.panelHeightMeters, FAKE_GEO)
  })

  // FRC-04
  it('honours an override widthM/heightM when supplied on the panel argument', async () => {
    setupHappyPath()

    await recomputeSinglePanel('storage/path/monthly.tif', PANEL_SPECS, {
      panelId: 'panel_1',
      center: { lat: 3.14, lng: 101.69 },
      rotation: 0,
      widthM: 1.2,
      heightM: 2.0
    })

    expect(metersToPixelsMock).toHaveBeenNthCalledWith(1, 1.2, FAKE_GEO)
    expect(metersToPixelsMock).toHaveBeenNthCalledWith(2, 2.0, FAKE_GEO)
  })

  // FRC-05
  it('uses the panel-specs default capacity when capacityWp is not provided', async () => {
    setupHappyPath()

    await recomputeSinglePanel('storage/path/monthly.tif', PANEL_SPECS, {
      panelId: 'panel_1',
      center: { lat: 3.14, lng: 101.69 },
      rotation: 0
    })

    const energyCallArgs = computeMonthlyEnergyMock.mock.calls[0]
    expect(energyCallArgs[2]).toBe(PANEL_SPECS.panelCapacityWatts)
  })

  // FRC-06
  it('honours an override capacityWp when supplied on the panel argument', async () => {
    setupHappyPath()

    await recomputeSinglePanel('storage/path/monthly.tif', PANEL_SPECS, {
      panelId: 'panel_1',
      center: { lat: 3.14, lng: 101.69 },
      rotation: 0,
      capacityWp: 500
    })

    const energyCallArgs = computeMonthlyEnergyMock.mock.calls[0]
    expect(energyCallArgs[2]).toBe(500)
  })
})
