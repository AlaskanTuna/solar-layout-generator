import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirst, update, create, projectUpdateMany } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  projectUpdateMany: vi.fn()
}))

const runLocationPipelineMock = vi.hoisted(() => vi.fn())

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    location: {
      findFirst,
      update,
      create
    },
    project: {
      updateMany: projectUpdateMany
    }
  }
}))

vi.mock('../locationPipeline.js', () => ({
  runLocationPipeline: (...args: unknown[]) => runLocationPipelineMock(...args)
}))

vi.mock('../solarApiService.js', () => ({
  findBestQualityForLocation: vi.fn()
}))

vi.mock('../storageService.js', () => ({
  getSignedUrl: vi.fn()
}))

vi.mock('../geoTiffService.js', () => ({
  loadReferenceGeoTransform: vi.fn(),
  loadRoofMask: vi.fn()
}))

vi.mock('../overlayService.js', () => ({
  getOrGenerateOverlay: vi.fn(),
  resolveTifPath: vi.fn()
}))

vi.mock('../buildingInsightsService.js', () => ({
  parseBuildingInsights: vi.fn()
}))

import { getLocationDataForUser, getLocationStatusForUser, resolveLocation } from '../locationService.js'

describe('locationService ownership filters', () => {
  beforeEach(() => {
    findFirst.mockReset()
  })

  it('allows status polling for orphan locations during new-project analysis', async () => {
    findFirst.mockResolvedValue({ status: 'processing' })

    const before = Date.now()
    await getLocationStatusForUser('user_123', 'location_123')
    const after = Date.now()

    expect(findFirst).toHaveBeenCalledTimes(1)
    const arg = findFirst.mock.calls[0]![0] as {
      where: { id: string; OR: Array<Record<string, unknown>> }
      select: { status: boolean }
    }
    expect(arg.where.id).toBe('location_123')
    expect(arg.select).toEqual({ status: true })
    expect(arg.where.OR[0]).toEqual({ projects: { some: { userId: 'user_123' } } })
    const orphanArm = arg.where.OR[1] as { projects: { none: {} }; createdAt: { gte: Date } }
    expect(orphanArm.projects).toEqual({ none: {} })
    // Orphan-status polling is now scoped to a 5-minute post-create window so
    // unowned locations can't be polled forever via UUID guessing.
    const fiveMinAgo = before - 5 * 60_000
    const fiveMinAgoUpper = after - 5 * 60_000
    expect(orphanArm.createdAt.gte.getTime()).toBeGreaterThanOrEqual(fiveMinAgo)
    expect(orphanArm.createdAt.gte.getTime()).toBeLessThanOrEqual(fiveMinAgoUpper)
  })

  it('keeps location data access tied to an owned project', async () => {
    findFirst.mockResolvedValue(null)

    await getLocationDataForUser('user_456', 'location_456')

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'location_456',
        projects: { some: { userId: 'user_456' } }
      }
    })
  })
})

describe('resolveLocation stale-processing recovery', () => {
  beforeEach(() => {
    findFirst.mockReset()
    update.mockReset()
    create.mockReset()
    projectUpdateMany.mockReset()
    runLocationPipelineMock.mockReset()
    runLocationPipelineMock.mockResolvedValue(undefined)
  })

  it('marks a >5min-old processing row as failed and starts a fresh pipeline', async () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60_000)
    findFirst.mockResolvedValue({
      id: 'stale_loc',
      status: 'processing',
      createdAt: sixMinutesAgo
    })
    create.mockResolvedValue({ id: 'fresh_loc' })

    const result = await resolveLocation('user_1', 3.14, 101.69)

    expect(update).toHaveBeenCalledWith({ where: { id: 'stale_loc' }, data: { status: 'failed' } })
    expect(create).toHaveBeenCalledWith({ data: { lat: 3.14, lng: 101.69 } })
    expect(runLocationPipelineMock).toHaveBeenCalledWith('fresh_loc', 3.14, 101.69, 'HIGH', false)
    expect(result).toEqual({ locationId: 'fresh_loc', status: 'processing' })
  })

  it('reuses a fresh processing row (under 5 min) instead of restarting', async () => {
    const recentlyCreated = new Date(Date.now() - 30_000)
    findFirst.mockResolvedValue({
      id: 'fresh_loc',
      status: 'processing',
      createdAt: recentlyCreated
    })

    const result = await resolveLocation('user_1', 3.14, 101.69)

    expect(update).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(runLocationPipelineMock).not.toHaveBeenCalled()
    expect(result).toEqual({ locationId: 'fresh_loc', status: 'processing' })
  })

  it('reuses a ready row regardless of age', async () => {
    const longAgo = new Date(Date.now() - 24 * 60 * 60_000)
    findFirst.mockResolvedValue({
      id: 'cached_loc',
      status: 'ready',
      createdAt: longAgo
    })

    const result = await resolveLocation('user_1', 3.14, 101.69)

    expect(update).not.toHaveBeenCalled()
    expect(result).toEqual({ locationId: 'cached_loc', status: 'ready' })
  })
})
