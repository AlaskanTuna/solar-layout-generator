import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wallClockNow = performance.now.bind(performance)

const TEST_ENV = {
  BACKEND_PORT: 3001,
  NODE_ENV: 'test',
  SUPABASE_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/solarsim',
  GOOGLE_API_KEY: 'google-api-key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  FRONTEND_URL: 'http://localhost:5173',
  PDF_TOKEN_SECRET: 'test-secret-at-least-32-characters-long-ok',
  GEMINI_API_KEY: 'gemini-api-key',
  GOOGLE_CLOUD_PROJECT: 'vertex-project',
  GOOGLE_CLOUD_LOCATION: 'global',
  CHAT_MODEL: 'gemini-2.5-flash',
  port: 3001
} as const

vi.mock('../../../config/env.js', () => ({
  env: TEST_ENV
}))

const { generateWithRetry } = await import('../retry.js')

describe('generateWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns immediately on first-try success', async () => {
    const call = vi.fn().mockResolvedValue('ok')
    const startedAt = wallClockNow()

    await expect(generateWithRetry(call)).resolves.toBe('ok')

    expect(call).toHaveBeenCalledTimes(1)
    expect(wallClockNow() - startedAt).toBeLessThan(50)
  })

  it('retries once on a 429 then succeeds', async () => {
    const call = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValueOnce('ok')
    const startedAt = wallClockNow()
    const promise = generateWithRetry(call)

    await vi.advanceTimersByTimeAsync(2000)

    await expect(promise).resolves.toBe('ok')
    expect(call).toHaveBeenCalledTimes(2)
    expect(wallClockNow() - startedAt).toBeLessThan(50)
  })

  it('retries twice on consecutive 503s then succeeds', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce('ok')
    const startedAt = wallClockNow()
    const promise = generateWithRetry(call)

    await vi.advanceTimersByTimeAsync(6000)

    await expect(promise).resolves.toBe('ok')
    expect(call).toHaveBeenCalledTimes(3)
    expect(wallClockNow() - startedAt).toBeLessThan(50)
  })

  it('surfaces the original error after exhausting retries on persistent 503', async () => {
    const error = { status: 503, message: 'still down' }
    const call = vi.fn().mockRejectedValue(error)
    const promise = generateWithRetry(call)
    const rejection = expect(promise).rejects.toBe(error)

    await vi.advanceTimersByTimeAsync(6000)

    await rejection
    expect(call).toHaveBeenCalledTimes(3)
  })

  it.each([400, 401, 403, 500])('does not retry non-retryable status %i', async (status) => {
    const error = { status }
    const call = vi.fn().mockRejectedValue(error)
    const startedAt = wallClockNow()

    await expect(generateWithRetry(call)).rejects.toBe(error)

    expect(call).toHaveBeenCalledTimes(1)
    expect(wallClockNow() - startedAt).toBeLessThan(50)
  })
})
