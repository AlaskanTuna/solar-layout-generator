/**
 * Project-scoped AI chat panel for solar layout and analysis assistance.
 * Used from the floating launcher to stream answers grounded in project data and current unsaved UI state.
 */

import { useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Send, Square, X } from 'lucide-react'
import { CHAT_SEND_COOLDOWN_MS, ChatContext } from './ChatProvider'
import { MessageBubble } from './MessageBubble'
import { SuggestedQuestions } from './SuggestedQuestions'
import { useChat, type ChatLiveState } from '@/hooks/useChat'
import type { ProjectResponse } from '@/api/projects'
import { Button } from '@/components/ui/button'

type ChatPanelProps = {
  projectId: string
  page: 'workbench' | 'analysis'
  /** Optional callback returning the page's unsaved live state for chat grounding. */
  liveStateProvider?: () => ChatLiveState | undefined
}

function getPaybackYears(project: ProjectResponse | undefined): number | null | undefined {
  return project?.analysisResults?.paybackYears
}

/**
 * Renders the slide-out chat interface with message history, suggestions, cooldown, and streaming controls.
 * Expects a project id, page context, and optional live-state provider used when sending prompts.
 */
export function ChatPanel({ projectId, page, liveStateProvider }: ChatPanelProps) {
  const { t } = useTranslation('chat')
  const queryClient = useQueryClient()
  const { setState } = useContext(ChatContext)
  const { messages, isStreaming, error, send, stop, clear, cooldownUntil } = useChat(projectId, page, liveStateProvider)
  const [draft, setDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Re-render every 250ms while a cooldown window is active so the countdown
  // text and the disabled/enabled send button stay live without a wider state change.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (Date.now() >= cooldownUntil) return
    const interval = window.setInterval(() => {
      forceTick((n) => n + 1)
      if (Date.now() >= cooldownUntil) window.clearInterval(interval)
    }, 250)
    return () => window.clearInterval(interval)
  }, [cooldownUntil])

  const paybackYears = getPaybackYears(queryClient.getQueryData<ProjectResponse>(['project', projectId]))

  const cooldownRemainingMs = Math.max(0, cooldownUntil - Date.now())
  const cooldownActive = cooldownRemainingMs > 0
  const canSend = draft.trim().length > 0 && !isStreaming && !cooldownActive
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000)

  const handleSuggestionPick = (suggestion: string) => {
    if (isStreaming || cooldownActive) {
      // Fall back to filling the composer if the user can't actually send right now —
      // their click is preserved and they can hit Send themselves once the gate lifts.
      setDraft(suggestion)
      composerRef.current?.focus()
      return
    }
    setDraft('')
    void send(suggestion)
  }

  useEffect(() => {
    composerRef.current?.focus()
  }, [])

  useEffect(() => {
    const textarea = composerRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight || '24')
    textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * 6)}px`
  }, [draft])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, error])

  const closePanel = () => {
    setState(projectId, (prev) => ({
      ...prev,
      isOpen: false
    }))
  }

  const handleReset = () => {
    clear()
    setState(projectId, (prev) => ({
      ...prev,
      isOpen: true
    }))
  }

  const handleSend = async () => {
    const message = draft.trim()
    if (!message) return
    setDraft('')
    await send(message)
  }

  const handleComposerKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePanel()
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) {
        await handleSend()
      }
    }
  }

  const emptyState = (
    <div className="space-y-4 rounded-2xl border border-dashed border-border/80 bg-background/30 px-4 py-5">
      <h3 className="font-heading text-base font-semibold text-foreground">{t('panel.empty')}</h3>
      <SuggestedQuestions page={page} paybackYears={paybackYears} onPick={handleSuggestionPick} />
    </div>
  )

  return (
    <div
      role="dialog"
      aria-label={t('panel.title')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          closePanel()
        }
      }}
      className="fixed inset-x-2 bottom-2 top-12 z-40 flex flex-col rounded-2xl glass-card sm:inset-x-auto sm:left-auto sm:right-6 sm:top-auto sm:h-[640px] sm:max-h-[80vh] sm:w-[380px] sm:bottom-6"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">{t('panel.title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('panel.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button type="button" variant="ghost" size="icon" onClick={handleReset} aria-label={t('panel.reset')}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={closePanel} aria-label={t('panel.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          emptyState
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onSuggestionPick={handleSuggestionPick} />
            ))}
            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border/70 px-4 py-4">
        <div className="rounded-2xl border border-border bg-background/70 px-3 py-3 shadow-sm transition-colors focus-within:border-primary/40">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
            onKeyDown={(event) => void handleComposerKeyDown(event)}
            placeholder={t('composer.placeholder')}
            rows={1}
            data-chat-composer="true"
            className="max-h-36 min-h-6 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {cooldownActive ? t('composer.cooldown', { seconds: cooldownSeconds }) : `${draft.length}/4000`}
            </span>
            {isStreaming ? (
              <Button type="button" size="sm" onClick={stop}>
                <Square className="h-4 w-4" />
                {t('composer.stop')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSend()}
                disabled={!canSend}
                title={cooldownActive ? t('composer.cooldown', { seconds: cooldownSeconds }) : undefined}
              >
                <Send className="h-4 w-4" />
                {t('composer.send')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
