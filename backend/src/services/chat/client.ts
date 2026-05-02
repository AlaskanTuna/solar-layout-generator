import { GoogleGenAI } from '@google/genai'
import { env } from '../../config/env.js'

type ClientMode = 'vertex' | 'apikey'

let cached: GoogleGenAI | null = null
let mode: ClientMode | null = null

/**
 * Returns a process-cached GoogleGenAI client.
 * Tries Vertex AI first when GOOGLE_CLOUD_PROJECT is set, falls back to the
 * Gemini Developer API key when Vertex initialisation throws or no project is configured.
 */
export function getGenAIClient(): GoogleGenAI {
  if (cached) return cached

  if (env.GOOGLE_CLOUD_PROJECT) {
    try {
      cached = new GoogleGenAI({
        vertexai: true,
        project: env.GOOGLE_CLOUD_PROJECT,
        location: env.GOOGLE_CLOUD_LOCATION
      })
      mode = 'vertex'
      console.info(
        `[Chat] GenAI client initialised in Vertex mode (project=${env.GOOGLE_CLOUD_PROJECT}, location=${env.GOOGLE_CLOUD_LOCATION})`
      )
      return cached
    } catch (err) {
      console.warn('[Chat] Vertex init threw, falling back to API key', err)
    }
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error('No Gemini auth available (Vertex unavailable and GEMINI_API_KEY unset)')
  }

  cached = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  mode = 'apikey'
  console.info('[Chat] GenAI client initialised in API-key mode')
  return cached
}

/**
 * Drops the cached client when the orchestrator catches a 401/403 in Vertex mode,
 * so the next getGenAIClient() rebuilds in API-key mode. No-op when there's no
 * fallback key configured or the active mode is already apikey.
 */
export function invalidateForAuthFailure(): void {
  if (mode === 'vertex' && env.GEMINI_API_KEY) {
    console.warn('[Chat] Vertex auth failed at request time, invalidating cache for API-key fallback')
    cached = null
    mode = null
  }
}

/**
 * Test-only: clears the cached client. Exported for vitest setup, not for runtime use.
 */
export function __resetClientForTests(): void {
  cached = null
  mode = null
}
