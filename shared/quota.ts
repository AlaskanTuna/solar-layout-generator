export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE'

export const TIER_DAILY_LIMITS: Record<UserTier, number> = {
  FREE: 5,
  PRO: 20,
  ENTERPRISE: Number.POSITIVE_INFINITY
}

export const WARNING_THRESHOLD = 0.2

export type QuotaSummary = {
  tier: UserTier
  used: number
  limit: number | null
  resetsAt: string
}
