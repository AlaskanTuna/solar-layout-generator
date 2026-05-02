import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type TourStep = {
  target?: string
  title: string
  description: string
  /** Hint for modal placement: 'below' (below target), 'left' (left of target),
   *  'center' (viewport center), 'center-bottom' (bottom center of viewport) */
  placement?: 'below' | 'left' | 'center' | 'center-bottom'
}

function getModalPosition(step: TourStep): { top: number; left: number } | null {
  const { target, placement } = step
  const modalW = 320
  const modalH = 200
  const gap = 12
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Placement-only (no target): center or center-bottom
  if (!target || placement === 'center') {
    return null // will use fixed centering
  }

  if (placement === 'center-bottom') {
    const sidebarW = 64
    return { top: vh - modalH - 80 + window.scrollY, left: sidebarW + (vw - sidebarW - modalW) / 2 }
  }

  const el = document.querySelector(target)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const scrollY = window.scrollY

  if (placement === 'left') {
    const top = rect.top + scrollY + rect.height / 2 - modalH / 2
    const left = Math.max(12, rect.left - modalW - gap)
    return { top, left }
  }

  if (placement === 'below') {
    const top = rect.bottom + scrollY + gap
    let left = rect.left + rect.width / 2 - modalW / 2
    left = Math.max(12, Math.min(left, vw - modalW - 12))
    return { top, left }
  }

  // Default: prefer below, fallback above
  let top: number
  if (rect.bottom + gap + modalH < vh) {
    top = rect.bottom + scrollY + gap
  } else {
    top = rect.top + scrollY - gap - modalH
  }

  let left = rect.left + rect.width / 2 - modalW / 2
  left = Math.max(12, Math.min(left, vw - modalW - 12))

  return { top, left }
}

function GuidedTourModal({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const step = steps[currentStep]

  const updatePosition = useCallback(() => {
    if (step.target && step.placement !== 'center') {
      const el = document.querySelector(step.target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        requestAnimationFrame(() => setPos(getModalPosition(step)))
        return
      }
    }
    setPos(getModalPosition(step))
  }, [step])

  useEffect(() => {
    const timer = setTimeout(updatePosition, 150)
    window.addEventListener('resize', updatePosition)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const style: React.CSSProperties = pos
    ? { position: 'absolute', top: pos.top, left: pos.left }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/10" onClick={onClose} />
      <div className="glass-card z-[61] w-[min(20rem,calc(100vw-2rem))] p-4 shadow-xl" style={style}>
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
          <button
            type="button"
            className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} of {steps.length}
          </span>
          <div className="flex gap-1.5">
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                <ChevronLeft className="h-3 w-3" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="h-7 px-3 text-xs" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setCurrentStep((s) => s + 1)}>
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function GuidedTour({
  storageKey,
  steps,
  onActiveChange
}: {
  storageKey: string
  steps: TourStep[]
  onActiveChange?: (active: boolean) => void
}) {
  const [showTour, setShowTour] = useState(() => !localStorage.getItem(storageKey))

  useEffect(() => {
    onActiveChange?.(showTour)
  }, [showTour, onActiveChange])

  const closeTour = useCallback(() => {
    localStorage.setItem(storageKey, 'true')
    setShowTour(false)
  }, [storageKey])

  const openTour = useCallback(() => {
    setShowTour(true)
  }, [])

  return (
    <>
      {showTour && <GuidedTourModal steps={steps} onClose={closeTour} />}

      <button
        type="button"
        className="fixed bottom-5 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/40 text-foreground shadow-[0_8px_24px_rgba(234,88,12,0.18)] backdrop-blur-xl transition-colors duration-300 hover:bg-white/60 dark:border-white/10 dark:bg-stone-900/55 dark:hover:bg-stone-900/75"
        onClick={openTour}
        title="Show guided tour"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    </>
  )
}
