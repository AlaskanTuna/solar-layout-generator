import { useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Hand, Keyboard, Move, MousePointerClick, X, ZoomIn } from 'lucide-react'

const IDLE_MS = 10000
const PERMANENT_DISMISS_KEY = 'solarsim.workbench.hintDismissed'

function readPermanentDismiss(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PERMANENT_DISMISS_KEY) === 'true'
  } catch {
    return false
  }
}

function writePermanentDismiss(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERMANENT_DISMISS_KEY, 'true')
  } catch {
    // Storage unavailable (private mode, quota); fail silently — the user just sees the overlay again next session.
  }
}

type Props = {
  /** Container element whose activity drives the idle timer. */
  targetRef: RefObject<HTMLDivElement | null>
  /** Only start the timer once the canvas is interactive. */
  ready: boolean
  /** When true, force-hide the overlay and pause the timer (e.g. while another modal owns the screen). */
  suppressed?: boolean
}

/** Centered idle-hint overlay that teaches first-time users how to interact with the canvas. */
export function WorkbenchHintOverlay({ targetRef, ready, suppressed = false }: Props) {
  const { t } = useTranslation('workbench')
  const [visible, setVisible] = useState(false)
  const [permanentlyDismissed, setPermanentlyDismissed] = useState<boolean>(() => readPermanentDismiss())
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const visibleRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  useEffect(() => {
    if (suppressed && visible) setVisible(false)
  }, [suppressed, visible])

  useEffect(() => {
    if (!ready || suppressed || permanentlyDismissed) return
    const target = targetRef.current
    if (!target) return

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const scheduleShow = () => {
      clearTimer()
      timerRef.current = window.setTimeout(() => setVisible(true), IDLE_MS)
    }

    // Pointer movement only resets the idle countdown; it never hides a visible overlay,
    // so a stray cursor twitch can't close it before the user reads it.
    const onMove = () => {
      scheduleShow()
    }

    // Explicit interaction (click, scroll, key) hides if visible, then restarts the countdown
    // so the overlay reappears after another idle window.
    const onAction = () => {
      if (visibleRef.current) setVisible(false)
      scheduleShow()
    }

    scheduleShow()

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerdown', onAction)
    target.addEventListener('wheel', onAction, { passive: true })
    window.addEventListener('keydown', onAction)

    return () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerdown', onAction)
      target.removeEventListener('wheel', onAction)
      window.removeEventListener('keydown', onAction)
      clearTimer()
    }
  }, [ready, suppressed, permanentlyDismissed, targetRef])

  const dismiss = () => {
    if (dontShowAgain) {
      writePermanentDismiss()
      setPermanentlyDismissed(true)
    }
    setVisible(false)
  }

  if (!visible) return null

  const tips = [
    { icon: <MousePointerClick className="h-4 w-4" />, text: t('hint.click') },
    { icon: <Move className="h-4 w-4" />, text: t('hint.drag') },
    { icon: <ZoomIn className="h-4 w-4" />, text: t('hint.zoom') },
    { icon: <Hand className="h-4 w-4" />, text: t('hint.pan') }
  ]

  return (
    <>
      <div
        onClick={dismiss}
        className="absolute inset-0 z-30 animate-fade-in cursor-pointer rounded-2xl bg-black/20 backdrop-blur-md"
      />
      <div
        role="dialog"
        aria-label={t('hint.title')}
        className="glass-card absolute left-1/2 top-1/2 z-30 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 animate-fade-in px-6 py-5 shadow-xl"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('hint.dismiss')}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 pr-6">
          <Keyboard className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-base font-semibold">{t('hint.title')}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('hint.subtitle')}</p>
        <ul className="mt-4 space-y-2.5">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {tip.icon}
              </div>
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground select-none">
          <span
            role="checkbox"
            tabIndex={0}
            aria-checked={dontShowAgain}
            onClick={() => setDontShowAgain((v) => !v)}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                setDontShowAgain((v) => !v)
              }
            }}
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              dontShowAgain
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:border-primary/60'
            }`}
          >
            {dontShowAgain && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span onClick={() => setDontShowAgain((v) => !v)}>{t('hint.dontShowAgain')}</span>
        </label>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/80">{t('hint.dismissCta')}</p>
      </div>
    </>
  )
}
