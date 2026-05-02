import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type SuggestedQuestionsProps = {
  page: 'workbench' | 'analysis'
  onPick: (suggestion: string) => void
  paybackYears?: number | null
}

/** Renders page-aware empty-state prompt chips that fill the composer without auto-sending. */
export function SuggestedQuestions({ page, onPick, paybackYears }: SuggestedQuestionsProps) {
  const { t } = useTranslation('chat')

  const suggestions = useMemo(() => {
    if (page === 'analysis') {
      return [
        t('suggestions.analysis.0', { years: paybackYears ?? 'unknown' }),
        t('suggestions.analysis.1'),
        t('suggestions.analysis.2'),
        t('suggestions.analysis.3')
      ]
    }

    return [
      t('suggestions.workbench.0'),
      t('suggestions.workbench.1'),
      t('suggestions.workbench.2'),
      t('suggestions.workbench.3')
    ]
  }, [page, paybackYears, t])

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-background"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
