import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
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
          {isUser || message.error ? (
            // User input is plain text; error bodies are localised plain strings.
            // Both are rendered without markdown to avoid surprises.
            message.content
          ) : (
            // Model output may contain markdown (lists, bold, code spans, etc.).
            // Tailwind classes on each component keep the rendering compact and
            // on-brand inside the muted bubble. No external "prose" class needed.
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="m-0 whitespace-pre-wrap [&:not(:first-child)]:mt-2">{children}</p>,
                ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
                li: ({ children }) => <li className="m-0">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                  <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="my-2 overflow-x-auto rounded-md bg-foreground/10 p-2 font-mono text-xs">{children}</pre>
                ),
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {children}
                  </a>
                ),
                h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-semibold">{children}</h1>,
                h2: ({ children }) => <h2 className="mt-2 mb-1 text-base font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
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
                className="rounded-full border border-border bg-background/60 px-3 py-1 text-left text-xs text-foreground/80 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-background hover:text-foreground hover:shadow-md"
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
