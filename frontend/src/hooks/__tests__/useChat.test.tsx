import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatProvider } from '@/components/chat/ChatProvider'
import { useChat } from '../useChat'

const getSessionMock = vi.fn()
let idCounter = 0

function installFetchMock(fetchMock: ReturnType<typeof vi.fn>) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    writable: true,
    configurable: true
  })
  Object.defineProperty(window, 'fetch', {
    value: fetchMock,
    writable: true,
    configurable: true
  })
}

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args)
    }
  })
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' }
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      resolvedLanguage: 'en'
    }
  })
}))

function buildSseResponse(chunks: string[]) {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream'
      }
    }
  )
}

function wrapper({ children }: React.PropsWithChildren) {
  return <ChatProvider>{children}</ChatProvider>
}

describe('useChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    idCounter = 0
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token'
        }
      }
    })
    vi.stubGlobal('crypto', {
      randomUUID: () => `message-${++idCounter}`
    })
  })

  it('streams tokens and parses suggestions from the marker buffer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildSseResponse([
          'data: {"type":"token","text":"Hello there"}\n\n',
          'data: {"type":"token","text":"\\n<<<SUGGESTIONS>>>\\n[\\"Ask about payback\\",\\"Explain NEM\\"]"}\n\n',
          'data: {"type":"done"}\n\n'
        ])
      )
    installFetchMock(fetchMock)

    const { result } = renderHook(() => useChat('project-1', 'analysis'), { wrapper })

    await act(async () => {
      await result.current.send('Why is my payback 8.2 years?')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      })
    )
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toMatchObject({
      role: 'model',
      content: 'Hello there',
      suggestions: ['Ask about payback', 'Explain NEM']
    })
  })

  it('drops the placeholder model bubble after an abort', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const signal = init?.signal as AbortSignal

      return new Promise<Response>((_resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    installFetchMock(fetchMock)

    const { result } = renderHook(() => useChat('project-1', 'workbench'), { wrapper })

    const sendPromise = act(async () => {
      const pending = result.current.send('Help me rotate the panels')
      result.current.stop()
      await pending
    })

    await sendPromise
    await waitFor(() => expect(result.current.isStreaming).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: 'Help me rotate the panels'
      })
    ])
  })
})
