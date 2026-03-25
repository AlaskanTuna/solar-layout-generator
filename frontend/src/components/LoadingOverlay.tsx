import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

const DEFAULT_HINTS = [
  'Loading your solar analysis...',
  'Crunching the numbers...',
  'Preparing your results...'
]

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        <p
          className={`text-sm text-stone-500 transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}
        >
          {hints[hintIndex]}
        </p>
      </div>
    </div>
  )
}
