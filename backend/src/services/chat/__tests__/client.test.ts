import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGoogleGenAI = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI
}))

const envMock = {
  PORT: undefined,
  BACKEND_PORT: 3001,
  NODE_ENV: 'test' as const,
  SUPABASE_DATABASE_URL: 'postgres://test',
  GOOGLE_API_KEY: 'gmaps-key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv',
  FRONTEND_URL: 'http://localhost:5173',
  PDF_TOKEN_SECRET: 'test-secret-at-least-32-characters-long-ok',
  GEMINI_API_KEY: 'fallback-api-key' as string | undefined,
  GOOGLE_CLOUD_PROJECT: 'solar-layout-generator' as string | undefined,
  GOOGLE_CLOUD_LOCATION: 'global',
  CHAT_MODEL: 'gemini-3.1-flash-lite-preview',
  port: 3001
}

vi.mock('../../../config/env.js', () => ({
  get env() {
    return envMock
  }
}))

const { getGenAIClient, invalidateForAuthFailure, __resetClientForTests } = await import('../client.js')

describe('getGenAIClient', () => {
  beforeEach(() => {
    mockGoogleGenAI.mockReset()
    mockGoogleGenAI.mockImplementation(() => ({ tag: 'fake-client' }))
    __resetClientForTests()
    envMock.GEMINI_API_KEY = 'fallback-api-key'
    envMock.GOOGLE_CLOUD_PROJECT = 'solar-layout-generator'
  })

  it('prefers Vertex when GOOGLE_CLOUD_PROJECT is set', () => {
    getGenAIClient()
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(1)
    expect(mockGoogleGenAI).toHaveBeenCalledWith({
      vertexai: true,
      project: 'solar-layout-generator',
      location: 'global'
    })
  })

  it('caches the client across repeat calls without re-constructing', () => {
    const a = getGenAIClient()
    const b = getGenAIClient()
    expect(a).toBe(b)
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(1)
  })

  it('latches API-key mode after invalidateForAuthFailure so Vertex is never retried', () => {
    getGenAIClient()
    expect(mockGoogleGenAI).toHaveBeenLastCalledWith(expect.objectContaining({ vertexai: true }))

    invalidateForAuthFailure()
    getGenAIClient()

    expect(mockGoogleGenAI).toHaveBeenCalledTimes(2)
    expect(mockGoogleGenAI).toHaveBeenLastCalledWith({ apiKey: 'fallback-api-key' })

    // A third call after the latch must stay on API-key mode (cached) without
    // constructing a new client of either flavour.
    getGenAIClient()
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(2)
  })

  it('uses API-key mode directly when GOOGLE_CLOUD_PROJECT is unset', () => {
    envMock.GOOGLE_CLOUD_PROJECT = undefined
    getGenAIClient()
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(1)
    expect(mockGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'fallback-api-key' })
  })

  it('falls back to API key when the Vertex constructor throws at init', () => {
    let attempt = 0
    mockGoogleGenAI.mockImplementation((opts: { vertexai?: boolean }) => {
      attempt += 1
      if (attempt === 1 && opts.vertexai) {
        throw new Error('vertex init blew up')
      }
      return { tag: opts.vertexai ? 'vertex' : 'apikey' }
    })

    const client = getGenAIClient()
    expect(client).toEqual({ tag: 'apikey' })
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(2)
    expect(mockGoogleGenAI).toHaveBeenNthCalledWith(2, { apiKey: 'fallback-api-key' })
  })

  it('throws when neither Vertex nor API key is available', () => {
    envMock.GOOGLE_CLOUD_PROJECT = undefined
    envMock.GEMINI_API_KEY = undefined
    expect(() => getGenAIClient()).toThrow(/No Gemini auth available/)
  })

  it('invalidateForAuthFailure is a no-op when no GEMINI_API_KEY is configured', () => {
    envMock.GEMINI_API_KEY = undefined
    getGenAIClient()
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(1)

    invalidateForAuthFailure()
    const next = getGenAIClient()

    // Still cached, still Vertex — invalidation never fired because the no-key
    // guard short-circuits it. This is the spec-defined behaviour.
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(1)
    expect(next).toEqual({ tag: 'fake-client' })
  })
})
