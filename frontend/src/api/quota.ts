/**
 * Quota API client.
 *
 * Returns the user's daily project-creation quota: tier, remaining slots, and
 * the timestamp when the counter resets. Used by the dashboard banner and the
 * `useQuota` hook to warn before creation fails.
 */

import { apiFetch } from './client'
import type { QuotaSummary } from '@shared/types'

/** Fetches the authenticated user's daily project quota summary. */
export function getQuota() {
  return apiFetch<QuotaSummary>('/quota')
}
