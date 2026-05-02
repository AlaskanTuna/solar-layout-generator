import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatContext, ChatProvider } from '../ChatProvider'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' }
  })
}))

function wrapper({ children }: React.PropsWithChildren) {
  return <ChatProvider>{children}</ChatProvider>
}

describe('ChatProvider', () => {
  it('initializes unknown projects and clones map-backed state updates', () => {
    const { result, rerender } = renderHook(() => React.useContext(ChatContext), { wrapper })

    const initial = result.current.getState('project-1')
    expect(initial).toEqual({
      messages: [],
      isStreaming: false,
      error: null,
      isOpen: false
    })
    expect(result.current.isAnyOpen).toBe(false)

    act(() => {
      result.current.setState('project-1', (prev) => ({
        ...prev,
        isOpen: true
      }))
    })

    rerender()

    const updated = result.current.getState('project-1')
    expect(updated.isOpen).toBe(true)
    expect(result.current.isAnyOpen).toBe(true)
  })

  it('resets only the requested project state', () => {
    const { result } = renderHook(() => React.useContext(ChatContext), { wrapper })

    act(() => {
      result.current.setState('project-1', (prev) => ({
        ...prev,
        isOpen: true,
        messages: [{ id: '1', role: 'user', content: 'hello' }]
      }))
      result.current.setState('project-2', (prev) => ({
        ...prev,
        isOpen: true
      }))
    })

    act(() => {
      result.current.reset('project-1')
    })

    expect(result.current.getState('project-1')).toEqual({
      messages: [],
      isStreaming: false,
      error: null,
      isOpen: false
    })
    expect(result.current.getState('project-2').isOpen).toBe(true)
  })
})
