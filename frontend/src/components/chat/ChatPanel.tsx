import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Send, Square, X } from 'lucide-react'
import { ChatContext } from './ChatProvider'
import { MessageBubble } from './MessageBubble'
import { SuggestedQuestions } from './SuggestedQuestions'
import { useChat } from '@/hooks/useChat'
import type { ProjectResponse } from '@/api/projects'
import { Button } from '@/components/ui/button'

type ChatPanelProps = {
  projectId: string
  page: 'workbench' | 'analysis'
}

function getPaybackYears(project: ProjectResponse | undefined): number | null | undefined {
  return project?.analysisResults?.paybackYears
}

/** Glass chat panel with streaming message list, error state, and seeded prompts. */
export function ChatPanel({ projectId, page }: ChatPanelProps) {
  const { t } = useTranslation('chat')
  const queryClient = useQueryClient()
  const { setState } = useContext(ChatContext)
  const { messages, isStreaming, error, send, stop, clear } = useChat(projectId, page)
  const [draft, setDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const paybackYears = getPaybackYears(queryClient.getQueryData<ProjectResponse>(['project', projectId]))

  const canSend = draft.trim().length > 0 && !isStreaming

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

  const emptyState = useMemo(
    () => (
      <div className="space-y-4 rounded-2xl border border-dashed border-border/80 bg-background/30 px-4 py-5">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{t('panel.empty')}</p>
          <p className="text-sm text-muted-foreground">{t('panel.subtitle')}</p>
        </div>
        <SuggestedQuestions page={page} paybackYears={paybackYears} onPick={setDraft} />
      </div>
    ),
    [page, paybackYears, t]
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
              <MessageBubble key={message.id} message={message} onSuggestionPick={setDraft} />
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
        <div className="rounded-2xl border border-border bg-background/70 px-3 py-3 shadow-sm">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
            onKeyDown={(event) => void handleComposerKeyDown(event)}
            placeholder={t('composer.placeholder')}
            rows={1}
            className="max-h-36 min-h-6 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{draft.length}/4000</span>
            {isStreaming ? (
              <Button type="button" size="sm" onClick={stop}>
                <Square className="h-4 w-4" />
                {t('composer.stop')}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => void handleSend()} disabled={!canSend}>
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
