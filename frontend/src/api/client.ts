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
  const method = options?.method ?? 'GET'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) ?? {})
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  if (import.meta.env.DEV) {
    console.info(`[API] ${method} ${path}`)
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))

    if (import.meta.env.DEV) {
      console.error(`[API] ${method} ${path} -> ${response.status}`, body)
    }

    throw new ApiError(response.status, body.error ?? `Request failed: ${response.status}`)
  }

  if (import.meta.env.DEV) {
    console.info(`[API] ${method} ${path} -> ${response.status}`)
  }

  return response.json() as Promise<T>
}
