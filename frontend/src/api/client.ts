/**
 * Authenticated API client.
 *
 * Every backend call goes through `apiFetch`, which:
 *   - Pulls the current Supabase session and attaches a `Bearer` token.
 *   - JSON-encodes the body and sets the right content-type.
 *   - Logs request / response info in dev mode for easier debugging.
 *   - Throws a typed `ApiError` on non-2xx responses so React Query and
 *     route components can react to status codes uniformly.
 *
 * All paths are relative to `/api` (proxied to the backend via Vite in dev and
 * rewritten by Vercel in production).
 */

import { getSupabase } from '@/lib/supabase'

/**
 * Error thrown by `apiFetch` for any non-2xx response. Preserves the HTTP
 * status code so callers can branch on 401 (sign-out), 429 (quota), etc.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Calls a backend endpoint with auth, JSON, and uniform error handling.
 *
 * @param path - Path relative to `/api` (e.g. `/projects/123`)
 * @param options - Standard `fetch` options; `body` should already be a string
 * @returns Parsed JSON response, typed as `T`
 * @throws `ApiError` if the response status is not 2xx
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const supabase = getSupabase()
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
