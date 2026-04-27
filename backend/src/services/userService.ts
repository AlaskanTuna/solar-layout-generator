import { supabase } from '../config/supabase.js'
import { prisma } from '../config/prisma.js'
import { TIER_DAILY_LIMITS, type UserTier, type QuotaSummary } from '@shared/types'

export function startOfUtcDay(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function nextUtcMidnight(now: Date = new Date()): Date {
  const d = startOfUtcDay(now)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export async function getUserTier(userId: string): Promise<UserTier> {
  const { data, error } = await supabase.from('profiles').select('tier').eq('id', userId).single()
  if (error || !data) {
    console.warn(`[UserTier] profile missing for user=${userId}, defaulting to FREE`, error?.message ?? '')
    return 'FREE'
  }
  return data.tier as UserTier
}

export async function countProjectsSinceUtcMidnight(userId: string, now: Date = new Date()): Promise<number> {
  // Counts immutable quota-usage rows so deleting a project does not refund the
  // user's daily slot. The audit row is inserted in the same transaction as the
  // project create (see projectService.createProject).
  return prisma.projectQuotaUsage.count({
    where: {
      userId,
      createdAt: { gte: startOfUtcDay(now) }
    }
  })
}

export async function getQuotaSummary(userId: string, now: Date = new Date()): Promise<QuotaSummary> {
  const [tier, used] = await Promise.all([getUserTier(userId), countProjectsSinceUtcMidnight(userId, now)])
  const rawLimit = TIER_DAILY_LIMITS[tier]
  const limit = Number.isFinite(rawLimit) ? rawLimit : null
  return {
    tier,
    used,
    limit,
    resetsAt: nextUtcMidnight(now).toISOString()
  }
}
