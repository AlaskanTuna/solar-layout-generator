// Tests for §5.2.1.1 Location Search > Solar API Fetch Pipeline (TCNO prefix SAFP)
// Covers backend/src/services/locationPipeline/fetch.ts (Figure 91)

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../config/env.js', () => ({
  env: { GOOGLE_API_KEY: 'test-google-api-key' }
}))

const fetchBuildingInsightsMock = vi.hoisted(() => vi.fn())
const fetchDataLayersMock = vi.hoisted(() => vi.fn())
const calculateRadiusMock = vi.hoisted(() => vi.fn())
const enrichBuildingInsightsMock = vi.hoisted(() => vi.fn())
const parseBuildingInsightsMock = vi.hoisted(() => vi.fn())

vi.mock('../solarApiService.js', () => ({
  fetchBuildingInsights: (...args: unknown[]) => fetchBuildingInsightsMock(...args),
  fetchDataLayers: (...args: unknown[]) => fetchDataLayersMock(...args),
  calculateRadius: (...args: unknown[]) => calculateRadiusMock(...args),
  enrichBuildingInsights: (...args: unknown[]) => enrichBuildingInsightsMock(...args),
  // Delegate to globalThis.fetch so the existing fetch spies in this suite keep observing layer
  // downloads. Timeout is irrelevant in jsdom — the spy resolves synchronously before any timer fires.
  fetchWithTimeout: (input: string | URL, _timeoutMs: number, init?: RequestInit) =>
    globalThis.fetch(input, init),
  DOWNLOAD_TIMEOUT_MS: 45_000,
  PROBE_TIMEOUT_MS: 8_000,
  METADATA_TIMEOUT_MS: 20_000
}))

vi.mock('../buildingInsightsService.js', () => ({
  parseBuildingInsights: (...args: unknown[]) => parseBuildingInsightsMock(...args)
}))

import { fetchLocationPipelineInputs } from '../locationPipeline/fetch.js'

const VALID_BI = {
  boundingBox: { sw: { latitude: 3.0, longitude: 101.5 }, ne: { latitude: 3.1, longitude: 101.6 } },
  solarPotential: { panelWidthMeters: 1, panelHeightMeters: 1.8, panelCapacityWatts: 450 }
}

describe('fetchLocationPipelineInputs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchBuildingInsightsMock.mockReset()
    fetchDataLayersMock.mockReset()
    calculateRadiusMock.mockReset()
    enrichBuildingInsightsMock.mockReset()
    parseBuildingInsightsMock.mockReset()
  })

  // SAFP-01
  it('throws when the building insights payload fails validation', async () => {
    fetchBuildingInsightsMock.mockResolvedValue({ corrupt: true })
    parseBuildingInsightsMock.mockReturnValue(null)

    await expect(fetchLocationPipelineInputs(3.14, 101.69, 'HIGH', false)).rejects.toThrow(
      'Solar API returned invalid building insights payload'
    )
    expect(fetchDataLayersMock).not.toHaveBeenCalled()
  })

  // SAFP-02
  it('downloads all five layers when every URL is present and returns the canonical shape', async () => {
    fetchBuildingInsightsMock.mockResolvedValue(VALID_BI)
    parseBuildingInsightsMock.mockReturnValue(VALID_BI)
    enrichBuildingInsightsMock.mockReturnValue({ ...VALID_BI, enriched: true })
    calculateRadiusMock.mockReturnValue(150)
    fetchDataLayersMock.mockResolvedValue({
      dsmUrl: 'https://example.com/dsm',
      rgbUrl: 'https://example.com/rgb',
      maskUrl: 'https://example.com/mask',
      annualFluxUrl: 'https://example.com/annual',
      monthlyFluxUrl: 'https://example.com/monthly'
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new ArrayBuffer(8), { status: 200 })
    )

    const result = await fetchLocationPipelineInputs(3.14, 101.69, 'HIGH', false)

    expect(fetchSpy).toHaveBeenCalledTimes(5)
    expect(result.downloadedLayers).toHaveLength(5)
    expect(result.downloadedLayers.map((l) => l.field).sort()).toEqual([
      'annualFluxUrl',
      'dsmUrl',
      'maskUrl',
      'monthlyFluxUrl',
      'rgbUrl'
    ])
    expect(result.buildingInsightsJson).toMatchObject({ enriched: true })
    expect(result.buildingInsights).toBe(VALID_BI)
  })

  // SAFP-03
  it('skips layers whose URLs are null and only downloads the present ones', async () => {
    fetchBuildingInsightsMock.mockResolvedValue(VALID_BI)
    parseBuildingInsightsMock.mockReturnValue(VALID_BI)
    enrichBuildingInsightsMock.mockReturnValue(VALID_BI)
    calculateRadiusMock.mockReturnValue(150)
    fetchDataLayersMock.mockResolvedValue({
      dsmUrl: 'https://example.com/dsm',
      rgbUrl: null,
      maskUrl: null,
      annualFluxUrl: null,
      monthlyFluxUrl: 'https://example.com/monthly'
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new ArrayBuffer(8), { status: 200 })
    )

    const result = await fetchLocationPipelineInputs(3.14, 101.69, 'HIGH', false)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result.downloadedLayers).toHaveLength(2)
  })

  // SAFP-04
  it('appends the configured Google API key to every layer download URL', async () => {
    fetchBuildingInsightsMock.mockResolvedValue(VALID_BI)
    parseBuildingInsightsMock.mockReturnValue(VALID_BI)
    enrichBuildingInsightsMock.mockReturnValue(VALID_BI)
    calculateRadiusMock.mockReturnValue(150)
    fetchDataLayersMock.mockResolvedValue({
      dsmUrl: 'https://example.com/dsm',
      rgbUrl: null,
      maskUrl: null,
      annualFluxUrl: null,
      monthlyFluxUrl: null
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new ArrayBuffer(8), { status: 200 })
    )

    await fetchLocationPipelineInputs(3.14, 101.69, 'HIGH', false)

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('key=test-google-api-key')
    expect(calledUrl).toContain('https://example.com/dsm')
  })

  // SAFP-05
  it('throws when a layer download responds with a non-OK status', async () => {
    fetchBuildingInsightsMock.mockResolvedValue(VALID_BI)
    parseBuildingInsightsMock.mockReturnValue(VALID_BI)
    enrichBuildingInsightsMock.mockReturnValue(VALID_BI)
    calculateRadiusMock.mockReturnValue(150)
    fetchDataLayersMock.mockResolvedValue({
      dsmUrl: 'https://example.com/dsm',
      rgbUrl: null,
      maskUrl: null,
      annualFluxUrl: null,
      monthlyFluxUrl: null
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
    )

    await expect(fetchLocationPipelineInputs(3.14, 101.69, 'HIGH', false)).rejects.toThrow(
      'Failed to download dsmUrl'
    )
  })
})
