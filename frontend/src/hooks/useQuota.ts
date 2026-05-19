/**
 * Daily project quota hook.
 *
 * Polls `GET /quota` (refetches on window focus) and exposes the React Query
 * result. Also pushes a one-per-day notification when the user crosses the
 * `WARNING_THRESHOLD` (20% remaining), deduplicated by user id and date in
 * localStorage so refreshing or revisiting the dashboard doesn't re-fire.
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getQuota } from '@/api/quota'
import { WARNING_THRESHOLD } from '@shared/types'
import { notificationStore } from '@/lib/notificationStore'
import { useAuth } from '@/hooks/useAuth'

/** localStorage prefix for the dedup-by-day warning marker. */
const QUOTA_WARNING_KEY = 'slg-quota-warning-notified'

/** Formats an ISO timestamp as a localized hour:minute (e.g. "12:00 AM"). */
function formatReset(resetsAt: string): string {
  const d = new Date(resetsAt)
  return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Returns the React Query handle for the user's quota plus a `refresh` helper
 * that invalidates the cache. Side-effect: pushes a low-quota notification at
 * most once per user per UTC day.
 */
export function useQuota() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['quota', user?.id],
    queryFn: getQuota,
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 30_000
  })

  const data = query.data

  useEffect(() => {
    if (!data || !user?.id) return
    if (data.limit === null) return
    const remaining = data.limit - data.used
    if (remaining > data.limit * WARNING_THRESHOLD) return

    const today = new Date().toISOString().slice(0, 10)
    const key = `${QUOTA_WARNING_KEY}:${user.id}:${today}`
    if (localStorage.getItem(key)) return

    notificationStore.push(
      'Low project quota',
      `You have ${remaining} of ${data.limit} projects left today. Resets at ${formatReset(data.resetsAt)}.`
    )
    localStorage.setItem(key, '1')
  }, [data, user?.id])

  return {
    ...query,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['quota', user?.id] })
  }
}
