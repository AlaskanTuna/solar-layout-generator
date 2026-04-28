import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import {
  BILL_RANGE_TO_KWH_PER_MONTH,
  type BillRange,
  type LayoutPreferences,
  type RoofDirection,
  type SizingGoal
} from '@shared/types'
import tnbBillImg from '@/assets/tnb-bill-avg-kwh.png'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/DropdownMenu'
import { ImagePopup } from '@/components/ui/ImagePopup'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function billLabel(value: BillRange, base: string): string {
  if (value === 'unknown') return base
  return `${base} (~${BILL_RANGE_TO_KWH_PER_MONTH[value]} kWh)`
}

type Goal = Exclude<SizingGoal, 'custom'>

type LayoutPresetModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefs: LayoutPreferences | null
  onSave: (next: LayoutPreferences) => void
  onSkip: () => void
}

/**
 * Renders the layoutpreset modal
 * @param {LayoutPresetModalProps} props - Props for the component
 */
export function LayoutPresetModal({ open, onOpenChange, prefs, onSave, onSkip }: LayoutPresetModalProps) {
  const { t } = useTranslation('workbench')

  const BILL_OPTIONS: { value: BillRange; label: string }[] = [
    { value: '<100', label: billLabel('<100', t('layoutPresetModal.monthlyBill.options.lessThan100')) },
    { value: '100-200', label: billLabel('100-200', t('layoutPresetModal.monthlyBill.options.100to200')) },
    { value: '200-400', label: billLabel('200-400', t('layoutPresetModal.monthlyBill.options.200to400')) },
    { value: '400-600', label: billLabel('400-600', t('layoutPresetModal.monthlyBill.options.400to600')) },
    { value: '600+', label: billLabel('600+', t('layoutPresetModal.monthlyBill.options.600plus')) },
    { value: 'unknown', label: billLabel('unknown', t('layoutPresetModal.monthlyBill.options.notSure')) }
  ]

  const ROOF_DIRECTION_OPTIONS: { value: RoofDirection; label: string }[] = [
    { value: 'any', label: t('layoutPresetModal.roofDirection.options.any') },
    { value: 'south', label: t('layoutPresetModal.roofDirection.options.south') },
    { value: 'east', label: t('layoutPresetModal.roofDirection.options.east') },
    { value: 'west', label: t('layoutPresetModal.roofDirection.options.west') },
    { value: 'north', label: t('layoutPresetModal.roofDirection.options.north') }
  ]

  const SIZING_OPTIONS: { value: Goal; title: string; description: string }[] = [
    {
      value: 'conservative',
      title: t('layoutPresetModal.sizingGoal.options.conservative.title'),
      description: t('layoutPresetModal.sizingGoal.options.conservative.description')
    },
    {
      value: 'balanced',
      title: t('layoutPresetModal.sizingGoal.options.balanced.title'),
      description: t('layoutPresetModal.sizingGoal.options.balanced.description')
    },
    {
      value: 'maximum',
      title: t('layoutPresetModal.sizingGoal.options.maximum.title'),
      description: t('layoutPresetModal.sizingGoal.options.maximum.description')
    }
  ]

  const labelForBill = (v: BillRange) =>
    BILL_OPTIONS.find((o) => o.value === v)?.label ?? t('layoutPresetModal.monthlyBill.options.notSure')
  const labelForDirection = (v: RoofDirection) =>
    ROOF_DIRECTION_OPTIONS.find((o) => o.value === v)?.label ?? t('layoutPresetModal.roofDirection.options.any')

  const [billRange, setBillRange] = useState<BillRange>('unknown')
  const [sizingGoal, setSizingGoal] = useState<Goal>('balanced')
  const [roofDirection, setRoofDirection] = useState<RoofDirection>('any')
  const [billImageOpen, setBillImageOpen] = useState(false)

  // Radix Dialog's backdrop swallows pointerleave, so the tooltip can stay pinned open after the image popup closes
  // Force open={false} on dismiss, then release to uncontrolled on the next frame so hover can resume normally
  const [tooltipOpen, setTooltipOpen] = useState<boolean | undefined>(undefined)
  const releaseTimerRef = useRef<number | null>(null)

  const handleBillImageOpenChange = useCallback((next: boolean) => {
    setBillImageOpen(next)
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
    if (next) {
      setTooltipOpen(true)
    } else {
      setTooltipOpen(false)
      releaseTimerRef.current = window.setTimeout(() => {
        setTooltipOpen(undefined)
        releaseTimerRef.current = null
      }, 0)
    }
  }, [])

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (!open) return
    setBillRange(prefs?.billRange ?? 'unknown')
    const initialGoal = prefs?.sizingGoal && prefs.sizingGoal !== 'custom' ? prefs.sizingGoal : 'balanced'
    setSizingGoal(initialGoal)
    setRoofDirection(prefs?.roofDirection ?? 'any')
    // Reset tooltip state every time the modal reopens.
    setBillImageOpen(false)
    setTooltipOpen(undefined)
  }, [open, prefs])

  function handleSave() {
    onSave({
      billRange,
      sizingGoal,
      roofDirection,
      dismissedAt: new Date().toISOString()
    })
    onOpenChange(false)
  }

  function handleSkip() {
    onSkip()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('layoutPresetModal.title')}</DialogTitle>
          <DialogDescription>
            {t('layoutPresetModal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              {t('layoutPresetModal.monthlyBill.label')}
              <InfoTooltip open={tooltipOpen}>
                <div className="space-y-1.5">
                  <p>
                    {t('layoutPresetModal.monthlyBill.tooltip')}
                  </p>
                  <ImagePopup
                    src={tnbBillImg}
                    alt={t('layoutPresetModal.monthlyBill.tnbBillAlt')}
                    className="w-full rounded"
                    onOpenChange={handleBillImageOpenChange}
                  />
                  <p className="text-[10px]">{t('layoutPresetModal.monthlyBill.clickToEnlarge')}</p>
                </div>
              </InfoTooltip>
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between gap-2 font-normal">
                  {labelForBill(billRange)}
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuRadioGroup value={billRange} onValueChange={(v) => setBillRange(v as BillRange)}>
                  {BILL_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              {t('layoutPresetModal.roofDirection.label')}
              <InfoTooltip text={t('layoutPresetModal.roofDirection.tooltip')} />
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between gap-2 font-normal">
                  {labelForDirection(roofDirection)}
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuRadioGroup
                  value={roofDirection}
                  onValueChange={(v) => setRoofDirection(v as RoofDirection)}
                >
                  {ROOF_DIRECTION_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              {t('layoutPresetModal.sizingGoal.label')}
              <InfoTooltip text={t('layoutPresetModal.sizingGoal.tooltip')} />
            </Label>
            <div className="grid gap-2">
              {SIZING_OPTIONS.map((opt) => {
                const selected = sizingGoal === opt.value
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setSizingGoal(opt.value)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-foreground/30 hover:bg-muted/50'
                    )}
                    aria-pressed={selected}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{opt.title}</span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-primary bg-primary' : 'border-input'
                        )}
                      >
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleSkip} className="sm:min-w-[100px]">
            {t('layoutPresetModal.actions.skip')}
          </Button>
          <Button type="button" size="sm" onClick={handleSave} className="sm:min-w-[100px]">
            {t('layoutPresetModal.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
