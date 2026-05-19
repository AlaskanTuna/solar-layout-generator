/**
 * Starter prompt chips for the contextual project assistant.
 * Used in the chat empty state to nudge users toward workbench or analysis questions.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type SuggestedQuestionsProps = {
  page: 'workbench' | 'analysis'
  onPick: (suggestion: string) => void
  paybackYears?: number | null
}

const KICKOFF_CHIP_COUNT = 4

function samplePool(pool: string[], count: number): string[] {
  if (pool.length <= count) return [...pool]

  const copy = [...pool]
  const selected: string[] = []
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * copy.length)
    selected.push(copy.splice(index, 1)[0])
  }
  return selected
}

/**
 * Renders randomized starter questions and contextual follow-ups for the current project page.
 * Expects page context, a selection callback, and optional payback years for analysis-specific suggestions.
 */
export function SuggestedQuestions({ page, onPick, paybackYears }: SuggestedQuestionsProps) {
  const { t } = useTranslation('chat')

  const suggestions = useMemo(() => {
    const key = page === 'analysis' ? 'suggestions.analysis' : 'suggestions.workbench'
    const pool = t(key, {
      returnObjects: true,
      years: paybackYears ?? 'unknown',
      defaultValue: []
    }) as unknown

    return samplePool(Array.isArray(pool) ? (pool as string[]) : [], KICKOFF_CHIP_COUNT)
  }, [page, paybackYears, t])

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm text-foreground shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-background hover:shadow-md"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
