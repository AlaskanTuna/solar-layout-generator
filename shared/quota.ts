/**
 * Account tier used for daily quota limits
 */
export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE'

/**
 * Per-tier daily project limits
 */
export const TIER_DAILY_LIMITS: Record<UserTier, number> = {
  FREE: 5,
  PRO: 20,
  ENTERPRISE: Number.POSITIVE_INFINITY
}

/**
 * Fraction of the limit that triggers a warning
 */
export const WARNING_THRESHOLD = 0.2

/**
 * Summary returned by quota checks
 */
export type QuotaSummary = {
  tier: UserTier
  used: number
  limit: number | null
  resetsAt: string
}
