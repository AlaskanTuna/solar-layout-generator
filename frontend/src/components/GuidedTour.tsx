import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type TourStep = {
  target?: string // CSS selector for the element to highlight
  title: string
  description: string
}

function getModalPosition(target: string | undefined) {
  if (!target) return null
  const el = document.querySelector(target)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const scrollY = window.scrollY
  const modalW = 320
  const gap = 12
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Prefer below target; if not enough room, go above
  let top: number
  if (rect.bottom + gap + 200 < vh) {
    top = rect.bottom + scrollY + gap
  } else {
    top = rect.top + scrollY - gap - 200
  }

  // Horizontal: centre on target, clamped to viewport
  let left = rect.left + rect.width / 2 - modalW / 2
  left = Math.max(12, Math.min(left, vw - modalW - 12))

  return { top, left }
}

function GuidedTourModal({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const step = steps[currentStep]

  const updatePosition = useCallback(() => {
    if (step.target) {
      const el = document.querySelector(step.target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        // Small delay to let scroll finish before measuring
        requestAnimationFrame(() => setPos(getModalPosition(step.target)))
        return
      }
    }
    setPos(null)
  }, [step.target])

  useEffect(() => {
    // Delay slightly so scroll settles
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
      {/* Light backdrop — no blur so user can see context */}
      <div className="fixed inset-0 z-[60] bg-black/10" onClick={onClose} />

      {/* Modal */}
      <div className="z-[61] w-80 rounded-xl border border-stone-200 bg-white p-4 shadow-xl" style={style}>
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-stone-900">{step.title}</h3>
          <button
            type="button"
            className="rounded-md p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-stone-600">{step.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-400">
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

export function GuidedTour({ storageKey, steps }: { storageKey: string; steps: TourStep[] }) {
  const [showTour, setShowTour] = useState(() => !localStorage.getItem(storageKey))

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

      {/* Floating ? button */}
      <button
        type="button"
        className="fixed bottom-5 left-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-lg transition-colors hover:bg-stone-50 hover:text-stone-700"
        onClick={openTour}
        title="Show guided tour"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    </>
  )
}
