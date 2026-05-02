import { useCallback, useContext, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatContext, type ChatMessage } from '@/components/chat/ChatProvider'
import { getSupabase } from '@/lib/supabase'

const SUGGESTIONS_MARKER = '\n<<<SUGGESTIONS>>>\n'

type ChatPage = 'workbench' | 'analysis'
type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; category: string; message: string }

type SendPhase = 'message' | 'suggestions'

type UseChatReturn = {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  send: (message: string) => Promise<void>
  stop: () => void
  clear: () => void
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

/** Streams project-grounded chatbot responses over SSE-over-POST. */
export function useChat(projectId: string, page: ChatPage): UseChatReturn {
  const { t, i18n } = useTranslation('chat')
  const { getState, setState, reset } = useContext(ChatContext)
  const abortRef = useRef<AbortController | null>(null)
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
        messages: [...prev.messages, userMessage, modelMessage]
      }))

      const controller = new AbortController()
      abortRef.current = controller

      let phase: SendPhase = 'message'
      let suggestionsBuffer = ''
      let streamFinished = false

      try {
        const supabase = getSupabase()
        const {
          data: { session }
        } = await supabase.auth.getSession()

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }

        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }

        const response = await fetch(`/api/projects/${projectId}/chat`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            message,
            history,
            language: normaliseLanguage(i18n.resolvedLanguage ?? i18n.language),
            page
          })
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
          updateMessage(modelMessage.id, (current) => {
            if (phase === 'suggestions') {
              suggestionsBuffer += text
              return current
            }

            const combined = current.content + text
            const markerIndex = combined.indexOf(SUGGESTIONS_MARKER)
            if (markerIndex === -1) {
              return { ...current, content: combined }
            }

            phase = 'suggestions'
            suggestionsBuffer = combined.slice(markerIndex + SUGGESTIONS_MARKER.length)
            return { ...current, content: combined.slice(0, markerIndex) }
          })
        }

        const finalizeMessage = (category?: string, messageText?: string) => {
          streamFinished = true
          updateMessage(modelMessage.id, (current) => {
            let suggestions = current.suggestions

            if (phase === 'suggestions' && suggestionsBuffer.trim()) {
              try {
                const parsed = JSON.parse(suggestionsBuffer.trim())
                if (Array.isArray(parsed)) {
                  suggestions = parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, 4)
                }
              } catch (error) {
                console.warn('[Chat] Failed to parse suggestions JSON', error, suggestionsBuffer)
              }
            }

            return {
              ...current,
              content: category && messageText ? messageText : current.content,
              streaming: false,
              suggestions,
              error: category && messageText ? { category, message: messageText } : current.error
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

          while (buffer.includes('\n\n')) {
            const separatorIndex = buffer.indexOf('\n\n')
            const rawEvent = buffer.slice(0, separatorIndex)
            buffer = buffer.slice(separatorIndex + 2)

            for (const line of rawEvent.split('\n')) {
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (!payload) continue
              processEvent(JSON.parse(payload) as ChatEvent)
            }
          }
        }

        buffer += decoder.decode()

        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload) continue
            processEvent(JSON.parse(payload) as ChatEvent)
          }
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
      clear
    }),
    [clear, send, state.error, state.isStreaming, state.messages, stop]
  )
}
