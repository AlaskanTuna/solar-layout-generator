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

import { getLocationDataForUser, getLocationStatusForUser } from '../locationService.js'

describe('locationService ownership filters', () => {
  beforeEach(() => {
    findFirst.mockReset()
  })

  it('allows status polling for orphan locations during new-project analysis', async () => {
    findFirst.mockResolvedValue({ status: 'processing' })

    await getLocationStatusForUser('user_123', 'location_123')

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'location_123',
        OR: [{ projects: { some: { userId: 'user_123' } } }, { projects: { none: {} } }]
      },
      select: { status: true }
    })
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
