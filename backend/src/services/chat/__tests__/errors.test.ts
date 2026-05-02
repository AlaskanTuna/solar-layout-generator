import { describe, expect, it, vi } from 'vitest'

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

const { categoriseError } = await import('../errors.js')

describe('categoriseError', () => {
  it('maps 429 to quota_exhausted with English copy', () => {
    expect(categoriseError({ code: 429 }, 'en')).toEqual({
      category: 'quota_exhausted',
      message: "We've hit our daily limit. Please try again in a few minutes."
    })
  })

  it('maps 503 to service_unavailable with Malay copy', () => {
    expect(categoriseError({ code: 503 }, 'ms')).toEqual({
      category: 'service_unavailable',
      message: 'Pembantu ini tidak tersedia buat sementara waktu. Cuba lagi sebentar lagi.'
    })
  })

  it('maps 401 to permission_denied with Chinese copy', () => {
    expect(categoriseError({ code: 401 }, 'zh')).toEqual({
      category: 'permission_denied',
      message: '助手配置不正确，请联系支援人员。'
    })
  })

  it('maps injection_rejected to the localized refusal', () => {
    expect(categoriseError({ code: 'injection_rejected' }, 'en')).toEqual({
      category: 'injection_rejected',
      message: "Sorry, I can't process that request. Try rephrasing your question."
    })
  })

  it('maps ENOTFOUND errors to network_failure', () => {
    expect(categoriseError(new Error('ENOTFOUND foo'), 'en')).toEqual({
      category: 'network_failure',
      message: "Couldn't reach the assistant. Check your connection and try again."
    })
  })

  it('maps unrelated errors to unknown', () => {
    expect(categoriseError({ message: 'unrelated' }, 'en')).toEqual({
      category: 'unknown',
      message: 'Something went wrong. Please try again.'
    })
  })

  it('redacts 5+ digit runs on Error messages before localization', () => {
    const error = new Error('request failed for account 12345 and trace 987654')

    categoriseError(error, 'en')

    expect(error.message).toBe('request failed for account [redacted] and trace [redacted]')
  })
})
