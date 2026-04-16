import { apiFetch } from './client'
import type { QuotaSummary } from '@shared/types'

export function getQuota() {
  return apiFetch<QuotaSummary>('/quota')
}
