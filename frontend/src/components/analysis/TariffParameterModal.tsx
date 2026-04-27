import { useEffect, useState } from 'react'
import type { TariffRates } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { Label } from '@/components/ui/label'

type TariffField = {
  key: keyof TariffRates
  label: string
  unit: 'sen/kWh' | 'RM/month' | '%'
  description: string
}

const TARIFF_FIELDS: TariffField[] = [
  { key: 'energyLow', label: 'Energy Charge (Low Tier)', unit: 'sen/kWh', description: 'Energy charge for usage at or below 1500 kWh.' },
  { key: 'energyHigh', label: 'Energy Charge (High Tier)', unit: 'sen/kWh', description: 'Energy charge for usage above 1500 kWh.' },
  { key: 'capacity', label: 'Capacity Charge', unit: 'sen/kWh', description: 'TNB capacity component.' },
  { key: 'network', label: 'Network Charge', unit: 'sen/kWh', description: 'Distribution network charge.' },
  { key: 'retailChargeRm', label: 'Retail Charge', unit: 'RM/month', description: 'Flat retail service charge.' },
  { key: 'sstRate', label: 'SST Rate', unit: '%', description: 'Sales & Service Tax (e.g. 0.08 for 8%).' },
  { key: 'reFundRate', label: 'RE Fund Rate', unit: 'sen/kWh', description: 'Renewable Energy Fund levy.' },
  { key: 'minChargeRm', label: 'Minimum Charge', unit: 'RM/month', description: 'Minimum monthly bill.' }
]

type TariffParameterModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Default rates from the global tariff config (TNB RP4 published). */
  defaults: TariffRates
  /** Current per-project overrides (sparse — only changed fields). */
  override: Partial<TariffRates> | undefined
  /** Called with the new override map when user clicks Save. Pass undefined to clear all overrides. */
  onSave: (next: Partial<TariffRates> | undefined) => void
}

function formatDisplay(value: number, unit: TariffField['unit']) {
  if (unit === '%') return (value * 100).toFixed(2)
  return String(value)
}

function parseInputToRate(text: string, unit: TariffField['unit']): number | null {
  const cleaned = text.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const parsed = parseFloat(cleaned)
  if (!Number.isFinite(parsed)) return null
  return unit === '%' ? parsed / 100 : parsed
}

export function TariffParameterModal({ open, onOpenChange, defaults, override, onSave }: TariffParameterModalProps) {
  // Draft state holds per-field text values keyed by tariff key. Initialised from override or default.
  const [draft, setDraft] = useState<Record<string, string>>({})

  // Reseed draft whenever the modal opens, so external state changes are reflected.
  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    for (const field of TARIFF_FIELDS) {
      const effective = override?.[field.key] ?? defaults[field.key]
      next[field.key] = formatDisplay(effective, field.unit)
    }
    setDraft(next)
  }, [open, defaults, override])

  function handleSave() {
    const next: Partial<TariffRates> = {}
    for (const field of TARIFF_FIELDS) {
      const parsed = parseInputToRate(draft[field.key] ?? '', field.unit)
      if (parsed === null) continue
      // Only persist fields that differ from the default (sparse override).
      if (Math.abs(parsed - defaults[field.key]) > 1e-9) {
        next[field.key] = parsed
      }
    }
    onSave(Object.keys(next).length === 0 ? undefined : next)
    onOpenChange(false)
  }

  function handleReset() {
    const next: Record<string, string> = {}
    for (const field of TARIFF_FIELDS) {
      next[field.key] = formatDisplay(defaults[field.key], field.unit)
    }
    setDraft(next)
  }

  const overrideCount = override ? Object.keys(override).length : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>TNB RP4 Tariff Parameters</DialogTitle>
          <DialogDescription>
            Override individual tariff rates for this project only. Changes affect projections immediately and save with
            the analysis. Leave a field at its default to keep using the published TNB RP4 value.
            {overrideCount > 0 ? ` Currently ${overrideCount} field${overrideCount === 1 ? '' : 's'} overridden.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
          {TARIFF_FIELDS.map((field) => {
            const isOverridden =
              override?.[field.key] !== undefined && Math.abs(override[field.key]! - defaults[field.key]) > 1e-9
            return (
              <div key={field.key} className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <span className="inline-flex items-center">
                    {field.label}
                    <InfoTooltip
                      text={`${field.description} Default: ${formatDisplay(defaults[field.key], field.unit)} ${field.unit}.`}
                    />
                  </span>
                  {isOverridden && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Modified
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={draft[field.key] ?? ''}
                    onChange={(e) => setDraft((c) => ({ ...c, [field.key]: e.target.value }))}
                    className="pr-16 text-sm"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    {field.unit}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            Reset to TNB defaults
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
