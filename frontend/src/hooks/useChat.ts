import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CHAT_SEND_COOLDOWN_MS, ChatContext, type ChatMessage } from '@/components/chat/ChatProvider'
import { getSupabase } from '@/lib/supabase'
import type { AnalysisResultsDto, LayoutPreferences, PanelEdit, StoredAnalysisConfigDto } from '@shared/types'

/** How many follow-up chips to render per model bubble, sampled from the page-specific pool. */
const FOLLOWUP_CHIP_COUNT = 3

type ChatPage = 'workbench' | 'analysis'
type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; category: string; message: string }

/**
 * Snapshot of unsaved frontend state forwarded to the backend chat digest.
 * Each field is independently optional — only send what the current page actually owns.
 */
export type ChatLiveState = {
  analysisConfig?: StoredAnalysisConfigDto | null
  analysisResults?: AnalysisResultsDto | null
  editedLayout?: PanelEdit[] | null
  layoutPreferences?: LayoutPreferences | null
}

/** Returns true if the live state has at least one non-empty field worth sending. */
function hasLiveState(live: ChatLiveState | undefined): live is ChatLiveState {
  if (!live) return false
  return (
    live.analysisConfig != null ||
    live.analysisResults != null ||
    (Array.isArray(live.editedLayout) && live.editedLayout.length > 0) ||
    live.layoutPreferences != null
  )
}

/** Random sample of N entries from a pool, without replacement. Returns [] if pool is empty. */
function samplePool(pool: string[], n: number): string[] {
  if (!Array.isArray(pool) || pool.length === 0) return []
  if (pool.length <= n) return [...pool]
  const copy = [...pool]
  const out: string[] = []
  for (let i = 0; i < n; i += 1) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

/** Parses one `\n\n`-terminated SSE event block into zero or more ChatEvents. */
function parseSseEventBlock(rawEvent: string): ChatEvent[] {
  const events: ChatEvent[] = []
  for (const line of rawEvent.split('\n')) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload) continue
    events.push(JSON.parse(payload) as ChatEvent)
  }
  return events
}

/** Drains all complete `\n\n`-separated events from a buffer; returns the trailing remainder. */
function drainSseBuffer(buffer: string): { events: ChatEvent[]; remaining: string } {
  const events: ChatEvent[] = []
  let remaining = buffer
  while (remaining.includes('\n\n')) {
    const separatorIndex = remaining.indexOf('\n\n')
    const rawEvent = remaining.slice(0, separatorIndex)
    remaining = remaining.slice(separatorIndex + 2)
    events.push(...parseSseEventBlock(rawEvent))
  }
  return { events, remaining }
}

/** Builds JSON + Bearer-auth headers from the current Supabase session, if any. */
async function buildAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

type UseChatReturn = {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  send: (message: string) => Promise<void>
  stop: () => void
  clear: () => void
  /** Wall-clock ms until the spam-guard cooldown lifts, or 0 if it's already lifted. */
  cooldownUntil: number
}

function normaliseLanguage(language: string | undefined): 'en' | 'ms' | 'zh' {
  if (!language) return 'en'
  if (language.startsWith('ms')) return 'ms'
  if (language.startsWith('zh')) return 'zh'
  return 'en'
}

function buildHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'model')
    .filter((message) => !message.streaming && !message.error)
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content
    }))
}

async function readErrorMessage(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : null
}

/**
 * Streams project-grounded chatbot responses over SSE-over-POST.
 *
 * `liveStateProvider` is an optional callback the hook invokes immediately before each
 * send. It returns a fresh snapshot of unsaved page state (analysis form values, in-progress
 * layout edits) so Sol can answer questions about values the user is actively editing. The
 * callback is stored in a ref so it can change identity each parent render without
 * invalidating the memoized `send` function.
 */
export function useChat(
  projectId: string,
  page: ChatPage,
  liveStateProvider?: () => ChatLiveState | undefined
): UseChatReturn {
  const { t, i18n } = useTranslation('chat')
  const { getState, setState, reset } = useContext(ChatContext)
  const abortRef = useRef<AbortController | null>(null)
  const liveStateProviderRef = useRef(liveStateProvider)
  useEffect(() => {
    liveStateProviderRef.current = liveStateProvider
  }, [liveStateProvider])
  const state = getState(projectId)

  const updateMessage = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setState(projectId, (prev) => ({
        ...prev,
        messages: prev.messages.map((message) => (message.id === messageId ? updater(message) : message))
      }))
    },
    [projectId, setState]
  )

  const removeMessage = useCallback(
    (messageId: string) => {
      setState(projectId, (prev) => ({
        ...prev,
        messages: prev.messages.filter((message) => message.id !== messageId)
      }))
    },
    [projectId, setState]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const clear = useCallback(() => {
    stop()
    reset(projectId)
  }, [projectId, reset, stop])

  const send = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim().slice(0, 4000)
      if (!message || state.isStreaming) return

      // Spam guard: enforce a minimum gap between sends. The UI also disables the
      // send button during cooldown, but this guard backs that up so suggestion
      // chips and Enter-to-send can't bypass it.
      const now = Date.now()
      if (now - state.lastSentAt < CHAT_SEND_COOLDOWN_MS) return

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message
      }
      const modelMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: '',
        streaming: true
      }
      const history = buildHistory(state.messages)

      setState(projectId, (prev) => ({
        ...prev,
        error: null,
        isStreaming: true,
        lastSentAt: now,
        messages: [...prev.messages, userMessage, modelMessage]
      }))

      const controller = new AbortController()
      abortRef.current = controller

      let streamFinished = false
      const followupPoolKey = page === 'workbench' ? 'suggestions.followupsWorkbench' : 'suggestions.followupsAnalysis'
      const followupPool = t(followupPoolKey, { returnObjects: true, defaultValue: [] }) as unknown as string[]

      try {
        const headers = await buildAuthHeaders()

        const liveStateSnapshot = liveStateProviderRef.current?.()
        const requestBody: Record<string, unknown> = {
          message,
          history,
          language: normaliseLanguage(i18n.resolvedLanguage ?? i18n.language),
          page
        }
        if (hasLiveState(liveStateSnapshot)) {
          requestBody.liveState = liveStateSnapshot
        }

        const response = await fetch(`/api/projects/${projectId}/chat`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(
            (await readErrorMessage(response)) ??
              (response.status === 401 ? t('errors.unknown') : t('errors.networkFailure'))
          )
        }

        if (!response.body) {
          throw new Error(t('errors.networkFailure'))
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        const handleToken = (text: string) => {
          updateMessage(modelMessage.id, (current) => ({ ...current, content: current.content + text }))
        }

        const finalizeMessage = (category?: string, messageText?: string) => {
          streamFinished = true
          updateMessage(modelMessage.id, (current) => {
            // Follow-up chips: sample N from the page-specific pool authored in chat.json.
            // Suppressed on error bubbles since clicking an unrelated chip after a failure
            // would be more noise than help. Empty pool → no chips, no console noise.
            const isErrorTurn = Boolean(category && messageText)
            const suggestions = isErrorTurn ? current.suggestions : samplePool(followupPool, FOLLOWUP_CHIP_COUNT)

            return {
              ...current,
              content: isErrorTurn ? (messageText as string) : current.content,
              streaming: false,
              suggestions,
              error: isErrorTurn ? { category: category as string, message: messageText as string } : current.error
            }
          })
        }

        const processEvent = (event: ChatEvent) => {
          if (event.type === 'token') {
            handleToken(event.text)
            return
          }

          if (event.type === 'done') {
            finalizeMessage()
            setState(projectId, (prev) => ({ ...prev, isStreaming: false }))
            return
          }

          finalizeMessage(event.category, event.message)
          setState(projectId, (prev) => ({
            ...prev,
            isStreaming: false,
            error: event.message
          }))
        }

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const drained = drainSseBuffer(buffer)
          buffer = drained.remaining
          drained.events.forEach(processEvent)
        }

        buffer += decoder.decode()
        if (buffer.trim()) {
          parseSseEventBlock(buffer).forEach(processEvent)
        }

        if (!streamFinished) {
          finalizeMessage()
          setState(projectId, (prev) => ({ ...prev, isStreaming: false }))
        }
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError'

        if (isAbort) {
          removeMessage(modelMessage.id)
          setState(projectId, (prev) => ({
            ...prev,
            isStreaming: false,
            error: null
          }))
          return
        }

        const messageText = error instanceof Error ? error.message : t('errors.unknown')

        removeMessage(modelMessage.id)
        setState(projectId, (prev) => ({
          ...prev,
          isStreaming: false,
          error: messageText
        }))
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [
      i18n.language,
      i18n.resolvedLanguage,
      page,
      projectId,
      removeMessage,
      setState,
      state.isStreaming,
      state.messages,
      t,
      updateMessage
    ]
  )

  return useMemo(
    () => ({
      messages: state.messages,
      isStreaming: state.isStreaming,
      error: state.error,
      send,
      stop,
      clear,
      cooldownUntil: state.lastSentAt + CHAT_SEND_COOLDOWN_MS
    }),
    [clear, send, state.error, state.isStreaming, state.lastSentAt, state.messages, stop]
  )
}
