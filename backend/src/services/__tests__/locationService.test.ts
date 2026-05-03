import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn()
}))

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    location: {
      findFirst
    }
  }
}))

vi.mock('../locationPipeline.js', () => ({
  runLocationPipeline: vi.fn()
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

import { getLocationDataForUser, getLocationStatusForUser } from '../locationService.js'

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
