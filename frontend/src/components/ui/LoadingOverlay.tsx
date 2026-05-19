/**
 * Full-screen blocking loading overlay.
 *
 * Used while heavy server work is in flight (Solar API resolution, batch
 * flux recompute, PDF export). Cycles through a rotating set of "hint"
 * strings every 3 seconds so the user feels something is happening even
 * during longer waits.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** Default hint rotation shown when the caller doesn't supply its own. */
const DEFAULT_HINTS = ['Loading your solar analysis...', 'Crunching the numbers...', 'Preparing your results...']

/**
 * Renders a centred spinner and a fading hint line over a blurred backdrop.
 *
 * @param hints - Override the rotating hint strings (e.g. context-specific
 *   messages on the workbench save flow)
 */
export function LoadingOverlay({ hints = DEFAULT_HINTS }: { hints?: string[] }) {
  const [hintIndex, setHintIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    if (hints.length <= 1) return
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setHintIndex((i) => (i + 1) % hints.length)
        setFade(true)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [hints])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p
          className={`text-sm text-muted-foreground transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}
        >
          {hints[hintIndex]}
        </p>
      </div>
    </div>
  )
}
