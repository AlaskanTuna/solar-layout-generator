/**
 * Lifecycle finance controls for advanced analysis mode.
 * Lets users add maintenance, degradation, tariff escalation, and inverter replacement assumptions to RM forecasts.
 */

import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import {
  DEFAULT_ANNUAL_MAINTENANCE_RM,
  DEFAULT_INVERTER_REPLACEMENT,
  type AnalysisMode,
  type InverterReplacement
} from '@/lib/analysis'
import type { AnalysisFormState } from '@/hooks/useAnalysisForm'

type LifecycleControlsProps = {
  formState: AnalysisFormState
  setFormState: React.Dispatch<React.SetStateAction<AnalysisFormState | null>>
}

/**
 * Renders advanced lifecycle inputs for long-term rooftop solar cash-flow modelling.
 * Expects the analysis form state and setter, then normalizes inverter replacement rows.
 */
export function LifecycleControls({ formState, setFormState }: LifecycleControlsProps) {
  const { t } = useTranslation('analysis')

  const analysisModeLabels: Record<AnalysisMode, string> = {
    simple: t('sidebar.financialMode.labels.simple'),
    lifecycle: t('sidebar.financialMode.labels.lifecycle')
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/90 p-4">
      <div className="space-y-1">
        <Label className="text-sm font-semibold text-foreground">
          {t('sidebar.financialMode.label')}
          <InfoTooltip>
            <div className="space-y-2">
              <p>{t('sidebar.financialMode.tooltip.intro')}</p>
              <div className="space-y-1">
                <p>
                  <span className="font-semibold">{t('sidebar.financialMode.tooltip.simple')}</span>{' '}
                  {t('sidebar.financialMode.tooltip.simpleDetail')}
                </p>
                <p>
                  <span className="font-semibold">{t('sidebar.financialMode.tooltip.lifecycle')}</span>{' '}
                  {t('sidebar.financialMode.tooltip.lifecycleDetail')}
                </p>
              </div>
            </div>
          </InfoTooltip>
        </Label>
        <p className="text-xs text-muted-foreground">{t('sidebar.financialMode.subtext')}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-10 w-full justify-between px-3 font-normal text-foreground">
            {analysisModeLabels[formState.analysisMode ?? 'simple']}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          <DropdownMenuRadioGroup
            value={formState.analysisMode ?? 'simple'}
            onValueChange={(value) =>
              setFormState((current) => {
                if (!current) return current

                const nextMode = value as AnalysisMode
                if (nextMode !== 'lifecycle') {
                  return { ...current, analysisMode: nextMode }
                }

                const annualMaintenanceRm =
                  !current.annualMaintenanceRm || current.annualMaintenanceRm <= 0
                    ? DEFAULT_ANNUAL_MAINTENANCE_RM
                    : current.annualMaintenanceRm
                const inverterReplacements =
                  current.inverterReplacements && current.inverterReplacements.length > 0
                    ? current.inverterReplacements
                    : [{ ...DEFAULT_INVERTER_REPLACEMENT }]

                return {
                  ...current,
                  analysisMode: nextMode,
                  annualMaintenanceRm,
                  inverterReplacements
                }
              })
            }
          >
            {(Object.keys(analysisModeLabels) as AnalysisMode[]).map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                {analysisModeLabels[mode]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {formState.analysisMode === 'lifecycle' && (
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">{t('sidebar.financialMode.maintenance.label')}</Label>
            <Input
              type="number"
              min={0}
              step={50}
              value={formState.annualMaintenanceRm ?? 0}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (value >= 0)
                  setFormState((current) => (current ? { ...current, annualMaintenanceRm: value } : current))
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">
                {t('sidebar.financialMode.inverterReplacements.label')}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() =>
                  setFormState((current) => {
                    if (!current) return current

                    const existing = current.inverterReplacements ?? []
                    const lastYear = existing.length > 0 ? existing[existing.length - 1].year : 0
                    const nextYear = Math.min(25, Math.max(lastYear + 5, DEFAULT_INVERTER_REPLACEMENT.year))
                    const nextReplacement: InverterReplacement = {
                      year: nextYear,
                      costRm: DEFAULT_INVERTER_REPLACEMENT.costRm
                    }

                    return { ...current, inverterReplacements: [...existing, nextReplacement] }
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t('sidebar.financialMode.inverterReplacements.add')}
              </Button>
            </div>
            {(formState.inverterReplacements ?? []).length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                {t('sidebar.financialMode.inverterReplacements.empty')}
              </p>
            )}
            {(formState.inverterReplacements ?? []).map((replacement, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t('sidebar.financialMode.inverterReplacements.costLabel')}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    value={replacement.costRm}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (value < 0) return

                      setFormState((current) => {
                        if (!current?.inverterReplacements) return current
                        const next = [...current.inverterReplacements]
                        next[index] = { ...next[index], costRm: value }
                        return { ...current, inverterReplacements: next }
                      })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t('sidebar.financialMode.inverterReplacements.yearLabel')}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={25}
                    step={1}
                    value={replacement.year}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (value < 1 || value > 25) return

                      setFormState((current) => {
                        if (!current?.inverterReplacements) return current
                        const next = [...current.inverterReplacements]
                        next[index] = { ...next[index], year: value }
                        return { ...current, inverterReplacements: next }
                      })
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={t('sidebar.financialMode.inverterReplacements.removeAriaLabel', { index: index + 1 })}
                  onClick={() =>
                    setFormState((current) => {
                      if (!current?.inverterReplacements) return current
                      return {
                        ...current,
                        inverterReplacements: current.inverterReplacements.filter(
                          (_, replacementIndex) => replacementIndex !== index
                        )
                      }
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
