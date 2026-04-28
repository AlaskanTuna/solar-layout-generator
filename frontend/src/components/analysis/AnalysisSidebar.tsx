import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Plus, Sliders, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_ANNUAL_MAINTENANCE_RM,
  DEFAULT_INVERTER_REPLACEMENT,
  SEASONAL_MULTIPLIERS,
  type AnalysisMode,
  type ConnectionPhase,
  type ConsumptionProfile,
  type InverterReplacement
} from '@/lib/analysis'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import tnbBillImg from '@/assets/tnb-bill-avg-kwh.png'
import { ImagePopup } from '@/components/ui/ImagePopup'
import { formatNumber } from '@/components/analysis/formatters'
import { TariffParameterModal } from '@/components/analysis/TariffParameterModal'
import type { AnalysisFormState } from '@/hooks/useAnalysisForm'
import type { ParsedBuildingInsights } from '@/lib/buildingInsights'
import type { PanelModel, RoofType, TariffRates } from '@shared/types'


function DegradationInput({ value, onChange }: { value: number; onChange: (rate: number) => void }) {
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
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '')
        const parts = raw.split('.')
        const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw
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

type AnalysisSidebarProps = {
  projectId: string | undefined
  projectName: string
  systemKwp: number
  activePanelCount: number
  selectedPanelModel: PanelModel | undefined
  buildingInsights: ParsedBuildingInsights
  panelsMissingMonthlyEnergy: unknown[]
  phaseCapacityCapKw: number
  formState: AnalysisFormState
  setFormState: React.Dispatch<React.SetStateAction<AnalysisFormState | null>>
  viewMode: 'simple' | 'advanced'
  isExporting: boolean
  isSaving: boolean
  onExportPdf: () => void
  onSaveAnalysis: () => void
  /** Default TNB RP4 tariff rates from the global tariff config — passed through to the override modal. */
  tariffRatesDefaults: TariffRates
  /** ISO date string indicating when the seeded AFA / tariff rates were last verified. Null when not seeded. */
  tariffEffectiveDate?: string | null
}

export function AnalysisSidebar({
  projectId,
  projectName,
  systemKwp,
  activePanelCount,
  selectedPanelModel,
  buildingInsights,
  panelsMissingMonthlyEnergy,
  phaseCapacityCapKw,
  formState,
  setFormState,
  viewMode,
  isExporting,
  isSaving,
  onExportPdf,
  onSaveAnalysis,
  tariffRatesDefaults,
  tariffEffectiveDate
}: AnalysisSidebarProps) {
  const { t } = useTranslation('analysis')
  const [billImageOpen, setBillImageOpen] = useState(false)
  const [tariffModalOpen, setTariffModalOpen] = useState(false)
  const handleBillImageOpenChange = useCallback((open: boolean) => setBillImageOpen(open), [])
  const tariffOverrideCount = formState.tariffRatesOverride ? Object.keys(formState.tariffRatesOverride).length : 0

  const CONNECTION_PHASE_LABELS: Record<ConnectionPhase, string> = {
    single: t('sidebar.connectionPhase.labels.single'),
    three: t('sidebar.connectionPhase.labels.three')
  }

  const ROOF_TYPE_LABELS: Record<RoofType, string> = {
    tile: t('sidebar.roofType.labels.tile'),
    metal: t('sidebar.roofType.labels.metal'),
    flat: t('sidebar.roofType.labels.flat')
  }

  const ANALYSIS_MODE_LABELS: Record<AnalysisMode, string> = {
    simple: t('sidebar.financialMode.labels.simple'),
    lifecycle: t('sidebar.financialMode.labels.lifecycle')
  }

  return (
    <aside className="xl:overflow-y-auto xl:w-[24rem] xl:min-w-[24rem]">
      <Card className="border-border bg-card/92 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{projectName}</CardTitle>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">
                {t('sidebar.systemSize.label')}
                <InfoTooltip text={t('sidebar.systemSize.tooltip')} />
              </p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">{t('sidebar.activePanels')}</p>
              <p className="mt-1 text-lg font-semibold">{activePanelCount}</p>
            </div>
          </div>
          {selectedPanelModel && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">{t('sidebar.panelModel')}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedPanelModel.name}</p>
            </div>
          )}
          {selectedPanelModel && (
            <details className="rounded-lg border border-border bg-muted/50 text-sm">
              <summary className="cursor-pointer px-3 py-2 font-medium text-foreground select-none">
                {t('sidebar.panelSpecs.summary')}
              </summary>
              <div className="space-y-1 border-t border-border px-3 py-2 text-muted-foreground">
                <p>
                  {t('sidebar.panelSpecs.dimensions')} {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m
                </p>
                <p>{t('sidebar.panelSpecs.capacity')} {selectedPanelModel.capacityWp} Wp</p>
                <p>{t('sidebar.panelSpecs.efficiency')} {(selectedPanelModel.efficiency * 100).toFixed(1)}%</p>
                {selectedPanelModel.costPerWp > 0 && <p>{t('sidebar.panelSpecs.cost')} RM {selectedPanelModel.costPerWp.toFixed(2)} / Wp</p>}
                <p>{t('sidebar.panelSpecs.maxPanels')} {buildingInsights.solarPotential.maxArrayPanelsCount}</p>
                {buildingInsights.solarPotential.panelLifetimeYears != null && (
                  <p>{t('sidebar.panelSpecs.lifespan')} {buildingInsights.solarPotential.panelLifetimeYears} years</p>
                )}
              </div>
            </details>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">{t('sidebar.adjustHint')}</p>
          </div>
          {panelsMissingMonthlyEnergy.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('sidebar.missingEnergy', { count: panelsMissingMonthlyEnergy.length })}
            </div>
          )}

          {systemKwp > phaseCapacityCapKw && phaseCapacityCapKw > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('sidebar.phaseCapExceeded', { cap: phaseCapacityCapKw, phase: formState.connectionPhase })}
            </div>
          )}

          <div data-tour="consumption-input" className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                {t('sidebar.consumption.label')}
                <InfoTooltip open={billImageOpen || undefined}>
                  <div className="space-y-1.5">
                    <p>{t('sidebar.consumption.tooltipText')}</p>
                    <ImagePopup
                      src={tnbBillImg}
                      alt={t('sidebar.consumption.imageAlt')}
                      className="w-full rounded"
                      onOpenChange={handleBillImageOpenChange}
                    />
                    <p className="text-[10px]">{t('sidebar.consumption.imageHint')}</p>
                  </div>
                </InfoTooltip>
              </Label>
              <p className="text-xs text-muted-foreground">{t('sidebar.consumption.subtext')}</p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t('sidebar.consumption.placeholder')}
              value={formState.monthlyConsumptionKwh === 0 ? '' : String(formState.monthlyConsumptionKwh)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9]/g, '')
                setFormState((current) =>
                  current ? { ...current, monthlyConsumptionKwh: raw === '' ? 0 : Number(raw) } : current
                )
              }}
            />
            <div className="mt-2 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{t('sidebar.consumption.profileLabel')}</Label>
              <div className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'flat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() =>
                    setFormState((c) => (c ? { ...c, consumptionProfile: 'flat' as ConsumptionProfile } : c))
                  }
                >
                  {t('sidebar.consumption.profileFlat')}
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'seasonal' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() =>
                    setFormState((c) => (c ? { ...c, consumptionProfile: 'seasonal' as ConsumptionProfile } : c))
                  }
                >
                  {t('sidebar.consumption.profileSeasonal')}
                </button>
              </div>
              <InfoTooltip text={t('sidebar.consumption.profileTooltip')} />
            </div>
            {formState.consumptionProfile === 'seasonal' && (
              <p className="text-xs text-muted-foreground">
                {t('sidebar.consumption.seasonalRange', {
                  min: Math.round(formState.monthlyConsumptionKwh * Math.min(...SEASONAL_MULTIPLIERS)),
                  max: Math.round(formState.monthlyConsumptionKwh * Math.max(...SEASONAL_MULTIPLIERS))
                })}
              </p>
            )}
          </div>

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
                  {CONNECTION_PHASE_LABELS[formState.connectionPhase]}
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuRadioGroup
                  value={formState.connectionPhase}
                  onValueChange={(v) =>
                    setFormState((current) =>
                      current ? { ...current, connectionPhase: v as ConnectionPhase } : current
                    )
                  }
                >
                  {(Object.keys(CONNECTION_PHASE_LABELS) as ConnectionPhase[]).map((phase) => (
                    <DropdownMenuRadioItem key={phase} value={phase}>
                      {CONNECTION_PHASE_LABELS[phase]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {viewMode === 'advanced' && (
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
                    {ROOF_TYPE_LABELS[formState.roofType]}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuRadioGroup
                    value={formState.roofType}
                    onValueChange={(v) =>
                      setFormState((current) => (current ? { ...current, roofType: v as RoofType } : current))
                    }
                  >
                    {(Object.keys(ROOF_TYPE_LABELS) as RoofType[]).map((roof) => (
                      <DropdownMenuRadioItem key={roof} value={roof}>
                        {ROOF_TYPE_LABELS[roof]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {viewMode === 'advanced' && (
            <>
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
                      {ANALYSIS_MODE_LABELS[formState.analysisMode ?? 'simple']}
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    <DropdownMenuRadioGroup
                      value={formState.analysisMode ?? 'simple'}
                      onValueChange={(v) =>
                        setFormState((current) => {
                          if (!current) return current
                          const nextMode = v as AnalysisMode
                          if (nextMode !== 'lifecycle') {
                            return { ...current, analysisMode: nextMode }
                          }
                          // Seed sensible defaults the first time the user enters Lifecycle
                          // so the figures actually shift away from the Simple-mode result.
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
                      {(Object.keys(ANALYSIS_MODE_LABELS) as AnalysisMode[]).map((mode) => (
                        <DropdownMenuRadioItem key={mode} value={mode}>
                          {ANALYSIS_MODE_LABELS[mode]}
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
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (v >= 0) setFormState((c) => (c ? { ...c, annualMaintenanceRm: v } : c))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">{t('sidebar.financialMode.inverterReplacements.label')}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() =>
                            setFormState((c) => {
                              if (!c) return c
                              const existing = c.inverterReplacements ?? []
                              const lastYear = existing.length > 0 ? existing[existing.length - 1].year : 0
                              const nextYear = Math.min(25, Math.max(lastYear + 5, DEFAULT_INVERTER_REPLACEMENT.year))
                              const next: InverterReplacement = {
                                year: nextYear,
                                costRm: DEFAULT_INVERTER_REPLACEMENT.costRm
                              }
                              return { ...c, inverterReplacements: [...existing, next] }
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
                            <Label className="text-[10px] text-muted-foreground">{t('sidebar.financialMode.inverterReplacements.costLabel')}</Label>
                            <Input
                              type="number"
                              min={0}
                              step={500}
                              value={replacement.costRm}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                if (v < 0) return
                                setFormState((c) => {
                                  if (!c?.inverterReplacements) return c
                                  const next = [...c.inverterReplacements]
                                  next[index] = { ...next[index], costRm: v }
                                  return { ...c, inverterReplacements: next }
                                })
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">{t('sidebar.financialMode.inverterReplacements.yearLabel')}</Label>
                            <Input
                              type="number"
                              min={1}
                              max={25}
                              step={1}
                              value={replacement.year}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                if (v < 1 || v > 25) return
                                setFormState((c) => {
                                  if (!c?.inverterReplacements) return c
                                  const next = [...c.inverterReplacements]
                                  next[index] = { ...next[index], year: v }
                                  return { ...c, inverterReplacements: next }
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
                              setFormState((c) => {
                                if (!c?.inverterReplacements) return c
                                const next = c.inverterReplacements.filter((_, i) => i !== index)
                                return { ...c, inverterReplacements: next }
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
                              raw === '' || raw === '-'
                                ? 0
                                : Number.isFinite(parsed)
                                  ? parsed
                                  : current.afaRateSenPerKwh
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
                <DegradationInput
                  value={formState.tariffEscalationRate}
                  onChange={(rate) => setFormState((c) => (c ? { ...c, tariffEscalationRate: rate } : c))}
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
                onSave={(next) => setFormState((c) => (c ? { ...c, tariffRatesOverride: next } : c))}
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
                <DegradationInput
                  value={formState.degradationRate}
                  onChange={(rate) => setFormState((c) => (c ? { ...c, degradationRate: rate } : c))}
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
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (v >= 50 && v <= 100)
                          setFormState((c) => (c ? { ...c, performanceRatio: v / 100, assumedLosses: 1 - v / 100 } : c))
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
                      min={1.0}
                      max={2.0}
                      step={0.1}
                      value={formState.dcAcRatio}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (v >= 1.0 && v <= 2.0) setFormState((c) => (c ? { ...c, dcAcRatio: v } : c))
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="grid gap-3">
            <Button variant="outline" size="sm" asChild className="w-full justify-center gap-2">
              <Link to={`/project/${projectId}/workbench`}>{t('sidebar.buttons.backToWorkbench')}</Link>
            </Button>
            <Button
              data-tour="export-pdf"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={onExportPdf}
              disabled={isExporting}
            >
              {isExporting ? t('sidebar.buttons.exporting') : t('sidebar.buttons.exportPdf')}
            </Button>
            <Button onClick={onSaveAnalysis} disabled={isSaving}>
              {isSaving ? t('sidebar.buttons.saving') : t('sidebar.buttons.saveAnalysis')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
