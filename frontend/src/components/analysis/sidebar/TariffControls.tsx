import { useEffect, useState } from 'react'
import { ChevronDown, Sliders } from 'lucide-react'
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
import { TariffParameterModal } from '@/components/analysis/TariffParameterModal'
import type { AnalysisFormState } from '@/hooks/useAnalysisForm'
import type { ConnectionPhase } from '@/lib/analysis'
import type { RoofType, TariffRates } from '@shared/types'

function PercentageInput({ value, onChange }: { value: number; onChange: (rate: number) => void }) {
  const [text, setText] = useState(() => (value === 0 ? '' : String(Math.round(value * 10000) / 100)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value === 0 ? '' : String(Math.round(value * 10000) / 100))
  }, [value, focused])

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="e.g. 0.5"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(text)
        if (text === '' || !Number.isFinite(parsed)) {
          onChange(0)
          setText('')
        } else {
          onChange(parsed / 100)
          setText(String(Math.round((parsed / 100) * 10000) / 100))
        }
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^0-9.]/g, '')
        const parts = raw.split('.')
        const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw
        setText(sanitized)
        const parsed = parseFloat(sanitized)
        if (sanitized === '' || sanitized === '.') {
          onChange(0)
        } else if (Number.isFinite(parsed)) {
          onChange(parsed / 100)
        }
      }}
    />
  )
}

type TariffControlsProps = {
  formState: AnalysisFormState
  setFormState: React.Dispatch<React.SetStateAction<AnalysisFormState | null>>
  viewMode: 'simple' | 'advanced'
  phaseCapacityCapKw: number
  tariffRatesDefaults: TariffRates
  tariffEffectiveDate?: string | null
  lifecycleControls?: React.ReactNode
}

/**
 * Renders the TariffControls component
 * @param {TariffControlsProps} props - Props for the component
 */
export function TariffControls({
  formState,
  setFormState,
  viewMode,
  phaseCapacityCapKw,
  tariffRatesDefaults,
  tariffEffectiveDate,
  lifecycleControls
}: TariffControlsProps) {
  const { t } = useTranslation('analysis')
  const [tariffModalOpen, setTariffModalOpen] = useState(false)
  const tariffOverrideCount = formState.tariffRatesOverride ? Object.keys(formState.tariffRatesOverride).length : 0

  const connectionPhaseLabels: Record<ConnectionPhase, string> = {
    single: t('sidebar.connectionPhase.labels.single'),
    three: t('sidebar.connectionPhase.labels.three')
  }

  const roofTypeLabels: Record<RoofType, string> = {
    tile: t('sidebar.roofType.labels.tile'),
    metal: t('sidebar.roofType.labels.metal'),
    flat: t('sidebar.roofType.labels.flat')
  }

  return (
    <>
      <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
        <div className="space-y-1">
          <Label>
            {t('sidebar.connectionPhase.label')}
            <InfoTooltip>
              <div className="space-y-2">
                <p>{t('sidebar.connectionPhase.tooltip.intro')}</p>
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold">{t('sidebar.connectionPhase.tooltip.single')}</span>{' '}
                    {t('sidebar.connectionPhase.tooltip.singleDetail')}
                  </p>
                  <p>
                    <span className="font-semibold">{t('sidebar.connectionPhase.tooltip.three')}</span>{' '}
                    {t('sidebar.connectionPhase.tooltip.threeDetail')}
                  </p>
                </div>
                <p className="text-primary-foreground/80">{t('sidebar.connectionPhase.tooltip.warning')}</p>
              </div>
            </InfoTooltip>
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('sidebar.connectionPhase.capacityCap', { cap: phaseCapacityCapKw || 0 })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 w-full justify-between px-3 font-normal text-foreground">
              {connectionPhaseLabels[formState.connectionPhase]}
              <ChevronDown className="h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuRadioGroup
              value={formState.connectionPhase}
              onValueChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, connectionPhase: value as ConnectionPhase } : current
                )
              }
            >
              {(Object.keys(connectionPhaseLabels) as ConnectionPhase[]).map((phase) => (
                <DropdownMenuRadioItem key={phase} value={phase}>
                  {connectionPhaseLabels[phase]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {viewMode === 'advanced' && (
        <>
          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                {t('sidebar.roofType.label')}
                <InfoTooltip text={t('sidebar.roofType.tooltip')} />
              </Label>
              <p className="text-xs text-muted-foreground">{t('sidebar.roofType.subtext')}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between px-3 font-normal text-foreground">
                  {roofTypeLabels[formState.roofType]}
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuRadioGroup
                  value={formState.roofType}
                  onValueChange={(value) =>
                    setFormState((current) => (current ? { ...current, roofType: value as RoofType } : current))
                  }
                >
                  {(Object.keys(roofTypeLabels) as RoofType[]).map((roofType) => (
                    <DropdownMenuRadioItem key={roofType} value={roofType}>
                      {roofTypeLabels[roofType]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {lifecycleControls}

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                {t('sidebar.afa.label')}
                <InfoTooltip text={t('sidebar.afa.tooltip')} />
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('sidebar.afa.subtext')}
                {tariffEffectiveDate && (
                  <>
                    {' '}
                    <span className="text-muted-foreground/80">
                      {t('sidebar.afa.seededDate', {
                        date: new Date(tariffEffectiveDate).toLocaleDateString('en-MY', {
                          year: 'numeric',
                          month: 'short'
                        })
                      })}
                    </span>
                  </>
                )}
              </p>
            </div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder={t('sidebar.afa.placeholder')}
              value={formState.afaRateSenPerKwh === 0 ? '' : String(formState.afaRateSenPerKwh)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9.\-]/g, '')
                const parsed = parseFloat(raw)
                setFormState((current) =>
                  current
                    ? {
                        ...current,
                        afaRateSenPerKwh:
                          raw === '' || raw === '-' ? 0 : Number.isFinite(parsed) ? parsed : current.afaRateSenPerKwh
                      }
                    : current
                )
              }}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                {t('sidebar.tariffEscalation.label')}
                <InfoTooltip text={t('sidebar.tariffEscalation.tooltip')} />
              </Label>
              <p className="text-xs text-muted-foreground">{t('sidebar.tariffEscalation.subtext')}</p>
            </div>
            <PercentageInput
              value={formState.tariffEscalationRate}
              onChange={(rate) =>
                setFormState((current) => (current ? { ...current, tariffEscalationRate: rate } : current))
              }
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                {t('sidebar.tariffParameters.label')}
                <InfoTooltip text={t('sidebar.tariffParameters.tooltip')} />
              </Label>
              <p className="text-xs text-muted-foreground">{t('sidebar.tariffParameters.subtext')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between gap-2"
              onClick={() => setTariffModalOpen(true)}
            >
              <span className="inline-flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5" />
                {t('sidebar.tariffParameters.configure')}
              </span>
              {tariffOverrideCount > 0 && (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {t('sidebar.tariffParameters.modified', { count: tariffOverrideCount })}
                </span>
              )}
            </Button>
          </div>

          <TariffParameterModal
            open={tariffModalOpen}
            onOpenChange={setTariffModalOpen}
            defaults={tariffRatesDefaults}
            override={formState.tariffRatesOverride}
            onSave={(next) =>
              setFormState((current) => (current ? { ...current, tariffRatesOverride: next } : current))
            }
          />

          <div className="my-2 border-t border-border" />

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                {t('sidebar.degradation.label')}
                <InfoTooltip text={t('sidebar.degradation.tooltip')} />
              </Label>
              <p className="text-xs text-muted-foreground">{t('sidebar.degradation.subtext')}</p>
            </div>
            <PercentageInput
              value={formState.degradationRate}
              onChange={(rate) =>
                setFormState((current) => (current ? { ...current, degradationRate: rate } : current))
              }
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <Label className="text-sm font-semibold text-foreground">
              {t('sidebar.systemAssumptions.label')}
              <InfoTooltip text={t('sidebar.systemAssumptions.tooltip')} />
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('sidebar.systemAssumptions.pr')}</Label>
                <Input
                  type="number"
                  min={50}
                  max={100}
                  step={1}
                  value={Math.round(formState.performanceRatio * 100)}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (value >= 50 && value <= 100) {
                      setFormState((current) =>
                        current
                          ? { ...current, performanceRatio: value / 100, assumedLosses: 1 - value / 100 }
                          : current
                      )
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('sidebar.systemAssumptions.losses')}</Label>
                <Input
                  type="number"
                  disabled
                  value={Math.round(formState.assumedLosses * 100)}
                  className="bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t('sidebar.systemAssumptions.dcAc')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={2}
                  step={0.1}
                  value={formState.dcAcRatio}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (value >= 1 && value <= 2) {
                      setFormState((current) => (current ? { ...current, dcAcRatio: value } : current))
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
