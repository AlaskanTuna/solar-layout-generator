import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react'
import { useAuth } from '@/hooks/useAuth'

export type ChatMessage = {
  id: string
  role: 'user' | 'model'
  content: string
  streaming?: boolean
  suggestions?: string[]
  error?: { category: string; message: string }
}

export type ProjectChatState = {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  isOpen: boolean
}

export type ChatContextValue = {
  getState: (projectId: string) => ProjectChatState
  setState: (projectId: string, updater: (state: ProjectChatState) => ProjectChatState) => void
  reset: (projectId: string) => void
  isAnyOpen: boolean
}

const EMPTY_CHAT_STATE: ProjectChatState = {
  messages: [],
  isStreaming: false,
  error: null,
  isOpen: false
}

/** Shared per-project chat state that survives page navigation within the SPA. */
export const ChatContext = createContext<ChatContextValue>({
  getState: () => EMPTY_CHAT_STATE,
  setState: () => undefined,
  reset: () => undefined,
  isAnyOpen: false
})

/** Provides per-project chat state keyed by project id. */
export function ChatProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [projectStates, setProjectStates] = useState<Map<string, ProjectChatState>>(() => new Map())

  useEffect(() => {
    if (!user) {
      setProjectStates(new Map())
    }
  }, [user])

  const getState = useCallback(
    (projectId: string) => projectStates.get(projectId) ?? EMPTY_CHAT_STATE,
    [projectStates]
  )

  const setState = useCallback((projectId: string, updater: (state: ProjectChatState) => ProjectChatState) => {
    setProjectStates((prev) => {
      const next = new Map(prev)
      const current = next.get(projectId) ?? EMPTY_CHAT_STATE
      next.set(projectId, updater(current))
      return next
    })
  }, [])

  const reset = useCallback((projectId: string) => {
    setProjectStates((prev) => {
      const next = new Map(prev)
      next.delete(projectId)
      return next
    })
  }, [])

  const isAnyOpen = useMemo(() => [...projectStates.values()].some((state) => state.isOpen), [projectStates])

  return <ChatContext.Provider value={{ getState, setState, reset, isAnyOpen }}>{children}</ChatContext.Provider>
}
