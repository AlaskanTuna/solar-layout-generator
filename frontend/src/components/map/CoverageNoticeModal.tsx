import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Home, MapPin, Satellite } from 'lucide-react'

const COVERAGE_DISMISS_KEY = 'solarsim.map.coverageNoticeDismissed'

export function readCoverageNoticeDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(COVERAGE_DISMISS_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCoverageNoticeDismissed(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COVERAGE_DISMISS_KEY, 'true')
  } catch {
    // Storage unavailable; fail silently — modal reappears next session.
  }
}

type Props = {
  open: boolean
  onClose: () => void
}

/** Educates the user on which Malaysian regions have HIGH-resolution Solar API coverage. */
export function CoverageNoticeModal({ open, onClose }: Props) {
  const { t } = useTranslation('map')
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const dismiss = () => {
    if (dontShowAgain) writeCoverageNoticeDismissed()
    onClose()
  }

  const regions = t('coverageModal.regions', { returnObjects: true }) as Array<{ name: string; cities: string }>

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Satellite className="h-5 w-5" />
          </div>
          <DialogTitle>{t('coverageModal.title')}</DialogTitle>
          <DialogDescription>{t('coverageModal.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('coverageModal.highTitle')}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {Array.isArray(regions) &&
                regions.map((region) => (
                  <li key={region.name} className="flex items-start gap-2 text-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      <span className="font-medium">{region.name}</span>
                      <span className="text-muted-foreground"> — {region.cities}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t('coverageModal.baseTitle')}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('coverageModal.baseDescription')}</p>
          </div>

          <div className="rounded-lg border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-500/20 dark:bg-sky-500/5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              <Home className="h-3.5 w-3.5" />
              {t('coverageModal.buildingTypeTitle')}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('coverageModal.buildingTypeDescription')}</p>
          </div>
        </div>

        <DialogFooter className="flex !flex-row items-center !justify-between gap-2 sm:!justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
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
            <span onClick={() => setDontShowAgain((v) => !v)}>{t('coverageModal.dontShowAgain')}</span>
          </label>
          <Button size="sm" onClick={dismiss} className="sm:min-w-[100px]">
            {t('coverageModal.gotIt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
