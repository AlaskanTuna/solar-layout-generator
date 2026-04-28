import { supabase } from '../config/supabase.js'
import { prisma } from '../config/prisma.js'
import { TIER_DAILY_LIMITS, type UserTier, type QuotaSummary } from '@shared/types'

/**
 * Start of the UTC day for a reference time
 * @param {Date} now - Value used for now
 * @returns {Date} The resulting start of utc day value
 */
export function startOfUtcDay(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Next UTC midnight for a reference time
 * @param {Date} now - Value used for now
 * @returns {Date} The resulting next utc midnight value
 */
export function nextUtcMidnight(now: Date = new Date()): Date {
  const d = startOfUtcDay(now)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

/**
 * Read the user's tier from Supabase
 * @param {string} userId - Authenticated user identifier
 * @returns {Promise<UserTier>} A promise resolving to the requested user tier
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  const { data, error } = await supabase.from('profiles').select('tier').eq('id', userId).single()
  if (error || !data) {
    console.warn(`[UserTier] profile missing for user=${userId}, defaulting to FREE`, error?.message ?? '')
    return 'FREE'
  }
  return data.tier as UserTier
}

/**
 * Count projects created since the current UTC day started
 * @param {string} userId - Authenticated user identifier
 * @param {Date} now - Value used for now
 * @returns {Promise<number>} A promise resolving to the resulting value
 */
export async function countProjectsSinceUtcMidnight(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.projectQuotaUsage.count({
    where: {
      userId,
      createdAt: { gte: startOfUtcDay(now) }
    }
  })
}

/**
 * Builds the user's daily quota summary
 * @param {string} userId - Authenticated user identifier
 * @param {Date} now - Value used for now
 * @returns {Promise<QuotaSummary>} A promise resolving to the requested quota summary
 */
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
