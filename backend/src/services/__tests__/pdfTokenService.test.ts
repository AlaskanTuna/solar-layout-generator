import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../../config/env.js', () => ({
  env: {
    PDF_TOKEN_SECRET: 'test-secret-at-least-32-characters-long-ok'
  }
}))

const { signPdfToken, verifyPdfToken, InvalidPdfTokenError } = await import('../pdfTokenService.js')

describe('pdfTokenService', () => {
  const userId = '00000000-0000-0000-0000-000000000001'
  const projectId = '00000000-0000-0000-0000-000000000002'

  beforeEach(() => {
    vi.useRealTimers()
  })

  it('signs a token that round-trips through verifyPdfToken', () => {
    const { token, expiresAt } = signPdfToken(userId, projectId)
    expect(token).toBeTypeOf('string')
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())

    const payload = verifyPdfToken(token)
    expect(payload.sub).toBe(userId)
    expect(payload.projectId).toBe(projectId)
    expect(payload.type).toBe('pdf-export')
  })

  it('rejects expired tokens', () => {
    vi.useFakeTimers()
    const { token } = signPdfToken(userId, projectId)
    vi.advanceTimersByTime(61 * 1000)

    expect(() => verifyPdfToken(token)).toThrow(InvalidPdfTokenError)
    expect(() => verifyPdfToken(token)).toThrow(/expired/i)
  })

  it('rejects tokens signed with a different secret', () => {
    const foreignToken = jwt.sign(
      { sub: userId, projectId, type: 'pdf-export' },
      'wrong-secret-at-least-32-characters-long-!',
      { algorithm: 'HS256', expiresIn: 60 }
    )
    expect(() => verifyPdfToken(foreignToken)).toThrow(InvalidPdfTokenError)
    expect(() => verifyPdfToken(foreignToken)).toThrow(/signature/i)
  })

  it('rejects tokens with wrong type claim', () => {
    const wrongType = jwt.sign(
      { sub: userId, projectId, type: 'other-purpose' },
      'test-secret-at-least-32-characters-long-ok',
      { algorithm: 'HS256', expiresIn: 60 }
    )
    expect(() => verifyPdfToken(wrongType)).toThrow(InvalidPdfTokenError)
    expect(() => verifyPdfToken(wrongType)).toThrow(/claims/i)
  })

  it('rejects malformed tokens', () => {
    expect(() => verifyPdfToken('not-a-jwt')).toThrow(InvalidPdfTokenError)
  })

  it('rejects tokens missing required claims', () => {
    const missingProject = jwt.sign({ sub: userId, type: 'pdf-export' }, 'test-secret-at-least-32-characters-long-ok', {
      algorithm: 'HS256',
      expiresIn: 60
    })
    expect(() => verifyPdfToken(missingProject)).toThrow(InvalidPdfTokenError)
  })
})
