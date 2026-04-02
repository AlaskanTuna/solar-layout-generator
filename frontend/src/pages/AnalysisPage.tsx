import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import html2pdf from 'html2pdf.js'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { notify } from '@/components/ui/toast-config'
import { getLocationData } from '@/api/locations'
import { getProject, saveAnalysis } from '@/api/projects'
import { getTariffConfig } from '@/api/tariff'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ANALYSIS_DISCLAIMERS,
  DEFAULT_INSTALLATION_MULTIPLIER,
  MONTH_LABELS,
  aggregateMonthlyGeneration,
  applySeasonalProfile,
  buildAnalysisResults,
  buildThresholdWarnings,
  computeDegradedSavings,
  parseSavedAnalysisConfig,
  SEASONAL_MULTIPLIERS,
  type AnalysisConfig,
  type AnalysisResultsRecord,
  type ConnectionPhase,
  type ConsumptionProfile
} from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { runAnnualSimulation } from '@/lib/billingEngine'
import { InfoTooltip } from '@/components/InfoTooltip'
import { AppLayout } from '@/components/AppLayout'
import tnbBillImg from '@/assets/tnb-bill-avg-kwh.png'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ImagePopup } from '@/components/ImagePopup'
import { GuidedTour, type TourStep } from '@/components/GuidedTour'
import { getPanelModel, PANEL_MODELS, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import { formatCurrency, formatNumber, formatTooltipCurrency } from '@/components/analysis/formatters'
import { HeroMetrics } from '@/components/analysis/HeroMetrics'
import { BillComparisonChart } from '@/components/analysis/BillComparisonChart'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import { NetBenefitChart } from '@/components/analysis/NetBenefitChart'
import { BillBreakdown } from '@/components/analysis/BillBreakdown'
import { MonthTable } from '@/components/analysis/MonthTable'
import { SystemAssumptions } from '@/components/analysis/SystemAssumptions'
import { SortableCardContainer } from '@/components/analysis/SortableCardContainer'
import SimplePdfReport from '@/components/analysis/SimplePdfReport'
import AdvancedPdfReport from '@/components/analysis/AdvancedPdfReport'

type AnalysisFormState = Omit<AnalysisConfig, 'systemKwp'>

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function buildPdfFileName(projectName: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `Solar_Analysis_${sanitizeFileName(projectName) || 'Project'}_${date}.pdf`
}

const ANALYSIS_TOUR_STEPS: TourStep[] = [
  {
    title: 'Your Solar Savings Analysis',
    description:
      'This page calculates how much you could save on your TNB electricity bill with solar panels. All numbers update live as you change the inputs on the left.'
  },
  {
    target: '[data-tour="consumption-input"]',
    title: 'Enter Your Electricity Usage',
    description:
      'This is the most important input. Find your average monthly kWh on your TNB bill (look for "Purata Penggunaan") and enter it here. Tap the info icon to see an example bill.'
  },
  {
    target: '[data-tour="view-toggle"]',
    title: 'Simple vs Advanced',
    description:
      'Start with Simple view for a quick summary. Switch to Advanced when you want detailed tariff breakdowns, bill components, and system assumptions you can customise.'
  },
  {
    target: '[data-tour="hero-cards"]',
    title: 'Key Numbers at a Glance',
    description:
      "These four cards tell you everything you need to know: how much you save each month, how much per year, how long until the system pays for itself, and how much CO2 you're offsetting."
  },
  {
    target: '[data-tour="monthly-chart"]',
    title: 'Monthly Bill Comparison',
    description:
      "This chart compares what you'd pay without solar (orange) to what you'd pay with solar (green) for each month. The difference is your savings."
  },
  {
    target: '[data-tour="export-pdf"]',
    title: 'Export & Save',
    description:
      'When you\'re happy with the results, click "Save Analysis" to store your settings, or "Export PDF" to download a report you can share with solar installers or your family.'
  }
]

/** Controlled text input for degradation rate that preserves intermediate states like "0." */
function DegradationInput({ value, onChange }: { value: number; onChange: (rate: number) => void }) {
  const [text, setText] = useState(() => (value === 0 ? '' : String(Math.round(value * 10000) / 100)))
  const [focused, setFocused] = useState(false)

  // Sync external value changes when not focused
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
        // Prevent multiple dots
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

function buildChartData(simulation: ReturnType<typeof runAnnualSimulation>) {
  let cumulativeSavings = 0

  return simulation.months.map((month, index) => {
    cumulativeSavings += month.savingsRm

    return {
      month: MONTH_LABELS[index],
      baselineBill: month.baselineBill.total,
      nemBill: month.nemBill.total,
      cumulativeSavings: Math.round(cumulativeSavings * 100) / 100
    }
  })
}

function buildSavePayload(formState: AnalysisFormState, systemKwp: number, analysisResults: AnalysisResultsRecord) {
  return {
    analysisConfig: {
      ...formState,
      systemKwp
    } satisfies AnalysisConfig,
    analysisResults
  }
}

export function AnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reportRef = useRef<HTMLDivElement>(null)
  const simpleReportRef = useRef<HTMLDivElement>(null)
  const initializedProjectIdRef = useRef<string | null>(null)

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [formState, setFormState] = useState<AnalysisFormState | null>(null)
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple')
  const [monthTableOpen, setMonthTableOpen] = useState(false)

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId
  })

  const tariffQuery = useQuery({
    queryKey: ['tariffConfig'],
    queryFn: getTariffConfig
  })

  const locationId = projectQuery.data?.locationId
  const locationQuery = useQuery({
    queryKey: ['locationData', locationId],
    queryFn: () => getLocationData(locationId!),
    enabled: !!locationId
  })

  const buildingInsights = useMemo(
    () => (locationQuery.data ? parseBuildingInsights(locationQuery.data.buildingInsights) : null),
    [locationQuery.data]
  )
  const activePanels = useMemo(
    () => parsePanelEdits(projectQuery.data?.editedLayout).filter((panel) => panel.status !== 'deleted'),
    [projectQuery.data?.editedLayout]
  )
  const panelsMissingMonthlyEnergy = useMemo(
    () => activePanels.filter((panel) => panel.monthlyEnergyDcKwh.length !== 12),
    [activePanels]
  )
  const monthlyGeneration = useMemo(() => aggregateMonthlyGeneration(activePanels), [activePanels])
  const savedPanelModelId = useMemo(() => {
    // Check analysisConfig first (set during layout save)
    const cfg = projectQuery.data?.analysisConfig
    if (cfg && typeof cfg === 'object' && 'selectedPanelModelId' in cfg) {
      const id = (cfg as Record<string, unknown>).selectedPanelModelId
      if (typeof id === 'string') return id
    }
    // Fallback: if project has been through the workbench at all, use default model
    if (projectQuery.data?.status === 'layout_saved' || projectQuery.data?.status === 'analysis_saved') {
      return DEFAULT_PANEL_MODEL_ID
    }
    return undefined
  }, [projectQuery.data?.analysisConfig, projectQuery.data?.status])
  const selectedPanelModel = savedPanelModelId ? getPanelModel(savedPanelModelId) : undefined
  const panelCapacityWatts = selectedPanelModel?.capacityWp ?? buildingInsights?.solarPotential.panelCapacityWatts ?? 0
  const systemKwp = useMemo(
    () => Math.round(((activePanels.length * panelCapacityWatts) / 1000) * 100) / 100,
    [activePanels.length, panelCapacityWatts]
  )
  const carbonOffsetFactorKgPerMwh = buildingInsights?.solarPotential.carbonOffsetFactorKgPerMwh ?? 0

  useEffect(() => {
    if (projectQuery.data?.status === 'draft' && projectId) {
      navigate(`/project/${projectId}/workbench`, { replace: true })
    }
  }, [navigate, projectId, projectQuery.data?.status])

  useEffect(() => {
    if (!projectId || !projectQuery.data || !tariffQuery.data || !buildingInsights) return
    if (initializedProjectIdRef.current === projectId) return

    const savedConfig = parseSavedAnalysisConfig(projectQuery.data.analysisConfig)
    const localPanels = parsePanelEdits(projectQuery.data.editedLayout).filter((p) => p.status !== 'deleted')
    const localPanelCapacity = selectedPanelModel?.capacityWp ?? buildingInsights.solarPotential.panelCapacityWatts ?? 0
    const localSystemKwp = Math.round(((localPanels.length * localPanelCapacity) / 1000) * 100) / 100

    // Compute system cost from selected panel model if available, otherwise fall back to tariff default.
    // costPerWp is panel module cost only; multiply by installation multiplier to get turnkey cost
    // (covers inverter, mounting, wiring, labour, permitting).
    let defaultSystemCostRm: number
    if (selectedPanelModel && selectedPanelModel.costPerWp > 0) {
      defaultSystemCostRm = Math.round(
        localPanels.length *
          selectedPanelModel.capacityWp *
          selectedPanelModel.costPerWp *
          DEFAULT_INSTALLATION_MULTIPLIER
      )
    } else {
      defaultSystemCostRm = Math.round(localSystemKwp * tariffQuery.data.defaults.systemCostPerKwp)
    }

    // If the saved cost matches the old panel-only formula (without installation multiplier),
    // the user never manually edited it — recalculate with the corrected multiplier.
    let resolvedSystemCostRm = savedConfig?.systemCostRm ?? defaultSystemCostRm
    if (savedConfig?.systemCostRm != null && selectedPanelModel && selectedPanelModel.costPerWp > 0) {
      const oldPanelOnlyCost = Math.round(
        localPanels.length * selectedPanelModel.capacityWp * selectedPanelModel.costPerWp
      )
      if (savedConfig.systemCostRm === oldPanelOnlyCost) {
        resolvedSystemCostRm = defaultSystemCostRm
      }
    }

    setFormState({
      monthlyConsumptionKwh: savedConfig?.monthlyConsumptionKwh ?? 600,
      connectionPhase: savedConfig?.connectionPhase ?? 'single',
      systemCostRm: resolvedSystemCostRm,
      afaRateSenPerKwh: savedConfig?.afaRateSenPerKwh ?? tariffQuery.data.afaRateDefault,
      degradationRate: savedConfig?.degradationRate ?? 0.005,
      consumptionProfile: savedConfig?.consumptionProfile ?? 'flat',
      performanceRatio: savedConfig?.performanceRatio ?? 0.8,
      assumedLosses: savedConfig?.assumedLosses ?? 0.2,
      dcAcRatio: savedConfig?.dcAcRatio ?? 1.2
    })
    initializedProjectIdRef.current = projectId
  }, [projectId, projectQuery.data, tariffQuery.data, buildingInsights, selectedPanelModel])

  const billingConfig = useMemo(() => {
    if (!tariffQuery.data || !formState) return null

    return {
      rates: tariffQuery.data.rates,
      thresholds: tariffQuery.data.thresholds,
      eeiTable: tariffQuery.data.eeiTable,
      afaRate: formState.afaRateSenPerKwh
    }
  }, [tariffQuery.data, formState])

  const monthlyConsumption = useMemo(() => {
    if (!formState) return formState
    return formState.consumptionProfile === 'seasonal'
      ? applySeasonalProfile(formState.monthlyConsumptionKwh)
      : formState.monthlyConsumptionKwh
  }, [formState])

  const simulation = useMemo(() => {
    if (!formState || !billingConfig || monthlyConsumption == null) return null
    return runAnnualSimulation(monthlyConsumption, monthlyGeneration, billingConfig)
  }, [billingConfig, formState, monthlyConsumption, monthlyGeneration])

  const analysisResults = useMemo(() => {
    if (!simulation || !formState) return null

    return buildAnalysisResults({
      simulation,
      systemCostRm: formState.systemCostRm,
      carbonOffsetFactorKgPerMwh,
      activePanelCount: activePanels.length,
      degradationRate: formState.degradationRate
    })
  }, [activePanels.length, carbonOffsetFactorKgPerMwh, formState, simulation])

  const chartData = useMemo(() => (simulation ? buildChartData(simulation) : []), [simulation])
  const selectedMonth = useMemo(() => simulation?.months[selectedMonthIndex] ?? null, [simulation, selectedMonthIndex])
  const thresholdWarnings = useMemo(() => {
    if (!selectedMonth || !tariffQuery.data) return []
    return buildThresholdWarnings(selectedMonth, tariffQuery.data.thresholds)
  }, [selectedMonth, tariffQuery.data])

  const phaseCapacityCapKw = useMemo(() => {
    if (!tariffQuery.data || !formState) return 0
    return formState.connectionPhase === 'single'
      ? tariffQuery.data.defaults.nemCapSinglePhaseKw
      : tariffQuery.data.defaults.nemCapThreePhaseKw
  }, [tariffQuery.data, formState])

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildSavePayload>) => saveAnalysis(projectId!, payload),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(['project', projectId], updatedProject)
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      notify.success('Analysis saved to your project')
      navigate('/dashboard')
    },
    onError: (error) => {
      notify.error(error instanceof Error ? error.message : 'Failed to save the analysis')
    }
  })

  async function handleSaveAnalysis() {
    if (!formState || !analysisResults) return
    await saveMutation.mutateAsync(buildSavePayload(formState, systemKwp, analysisResults))
  }

  async function handleExportPdf() {
    const element = viewMode === 'simple' ? simpleReportRef.current : reportRef.current
    if (!element || !projectQuery.data) return

    setIsExporting(true)
    try {
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: buildPdfFileName(projectQuery.data.name),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(element)
        .save()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to export the PDF report')
    } finally {
      setIsExporting(false)
    }
  }

  if (projectQuery.isLoading || tariffQuery.isLoading || locationQuery.isLoading || !formState || !buildingInsights) {
    return (
      <LoadingOverlay
        hints={[
          'Loading your analysis...',
          'Preparing tariff data...',
          'Crunching the numbers for your solar savings...'
        ]}
      />
    )
  }

  if (
    projectQuery.error ||
    tariffQuery.error ||
    locationQuery.error ||
    !simulation ||
    !analysisResults ||
    !projectQuery.data
  ) {
    const error =
      projectQuery.error ??
      tariffQuery.error ??
      locationQuery.error ??
      new Error('The analysis data is incomplete. Return to the workbench and save the layout again.')

    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Analysis Unavailable</CardTitle>
            <CardDescription>We couldn&apos;t prepare the billing simulation for this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button asChild variant="outline" size="sm" className="w-full justify-center gap-2">
              <Link to={`/project/${projectId}/workbench`}>Back to Workbench</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const paybackTooltip = `How many years until your savings cover the cost of installing the system.\n\nNet benefit projections:\n1-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 1) - formState.systemCostRm)}\n5-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 5) - formState.systemCostRm)}\n10-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 10) - formState.systemCostRm)}`

  return (
    <AppLayout>
      <GuidedTour storageKey="slg-tour-analysis" steps={ANALYSIS_TOUR_STEPS} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 xl:h-[calc(100vh-3.5rem)] xl:flex-row">
        {/* ───── Sidebar ───── */}
        <aside className="xl:overflow-y-auto xl:w-[24rem] xl:min-w-[24rem]">
          <Card className="border-border bg-card/92 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{projectQuery.data.name}</CardTitle>
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
                  <p className="mt-1 text-lg font-semibold">{activePanels.length}</p>
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
                  {panelsMissingMonthlyEnergy.length} panel(s) are missing monthly recompute data. They are treated as 0
                  kWh until the layout is saved again from the Workbench.
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
                        <p>
                          Your average monthly electricity usage in kWh. Look for "Purata Penggunaan" on your TNB bill:
                        </p>
                        <ImagePopup
                          src={tnbBillImg}
                          alt="TNB bill showing average kWh usage"
                          className="w-full rounded"
                        />
                        <p className="text-[10px] text-muted-foreground">Click image to enlarge</p>
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
                          ? `Estimated turnkey cost: ${activePanels.length} panels × ${selectedPanelModel.capacityWp} Wp × RM ${selectedPanelModel.costPerWp.toFixed(2)}/Wp × ${DEFAULT_INSTALLATION_MULTIPLIER.toFixed(1)} (installation multiplier) = RM ${Math.round(activePanels.length * selectedPanelModel.capacityWp * selectedPanelModel.costPerWp * DEFAULT_INSTALLATION_MULTIPLIER).toLocaleString()}. The ${DEFAULT_INSTALLATION_MULTIPLIER.toFixed(1)}× multiplier accounts for inverter, mounting hardware, wiring, labour, and permitting — typical for Malaysian residential installations. Adjust to match your actual installer quote.`
                          : 'Total estimated installation cost based on average Malaysian turnkey pricing. Adjust to match your actual installer quote.'
                      }
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Used for payback and 10-year net benefit calculations.
                  </p>
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
                              setFormState((c) =>
                                c ? { ...c, performanceRatio: v / 100, assumedLosses: 1 - v / 100 } : c
                              )
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
                  onClick={handleExportPdf}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting PDF...' : 'Export PDF'}
                </Button>
                <Button onClick={() => void handleSaveAnalysis()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving Analysis...' : 'Save Analysis'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* ───── Main content ───── */}
        <section className="min-w-0 flex-1 space-y-6 xl:overflow-y-auto">
          <div data-tour="view-toggle" className="inline-flex rounded-lg border border-border bg-card/90 p-1 shadow-sm">
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'simple' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'advanced' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('advanced')}
            >
              Advanced
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Simple shows key savings figures. Advanced adds tariff breakdowns, projections, and system details.
          </p>

          <SortableCardContainer
            cards={[
              {
                id: 'hero-metrics',
                node: <HeroMetrics analysisResults={analysisResults} paybackTooltip={paybackTooltip} />
              },
              {
                id: 'bill-comparison',
                node: <BillComparisonChart chartData={chartData} />
              },
              ...(viewMode === 'advanced'
                ? [
                    {
                      id: 'cumulative-savings',
                      node: (
                        <Card className="border-border bg-card/90 shadow-sm">
                          <CardHeader>
                            <CardTitle>
                              Cumulative Savings
                              <InfoTooltip text="Shows your running total of savings throughout the year. The steeper the line, the faster you're saving money from solar." />
                            </CardTitle>
                            <CardDescription>Total savings accumulated month by month over the year.</CardDescription>
                          </CardHeader>
                          <CardContent className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis width={70} tickFormatter={(value) => `RM${value}`} />
                                <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                                <Line
                                  type="monotone"
                                  dataKey="cumulativeSavings"
                                  name="Cumulative Savings"
                                  stroke="#ca8a04"
                                  strokeWidth={3}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )
                    },
                    {
                      id: 'net-benefit',
                      node: (
                        <NetBenefitChart
                          year1Savings={simulation.totalSavingsRm}
                          degradationRate={formState.degradationRate}
                          systemCostRm={formState.systemCostRm}
                        />
                      )
                    },
                    {
                      id: 'financial-roadmap',
                      node: (
                        <FinancialRoadmap
                          systemCostRm={formState.systemCostRm}
                          paybackYears={analysisResults.paybackYears}
                          year1Savings={simulation.totalSavingsRm}
                          degradationRate={formState.degradationRate}
                          systemKwp={systemKwp}
                        />
                      )
                    },
                    ...(buildingInsights
                      ? [
                          {
                            id: 'system-assumptions',
                            node: (
                              <SystemAssumptions
                                performanceRatio={formState.performanceRatio}
                                assumedLosses={formState.assumedLosses}
                                degradationRate={formState.degradationRate}
                                dcAcRatio={formState.dcAcRatio}
                                panelLifetimeYears={buildingInsights.solarPotential.panelLifetimeYears}
                                roofSegmentStats={buildingInsights.solarPotential.roofSegmentStats}
                              />
                            )
                          }
                        ]
                      : []),
                    ...(selectedMonth
                      ? [
                          {
                            id: 'bill-breakdown',
                            node: (
                              <BillBreakdown
                                selectedMonthIndex={selectedMonthIndex}
                                onMonthSelect={setSelectedMonthIndex}
                                selectedMonth={selectedMonth}
                                thresholdWarnings={thresholdWarnings}
                              />
                            )
                          }
                        ]
                      : []),
                    {
                      id: 'month-table',
                      node: (
                        <MonthTable
                          simulation={simulation}
                          isOpen={monthTableOpen}
                          onToggle={() => setMonthTableOpen((prev) => !prev)}
                        />
                      )
                    }
                  ]
                : []),
              {
                id: 'disclaimers',
                node: (
                  <Card className="border-border bg-card/90 shadow-sm">
                    <CardHeader>
                      <CardTitle>Financial Disclaimers</CardTitle>
                      <CardDescription>All bill and savings figures should be treated as estimates.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      {ANALYSIS_DISCLAIMERS.map((disclaimer) => (
                        <p key={disclaimer}>{disclaimer}</p>
                      ))}
                    </CardContent>
                  </Card>
                )
              }
            ]}
          />
        </section>
      </div>

      <SimplePdfReport
        ref={simpleReportRef}
        projectName={projectQuery.data.name}
        analysisResults={analysisResults}
        simulation={simulation}
        activePanelCount={activePanels.length}
        systemKwp={systemKwp}
        systemCostRm={formState.systemCostRm}
      />

      <AdvancedPdfReport
        ref={reportRef}
        projectName={projectQuery.data.name}
        analysisResults={analysisResults}
        simulation={simulation}
        chartData={chartData}
        activePanelCount={activePanels.length}
        systemKwp={systemKwp}
        selectedPanelModel={selectedPanelModel}
        formState={formState}
        location={projectQuery.data.location}
      />
    </AppLayout>
  )
}
