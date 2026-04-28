import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../config/env.js', () => ({
  env: {
    GOOGLE_API_KEY: 'TEST_KEY'
  }
}))

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

import { fetchBuildingInsights, fetchDataLayers, findBestQualityForLocation } from '../solarApiService.js'

describe('findBestQualityForLocation', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Each tier probe = 2 fetch calls (buildingInsights + dataLayers).
  // Step order: HIGH → BASE (no exp) → BASE+EXPANDED.

  it('returns HIGH when the HIGH chain succeeds (short-circuits later tiers)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true })

    await expect(findBestQualityForLocation(37.42, -122.08)).resolves.toEqual({
      availableQualities: ['HIGH'],
      bestQuality: 'HIGH',
      expandedCoverage: false
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('falls back to BASE without expansion when HIGH fails on dataLayers but BASE chain succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // HIGH buildingInsights ok
      .mockResolvedValueOnce({ ok: false, status: 404 }) // HIGH dataLayers 404 (real Klang behavior)
      .mockResolvedValueOnce({ ok: true }) // BASE no-exp buildingInsights ok
      .mockResolvedValueOnce({ ok: true }) // BASE no-exp dataLayers ok

    await expect(findBestQualityForLocation(37.42, -122.08)).resolves.toEqual({
      availableQualities: ['BASE'],
      bestQuality: 'BASE',
      expandedCoverage: false
    })
  })

  it('falls back to BASE+EXPANDED when neither HIGH nor BASE-no-exp work', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // HIGH bi ok
      .mockResolvedValueOnce({ ok: false, status: 404 }) // HIGH dl 404
      .mockResolvedValueOnce({ ok: true }) // BASE bi ok
      .mockResolvedValueOnce({ ok: false, status: 404 }) // BASE dl 404
      .mockResolvedValueOnce({ ok: true }) // BASE+EXP bi ok
      .mockResolvedValueOnce({ ok: true }) // BASE+EXP dl ok

    await expect(findBestQualityForLocation(37.42, -122.08)).resolves.toEqual({
      availableQualities: ['BASE'],
      bestQuality: 'BASE',
      expandedCoverage: true
    })
    // The 5th and 6th calls (BASE+EXP probes) must include experiments param.
    expect(mockFetch.mock.calls[4]?.[0]).toContain('experiments=EXPANDED_COVERAGE')
    expect(mockFetch.mock.calls[5]?.[0]).toContain('experiments=EXPANDED_COVERAGE')
  })

  it('returns null when every tier fails', async () => {
    // 6 failed probes (3 tiers × 2 endpoints). After buildingInsights fails the
    // probe short-circuits, so dataLayers fetch is not invoked for that tier.
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 }) // HIGH bi fail → no dl call
      .mockResolvedValueOnce({ ok: false, status: 404 }) // BASE bi fail → no dl call
      .mockResolvedValueOnce({ ok: false, status: 404 }) // BASE+EXP bi fail

    await expect(findBestQualityForLocation(37.42, -122.08)).resolves.toEqual({
      availableQualities: [],
      bestQuality: null,
      expandedCoverage: false
    })
  })

  it('treats thrown fetch errors as failed probes', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network')) // HIGH bi throws
      .mockRejectedValueOnce(new Error('network')) // BASE bi throws
      .mockResolvedValueOnce({ ok: true }) // BASE+EXP bi ok
      .mockResolvedValueOnce({ ok: true }) // BASE+EXP dl ok

    await expect(findBestQualityForLocation(37.42, -122.08)).resolves.toEqual({
      availableQualities: ['BASE'],
      bestQuality: 'BASE',
      expandedCoverage: true
    })
  })
})

describe('fetchBuildingInsights', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('emits requiredQuality=HIGH and no experiments by default', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'insights' }) })

    await fetchBuildingInsights(37.42, -122.08)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]?.[0]).toContain('requiredQuality=HIGH')
    expect(mockFetch.mock.calls[0]?.[0]).not.toContain('experiments=EXPANDED_COVERAGE')
  })

  it('emits requiredQuality=BASE and experiments=EXPANDED_COVERAGE when expandedCoverage is enabled', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'insights' }) })

    await fetchBuildingInsights(37.42, -122.08, { requiredQuality: 'BASE', expandedCoverage: true })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]?.[0]).toContain('requiredQuality=BASE')
    expect(mockFetch.mock.calls[0]?.[0]).toContain('experiments=EXPANDED_COVERAGE')
  })
})

describe('fetchDataLayers', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses view=FULL_LAYERS for HIGH quality (default)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'layers' }) })

    await fetchDataLayers(37.42, -122.08, 125)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('view=FULL_LAYERS')
    expect(url).toContain('radiusMeters=125')
    expect(url).toContain('requiredQuality=HIGH')
    expect(url).not.toContain('experiments=EXPANDED_COVERAGE')
  })

  it('uses view=FULL_LAYERS for BASE+EXPANDED too (matrix-confirmed working combo)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'layers' }) })

    await fetchDataLayers(37.42, -122.08, 125, { requiredQuality: 'BASE', expandedCoverage: true })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('view=FULL_LAYERS')
    expect(url).toContain('radiusMeters=125')
    expect(url).toContain('requiredQuality=BASE')
    expect(url).toContain('experiments=EXPANDED_COVERAGE')
  })
})
