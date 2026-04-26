import { useCallback, useEffect, useRef, useState } from 'react'
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

const BILL_OPTIONS: { value: BillRange; label: string }[] = [
  { value: '<100', label: billLabel('<100', 'Less than RM 100') },
  { value: '100-200', label: billLabel('100-200', 'RM 100 – 200') },
  { value: '200-400', label: billLabel('200-400', 'RM 200 – 400') },
  { value: '400-600', label: billLabel('400-600', 'RM 400 – 600') },
  { value: '600+', label: billLabel('600+', 'More Than RM 600') },
  { value: 'unknown', label: billLabel('unknown', 'Not Sure') }
]

const ROOF_DIRECTION_OPTIONS: { value: RoofDirection; label: string }[] = [
  { value: 'any', label: 'Best Available (Yield-Sorted)' },
  { value: 'south', label: 'South-Facing' },
  { value: 'east', label: 'East-Facing' },
  { value: 'west', label: 'West-Facing' },
  { value: 'north', label: 'North-Facing' }
]

type Goal = Exclude<SizingGoal, 'custom'>

const SIZING_OPTIONS: { value: Goal; title: string; description: string }[] = [
  {
    value: 'conservative',
    title: 'Economy',
    description: 'Smallest viable system. Lowest upfront cost, longer payback. Good if budget is the priority.'
  },
  {
    value: 'balanced',
    title: 'Self-Consumption',
    description:
      'Sized to match your typical daytime usage. Most cost-efficient, minimizes generation that goes to waste from overnight export.'
  },
  {
    value: 'maximum',
    title: 'Maximum',
    description:
      'Every panel that fits. Largest investment, biggest absolute savings, useful for installers or future-proofing.'
  }
]

const labelForBill = (v: BillRange) => BILL_OPTIONS.find((o) => o.value === v)?.label ?? 'Not Sure'
const labelForDirection = (v: RoofDirection) =>
  ROOF_DIRECTION_OPTIONS.find((o) => o.value === v)?.label ?? 'Best Available (Yield-Sorted)'

type LayoutPresetModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefs: LayoutPreferences | null
  onSave: (next: LayoutPreferences) => void
  onSkip: () => void
}

export function LayoutPresetModal({ open, onOpenChange, prefs, onSave, onSkip }: LayoutPresetModalProps) {
  const [billRange, setBillRange] = useState<BillRange>('unknown')
  const [sizingGoal, setSizingGoal] = useState<Goal>('balanced')
  const [roofDirection, setRoofDirection] = useState<RoofDirection>('any')
  const [billImageOpen, setBillImageOpen] = useState(false)

  // Tooltip open state: undefined = uncontrolled (Radix manages via hover/focus),
  // true = pinned open, false = forced closed.
  //
  // Why this is needed: Radix Dialog applies a body-level pointer-events lock
  // while open. When the user clicks the image, the popup mounts a fixed
  // backdrop above everything; the pointer that was inside the TooltipContent
  // never receives a pointerleave on the trigger because the backdrop swallows
  // every event. After the popup unmounts, Radix Tooltip's internal "open"
  // state has nothing to drive it closed — switching from open={true} to
  // open={undefined} is supposed to hand back to uncontrolled mode, but
  // useControllableState retains the last value, leaving the tooltip pinned
  // open until a fresh pointerleave/blur fires (which never happens because
  // the dialog still owns pointer-events). A key-based remount cleans state
  // but reintroduces immediate hover re-open if the cursor lands on the
  // trigger after close.
  //
  // Fix: drive open={false} explicitly when the popup dismisses (deterministic
  // close), then release to uncontrolled on the next frame so the user can
  // re-hover normally.
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
          <DialogTitle>Layout Preset</DialogTitle>
          <DialogDescription>
            Help us right-size your system. Presets only adjust how many panels are active — they don&apos;t move panel
            positions. Skip to keep the maximum-coverage default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              Monthly Electricity Bill
              <InfoTooltip open={tooltipOpen}>
                <div className="space-y-1.5">
                  <p>
                    Find this on your TNB bill. We translate it to kWh using the average TNB tariff to size your
                    system. Look for "Purata Penggunaan" on your bill:
                  </p>
                  <ImagePopup
                    src={tnbBillImg}
                    alt="TNB bill showing average kWh usage"
                    className="w-full rounded"
                    onOpenChange={handleBillImageOpenChange}
                  />
                  <p className="text-[10px]">Click image to enlarge</p>
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
              Roof Direction
              <InfoTooltip text='Limit panels to a specific roof aspect. "Best Available" places panels on the highest-yield roof faces (typically south for Malaysia).' />
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
              Sizing Goal
              <InfoTooltip text="Economy keeps the system small for fastest budget recovery. Self-Consumption sizes the array to match your typical daytime usage. Maximum fills every available panel slot." />
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
            Skip
          </Button>
          <Button type="button" size="sm" onClick={handleSave} className="sm:min-w-[100px]">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
