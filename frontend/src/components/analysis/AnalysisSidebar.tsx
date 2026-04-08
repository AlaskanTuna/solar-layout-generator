import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_INSTALLATION_MULTIPLIER,
  SEASONAL_MULTIPLIERS,
  type ConnectionPhase,
  type ConsumptionProfile
} from '@/lib/analysis'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import tnbBillImg from '@/assets/tnb-bill-avg-kwh.png'
import { ImagePopup } from '@/components/ui/ImagePopup'
import { formatNumber } from '@/components/analysis/formatters'
import type { AnalysisFormState } from '@/hooks/useAnalysisForm'
import type { ParsedBuildingInsights } from '@/lib/buildingInsights'
import type { PanelModel } from '@shared/types'

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
  onSaveAnalysis
}: AnalysisSidebarProps) {
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
                <InfoTooltip text="Kilowatt-peak (kWp) — the maximum power your solar system can produce under ideal sunlight conditions." />
              </p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-muted-foreground">Active Panels</p>
              <p className="mt-1 text-lg font-semibold">{activePanelCount}</p>
            </div>
          </div>
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
                <p>Max panels (API): {buildingInsights.solarPotential.maxArrayPanelsCount}</p>
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
                <InfoTooltip>
                  <div className="space-y-1.5">
                    <p>Your average monthly electricity usage in kWh. Look for "Purata Penggunaan" on your TNB bill:</p>
                    <ImagePopup src={tnbBillImg} alt="TNB bill showing average kWh usage" className="w-full rounded" />
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
              <InfoTooltip text="Flat uses the same kWh every month. Seasonal applies typical Malaysian monthly variation (higher in hot months, lower during monsoon)." />
            </div>
            {formState.consumptionProfile === 'seasonal' && (
              <p className="text-xs text-muted-foreground">
                Monthly range: {Math.round(formState.monthlyConsumptionKwh * Math.min(...SEASONAL_MULTIPLIERS))}–
                {Math.round(formState.monthlyConsumptionKwh * Math.max(...SEASONAL_MULTIPLIERS))} kWh
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                Connection Phase
                <InfoTooltip text="Single phase is standard for most Malaysian homes. Three phase is common for larger properties. This determines the NEM capacity cap." />
              </Label>
              <p className="text-xs text-muted-foreground">
                Capacity cap: {phaseCapacityCapKw || 0} kW for the selected connection type.
              </p>
            </div>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formState.connectionPhase}
              onChange={(event) =>
                setFormState((current) =>
                  current ? { ...current, connectionPhase: event.target.value as ConnectionPhase } : current
                )
              }
            >
              <option value="single">Single Phase</option>
              <option value="three">Three Phase</option>
            </select>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
            <div className="space-y-1">
              <Label>
                System Cost (RM)
                <InfoTooltip
                  text={
                    selectedPanelModel && selectedPanelModel.costPerWp > 0
                      ? `Estimated turnkey cost: ${activePanelCount} panels × ${selectedPanelModel.capacityWp} Wp × RM ${selectedPanelModel.costPerWp.toFixed(2)}/Wp × ${DEFAULT_INSTALLATION_MULTIPLIER.toFixed(1)} (installation multiplier) = RM ${Math.round(activePanelCount * selectedPanelModel.capacityWp * selectedPanelModel.costPerWp * DEFAULT_INSTALLATION_MULTIPLIER).toLocaleString()}. The ${DEFAULT_INSTALLATION_MULTIPLIER.toFixed(1)}× multiplier accounts for inverter, mounting hardware, wiring, labour, and permitting — typical for Malaysian residential installations. Adjust to match your actual installer quote.`
                      : 'Total estimated installation cost based on average Malaysian turnkey pricing. Adjust to match your actual installer quote.'
                  }
                />
              </Label>
              <p className="text-xs text-muted-foreground">Used for payback and 10-year net benefit calculations.</p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 15000"
              value={formState.systemCostRm === 0 ? '' : String(formState.systemCostRm)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9]/g, '')
                setFormState((current) =>
                  current ? { ...current, systemCostRm: raw === '' ? 0 : Number(raw) } : current
                )
              }}
            />
          </div>

          {viewMode === 'advanced' && (
            <>
              <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
                <div className="space-y-1">
                  <Label>
                    AFA Rate
                    <InfoTooltip text="Automatic Fuel Adjustment surcharge (or rebate if negative) in sen/kWh, set periodically by the government." />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Current Automatic Fuel Adjustment in sen/kWh. Negative values represent a rebate.
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

              <div className="my-2 border-t border-border" />

              <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
                <div className="space-y-1">
                  <Label>
                    Panel Degradation
                    <InfoTooltip text="Annual generation decline rate. A higher rate means your panels produce less each year, reducing long-term savings and extending payback. N-type panels: ~0.5%/yr. Older PERC panels: ~0.7%/yr." />
                  </Label>
                  <p className="text-xs text-muted-foreground">%/year — affects payback and 10-year projections</p>
                </div>
                <DegradationInput
                  value={formState.degradationRate}
                  onChange={(rate) => setFormState((c) => (c ? { ...c, degradationRate: rate } : c))}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
                <Label className="text-sm font-semibold text-foreground">
                  System Assumptions
                  <InfoTooltip text="These values affect how the system's real-world output is estimated. Most homeowners can leave these at their defaults." />
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
