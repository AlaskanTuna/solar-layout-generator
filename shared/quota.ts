/**
 * Per-user daily project quota types and limits.
 *
 * Project creation is rate-limited per day to control Google Solar API spend.
 * The tier defines the daily ceiling; usage resets at the start of each
 * Malaysia-time day.
 */

/** Account tier used for daily quota limits. */
export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE'

/**
 * Per-tier daily project creation limits.
 *
 * - FREE: 5 projects/day — sufficient for most homeowners.
 * - PRO: 20 projects/day — for installers handling multiple clients.
 * - ENTERPRISE: unlimited.
 */
export const TIER_DAILY_LIMITS: Record<UserTier, number> = {
  FREE: 5,
  PRO: 20,
  ENTERPRISE: Number.POSITIVE_INFINITY
}

/**
 * Fraction of the daily limit remaining that triggers the in-app warning
 * banner (20% remaining → warn). Centralised so the backend and frontend
 * agree on when to surface the warning.
 */
export const WARNING_THRESHOLD = 0.2

/**
 * Summary payload returned by `GET /quota`.
 *
 * `limit` is `null` for ENTERPRISE (unbounded); otherwise it is the daily
 * cap. `resetsAt` is an ISO timestamp indicating when the counter rolls.
 */
export type QuotaSummary = {
  tier: UserTier
  used: number
  limit: number | null
  resetsAt: string
}
