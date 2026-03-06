import { supabase } from '@/lib/supabase'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) ?? {})
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.error ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}
