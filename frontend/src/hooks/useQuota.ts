import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getQuota } from '@/api/quota'
import { WARNING_THRESHOLD } from '@shared/types'
import { notificationStore } from '@/lib/notificationStore'
import { useAuth } from '@/hooks/useAuth'

const QUOTA_WARNING_KEY = 'slg-quota-warning-notified'

function formatReset(resetsAt: string): string {
  const d = new Date(resetsAt)
  return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Provides the quota hook
 * @returns {Function} Hook state for quota
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
