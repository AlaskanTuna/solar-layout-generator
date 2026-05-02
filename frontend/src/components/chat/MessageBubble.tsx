import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ChatMessage } from './ChatProvider'

type MessageBubbleProps = {
  message: ChatMessage
  onSuggestionPick: (suggestion: string) => void
}

/** Renders one chat message plus any follow-up suggestion chips attached to model responses. */
export function MessageBubble({ message, onSuggestionPick }: MessageBubbleProps) {
  const { t } = useTranslation('chat')
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : message.error
                ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                : 'bg-muted text-foreground'
          )}
        >
          {message.content}
          {message.streaming && (
            <span
              aria-label={t('streaming.cursor')}
              className="ml-1 inline-block h-3 w-2 animate-pulse bg-foreground/40 align-middle"
            />
          )}
        </div>

        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionPick(suggestion)}
                className="rounded-full border border-border bg-background/60 px-3 py-1 text-left text-xs text-foreground/80 transition-colors hover:bg-background"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
