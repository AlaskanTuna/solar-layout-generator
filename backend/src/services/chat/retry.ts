/**
 * Retries a transient Gemini generation call with exponential backoff.
 */
export async function generateWithRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      return await call()
    } catch (error) {
      if (attempt === 2 || !isRetryable(error)) {
        throw error
      }

      const baseDelayMs = 2000 * 2 ** attempt
      const jitterMs = Math.random() * baseDelayMs
      await sleep(baseDelayMs + jitterMs)
    }
  }

  throw new Error('unreachable')
}

function isRetryable(error: unknown): boolean {
  const code = getErrorCode(error)
  return code === 429 || code === 503
}

function getErrorCode(error: unknown): number | string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  const maybeCode = error as { status?: number | string; code?: number | string }
  return maybeCode.status ?? maybeCode.code
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
