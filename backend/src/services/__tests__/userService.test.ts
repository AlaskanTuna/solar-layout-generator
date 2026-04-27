import { beforeEach, describe, expect, it, vi } from 'vitest'

const { count, single, eq, select, from } = vi.hoisted(() => {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const count = vi.fn()
  return { count, single, eq, select, from }
})

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    projectQuotaUsage: { count }
  }
}))

vi.mock('../../config/supabase.js', () => ({
  supabase: { from }
}))

import { getQuotaSummary, startOfUtcDay, nextUtcMidnight } from '../userService.js'

describe('userService date helpers', () => {
  it('startOfUtcDay truncates to UTC midnight', () => {
    const now = new Date('2026-04-17T15:42:11.000Z')
    expect(startOfUtcDay(now).toISOString()).toBe('2026-04-17T00:00:00.000Z')
  })

  it('nextUtcMidnight rolls forward one UTC day', () => {
    const now = new Date('2026-04-17T23:59:59.000Z')
    expect(nextUtcMidnight(now).toISOString()).toBe('2026-04-18T00:00:00.000Z')
  })

  it('nextUtcMidnight returns tomorrow even just after midnight', () => {
    const now = new Date('2026-04-17T00:00:01.000Z')
    expect(nextUtcMidnight(now).toISOString()).toBe('2026-04-18T00:00:00.000Z')
  })
})

describe('getQuotaSummary', () => {
  beforeEach(() => {
    single.mockReset()
    count.mockReset()
    from.mockClear()
    select.mockClear()
    eq.mockClear()
  })

  it('returns FREE tier quota with used count and reset timestamp', async () => {
    single.mockResolvedValue({ data: { tier: 'FREE' }, error: null })
    count.mockResolvedValue(3)

    const summary = await getQuotaSummary('user_1', new Date('2026-04-17T10:00:00.000Z'))

    expect(summary).toEqual({
      tier: 'FREE',
      used: 3,
      limit: 5,
      resetsAt: '2026-04-18T00:00:00.000Z'
    })
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'user_1', createdAt: { gte: new Date('2026-04-17T00:00:00.000Z') } }
    })
  })

  it('blocks FREE user at 5/5 used (caller enforces)', async () => {
    single.mockResolvedValue({ data: { tier: 'FREE' }, error: null })
    count.mockResolvedValue(5)

    const summary = await getQuotaSummary('user_1', new Date('2026-04-17T10:00:00.000Z'))

    expect(summary.used).toBe(5)
    expect(summary.limit).toBe(5)
  })

  it('returns PRO tier with 20-project cap', async () => {
    single.mockResolvedValue({ data: { tier: 'PRO' }, error: null })
    count.mockResolvedValue(12)

    const summary = await getQuotaSummary('user_2', new Date('2026-04-17T10:00:00.000Z'))

    expect(summary.tier).toBe('PRO')
    expect(summary.limit).toBe(20)
    expect(summary.used).toBe(12)
  })

  it('returns ENTERPRISE tier with null (unlimited) limit', async () => {
    single.mockResolvedValue({ data: { tier: 'ENTERPRISE' }, error: null })
    count.mockResolvedValue(99)

    const summary = await getQuotaSummary('user_3', new Date('2026-04-17T10:00:00.000Z'))

    expect(summary.tier).toBe('ENTERPRISE')
    expect(summary.limit).toBeNull()
    expect(summary.used).toBe(99)
  })

  it('falls back to FREE when profile row is missing', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    count.mockResolvedValue(0)

    const summary = await getQuotaSummary('ghost', new Date('2026-04-17T10:00:00.000Z'))

    expect(summary.tier).toBe('FREE')
    expect(summary.limit).toBe(5)
  })

  it('resets used count after UTC midnight (injectable clock)', async () => {
    single.mockResolvedValue({ data: { tier: 'FREE' }, error: null })
    count.mockResolvedValueOnce(5).mockResolvedValueOnce(0)

    const before = await getQuotaSummary('user_1', new Date('2026-04-17T23:59:00.000Z'))
    const after = await getQuotaSummary('user_1', new Date('2026-04-18T00:00:01.000Z'))

    expect(before.used).toBe(5)
    expect(before.resetsAt).toBe('2026-04-18T00:00:00.000Z')
    expect(after.used).toBe(0)
    expect(after.resetsAt).toBe('2026-04-19T00:00:00.000Z')
    expect(count).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user_1', createdAt: { gte: new Date('2026-04-17T00:00:00.000Z') } }
    })
    expect(count).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user_1', createdAt: { gte: new Date('2026-04-18T00:00:00.000Z') } }
    })
  })
})
