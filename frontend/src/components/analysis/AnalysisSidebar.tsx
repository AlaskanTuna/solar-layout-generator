import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
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

const CONNECTION_PHASE_LABELS: Record<ConnectionPhase, string> = {
  single: 'Single Phase',
  three: 'Three Phase'
}

const ROOF_TYPE_LABELS: Record<RoofType, string> = {
  tile: 'Tile (Clay/Concrete)',
  metal: 'Metal',
  flat: 'Flat (Concrete Slab)'
}

const ANALYSIS_MODE_LABELS: Record<AnalysisMode, string> = {
  simple: 'Simple',
  lifecycle: 'Lifecycle'
}

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
  const [billImageOpen, setBillImageOpen] = useState(false)
  const [tariffModalOpen, setTariffModalOpen] = useState(false)
  const handleBillImageOpenChange = useCallback((open: boolean) => setBillImageOpen(open), [])
  const tariffOverrideCount = formState.tariffRatesOverride ? Object.keys(formState.tariffRatesOverride).length : 0

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
                System Size
                <InfoTooltip text="The maximum power your solar system can produce under ideal sunlight, measured in kilowatt-peak (kWp)." />
              </p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">Active Panels</p>
              <p className="mt-1 text-lg font-semibold">{activePanelCount}</p>
            </div>
          </div>
          {selectedPanelModel && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Panel Model</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedPanelModel.name}</p>
            </div>
          )}
          {selectedPanelModel && (
            <details className="rounded-lg border border-border bg-muted/50 text-sm">
              <summary className="cursor-pointer px-3 py-2 font-medium text-foreground select-none">
                Panel Specifications
              </summary>
              <div className="space-y-1 border-t border-border px-3 py-2 text-muted-foreground">
                <p>
                  Dimensions: {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m
                </p>
                <p>Capacity: {selectedPanelModel.capacityWp} Wp</p>
                <p>Efficiency: {(selectedPanelModel.efficiency * 100).toFixed(1)}%</p>
                {selectedPanelModel.costPerWp > 0 && <p>Cost: RM {selectedPanelModel.costPerWp.toFixed(2)} / Wp</p>}
                <p>Max Panels: {buildingInsights.solarPotential.maxArrayPanelsCount}</p>
                {buildingInsights.solarPotential.panelLifetimeYears != null && (
                  <p>Lifespan: {buildingInsights.solarPotential.panelLifetimeYears} years</p>
                )}
              </div>
            </details>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Adjust assumptions and review the NEM billing outcome before saving.
            </p>
          </div>
          {panelsMissingMonthlyEnergy.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {panelsMissingMonthlyEnergy.length} panel(s) are missing monthly recompute data. They are treated as 0 kWh
              until the layout is saved again from the Workbench.
            </div>
          )}

          {systemKwp > phaseCapacityCapKw && phaseCapacityCapKw > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              The current array size exceeds the {phaseCapacityCapKw} kW cap for a {formState.connectionPhase}
              -phase NEM connection.
            </div>
          )}

          <div data-tour="consumption-input" className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                Monthly Electricity Consumption (kWh)
                <InfoTooltip open={billImageOpen || undefined}>
                  <div className="space-y-1.5">
                    <p>Your average monthly electricity usage in kWh. Look for "Purata Penggunaan" on your TNB bill:</p>
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
              <p className="text-xs text-muted-foreground">
                Enter the kWh amount from your TNB bill, not the RM amount.
              </p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 600"
              value={formState.monthlyConsumptionKwh === 0 ? '' : String(formState.monthlyConsumptionKwh)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9]/g, '')
                setFormState((current) =>
                  current ? { ...current, monthlyConsumptionKwh: raw === '' ? 0 : Number(raw) } : current
                )
              }}
            />
            <div className="mt-2 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Profile:</Label>
              <div className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'flat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() =>
                    setFormState((c) => (c ? { ...c, consumptionProfile: 'flat' as ConsumptionProfile } : c))
                  }
                >
                  Flat
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'seasonal' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() =>
                    setFormState((c) => (c ? { ...c, consumptionProfile: 'seasonal' as ConsumptionProfile } : c))
                  }
                >
                  Seasonal
                </button>
              </div>
              <InfoTooltip text="Flat assumes the same kWh every month. Seasonal applies typical Malaysian variation, with higher use in hot months and lower use during the monsoon." />
            </div>
            {formState.consumptionProfile === 'seasonal' && (
              <p className="text-xs text-muted-foreground">
                Monthly range: {Math.round(formState.monthlyConsumptionKwh * Math.min(...SEASONAL_MULTIPLIERS))} to{' '}
                {Math.round(formState.monthlyConsumptionKwh * Math.max(...SEASONAL_MULTIPLIERS))} kWh
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                Connection Phase
                <InfoTooltip>
                  <div className="space-y-2">
                    <p>
                      How electricity enters your home from the grid. You can check this on your TNB bill under "Jenis
                      Fasa" or from the labels on your meter box.
                    </p>
                    <div className="space-y-1">
                      <p>
                        <span className="font-semibold">Single Phase:</span> Standard in most Malaysian homes. Solar
                        export is capped at 5 kW under TNB's NEM 3.0 rules.
                      </p>
                      <p>
                        <span className="font-semibold">Three Phase:</span> Common in larger bungalows or homes with
                        heavy appliances. The cap rises to 12.5 kW.
                      </p>
                    </div>
                    <p className="text-primary-foreground/80">
                      If your array is larger than the cap, you'll need to remove panels on the Workbench or apply to
                      upgrade your TNB connection before installation.
                    </p>
                  </div>
                </InfoTooltip>
              </Label>
              <p className="text-xs text-muted-foreground">
                Capacity cap: {phaseCapacityCapKw || 0} kW for the selected connection type.
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
                  Roof Type
                  <InfoTooltip text="The roof material decides the mounting hardware and labour cost. Tile roofs need scaffolding and special hooks. Metal roofs use simple L-foot clamps. Flat roofs use ballasted frames. Simple view assumes tile, which is most common in Malaysian homes." />
                </Label>
                <p className="text-xs text-muted-foreground">Affects mounting cost and, for tile, scaffolding.</p>
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
                    Financial Mode
                    <InfoTooltip>
                      <div className="space-y-2">
                        <p>Choose how the payback and 25-year savings are calculated.</p>
                        <div className="space-y-1">
                          <p>
                            <span className="font-semibold">Simple:</span> Counts only the upfront installation cost.
                            Gives the cleanest, most optimistic payback figure.
                          </p>
                          <p>
                            <span className="font-semibold">Lifecycle:</span> Also subtracts yearly maintenance and any
                            inverter replacements you schedule. Payback is longer but the 25-year picture is more
                            realistic.
                          </p>
                        </div>
                      </div>
                    </InfoTooltip>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Switch to Lifecycle for a more realistic long-term view.
                  </p>
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
                      <Label className="text-[11px] text-muted-foreground">Annual Maintenance (RM/yr)</Label>
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
                        <Label className="text-[11px] text-muted-foreground">Inverter Replacements</Label>
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
                          Add
                        </Button>
                      </div>
                      {(formState.inverterReplacements ?? []).length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          No replacements scheduled. Click Add to plan one.
                        </p>
                      )}
                      {(formState.inverterReplacements ?? []).map((replacement, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Cost (RM)</Label>
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
                            <Label className="text-[10px] text-muted-foreground">At Year</Label>
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
                            aria-label={`Remove replacement ${index + 1}`}
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
                    AFA Rate
                    <InfoTooltip text="A government-set surcharge or rebate added to every kWh of consumption, in sen/kWh. Negative values mean a rebate. Updated periodically." />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Current Automatic Fuel Adjustment in sen/kWh. Negative values represent a rebate.
                    {tariffEffectiveDate && (
                      <>
                        {' '}
                        <span className="text-muted-foreground/80">
                          Seeded value verified{' '}
                          {new Date(tariffEffectiveDate).toLocaleDateString('en-MY', {
                            year: 'numeric',
                            month: 'short'
                          })}
                          .
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 3.70"
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
                    Tariff Escalation
                    <InfoTooltip text="How much you expect TNB tariffs to rise each year. A higher rate shortens payback and grows long-term savings. RP4 revisions in Malaysia have historically trended around 3 to 5% per year. Set to 0% if you want to assume flat tariffs." />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    %/year. Compounds savings across the projection horizon.
                  </p>
                </div>
                <DegradationInput
                  value={formState.tariffEscalationRate}
                  onChange={(rate) => setFormState((c) => (c ? { ...c, tariffEscalationRate: rate } : c))}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
                <div className="space-y-1">
                  <Label>
                    Tariff Parameters
                    <InfoTooltip text="Override individual TNB RP4 tariff fields for this project, such as energy, capacity, and network charges, retail charge, SST, RE Fund, and minimum charge. Defaults match the published rates." />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Per-project overrides for TNB RP4 base rates. Defaults are the published values.
                  </p>
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
                    Configure Tariff Parameters
                  </span>
                  {tariffOverrideCount > 0 && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {tariffOverrideCount} modified
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
                    Panel Degradation
                    <InfoTooltip text="How much your panels lose in output each year. A higher rate means less generation over time, lower long-term savings, and a longer payback. Modern N-type panels lose around 0.5% per year. Older PERC panels lose around 0.7% per year." />
                  </Label>
                  <p className="text-xs text-muted-foreground">%/year. Affects payback and 10-year projections.</p>
                </div>
                <DegradationInput
                  value={formState.degradationRate}
                  onChange={(rate) => setFormState((c) => (c ? { ...c, degradationRate: rate } : c))}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
                <Label className="text-sm font-semibold text-foreground">
                  System Assumptions
                  <InfoTooltip text="Engineering factors that fine-tune how the real-world output is estimated. Most homeowners can leave these at their defaults." />
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">PR (%)</Label>
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
                    <Label className="text-[11px] text-muted-foreground">Losses (%)</Label>
                    <Input
                      type="number"
                      disabled
                      value={Math.round(formState.assumedLosses * 100)}
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">DC/AC</Label>
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
              <Link to={`/project/${projectId}/workbench`}>Back to Workbench</Link>
            </Button>
            <Button
              data-tour="export-pdf"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={onExportPdf}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting PDF...' : 'Export PDF'}
            </Button>
            <Button onClick={onSaveAnalysis} disabled={isSaving}>
              {isSaving ? 'Saving Analysis...' : 'Save Analysis'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
