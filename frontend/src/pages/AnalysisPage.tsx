import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import html2pdf from 'html2pdf.js'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { toast } from 'sonner'
import { getLocationData } from '@/api/locations'
import { getProject, saveAnalysis } from '@/api/projects'
import { getTariffConfig } from '@/api/tariff'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ANALYSIS_DISCLAIMERS,
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
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import tnbBillImg from '@/assets/tnb-bill-avg-kwh.png'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ImagePopup } from '@/components/ImagePopup'
import { GuidedTour, type TourStep } from '@/components/GuidedTour'
import { getPanelModel } from '@shared/types'

const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 2
})

const numberFormatter = new Intl.NumberFormat('en-MY', {
  maximumFractionDigits: 1
})

type AnalysisFormState = Omit<AnalysisConfig, 'systemKwp'>

function formatCurrency(value: number | null) {
  return value === null ? 'N/A' : currencyFormatter.format(value)
}

function formatNumber(value: number | null, unit = '') {
  if (value === null) return 'N/A'
  return `${numberFormatter.format(value)}${unit ? ` ${unit}` : ''}`
}

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

const BILL_TOOLTIPS: Record<string, string> = {
  energy: "The base electricity charge, calculated from your kWh usage at TNB's tiered rates.",
  capacity: 'A fixed charge based on your connection capacity, applied to usage above 600 kWh.',
  network: 'Covers the cost of maintaining the electricity grid that delivers power to your home.',
  retail: 'An additional surcharge applied to usage above 600 kWh.',
  afa: 'Automatic Fuel Adjustment — a government-set surcharge (or rebate) that reflects fuel cost changes.',
  eeiRebate: 'Energy Efficiency Incentive — a rebate that rewards lower electricity consumption.',
  reFund: "Renewable Energy Fund — a 1.6% levy that funds Malaysia's renewable energy development.",
  sst: 'Sales and Service Tax (8%) — applies only when monthly usage exceeds 600 kWh.'
}

const NEM_TOOLTIPS: Record<string, string> = {
  billableKwh: 'Your consumption minus solar generation — this is what TNB actually charges you for.',
  creditUsed: "Excess solar credits from previous months applied to reduce this month's bill.",
  creditBalance: "Unused solar credits carried forward to offset future months' bills.",
  creditForfeited: 'Credits that expired at year-end (December) — NEM credits cannot be carried into the next year.'
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

function azimuthToCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

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

function getRoiCondition(paybackYears: number | null) {
  if (paybackYears === null || paybackYears > 25) {
    return {
      label: 'Poor',
      color: 'text-red-600',
      bgColor: 'bg-red-100 text-red-700',
      description: 'Your system may not pay for itself within its expected lifespan.'
    }
  }
  if (paybackYears > 12) {
    return {
      label: 'Fair',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 text-amber-700',
      description: 'Moderate return. Consider optimizing panel layout or reducing system cost.'
    }
  }
  if (paybackYears > 6) {
    return {
      label: 'Good',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 text-emerald-700',
      description: 'Solid investment with returns within a reasonable timeframe.'
    }
  }
  return {
    label: 'Excellent',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 text-emerald-700',
    description: 'Outstanding return. This system pays for itself quickly.'
  }
}

function formatTooltipCurrency(value: unknown) {
  if (typeof value === 'number') {
    return formatCurrency(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? formatCurrency(parsed) : value
  }

  return 'N/A'
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
    const cfg = projectQuery.data?.analysisConfig
    if (cfg && typeof cfg === 'object' && 'selectedPanelModelId' in cfg) {
      const id = (cfg as Record<string, unknown>).selectedPanelModelId
      return typeof id === 'string' ? id : undefined
    }
    return undefined
  }, [projectQuery.data?.analysisConfig])
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

    // Compute system cost from selected panel model if available, otherwise fall back to tariff default
    let defaultSystemCostRm: number
    if (selectedPanelModel && selectedPanelModel.costPerWp > 0) {
      defaultSystemCostRm = Math.round(
        localPanels.length * selectedPanelModel.capacityWp * selectedPanelModel.costPerWp
      )
    } else {
      defaultSystemCostRm = Math.round(localSystemKwp * tariffQuery.data.defaults.systemCostPerKwp)
    }

    setFormState({
      monthlyConsumptionKwh: savedConfig?.monthlyConsumptionKwh ?? 600,
      connectionPhase: savedConfig?.connectionPhase ?? 'single',
      systemCostRm: savedConfig?.systemCostRm ?? defaultSystemCostRm,
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
      toast.success('Analysis saved to your project')
      navigate('/dashboard')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save the analysis')
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
      toast.error(error instanceof Error ? error.message : 'Failed to export the PDF report')
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
            <Button asChild variant="outline">
              <Link to={`/project/${projectId}/workbench`}>Back to Workbench</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[linear-gradient(180deg,#f7f7f4_0%,#f3efe7_45%,#f7faf7_100%)]">
      <GuidedTour storageKey="slg-tour-analysis" steps={ANALYSIS_TOUR_STEPS} />
      {/* Floating nav — fixed bottom corners */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-between px-4">
        <Link
          to={`/project/${projectId}/workbench`}
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-stone-700 shadow-md backdrop-blur transition-all active:scale-95 hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workbench
        </Link>
        <Link
          to="/dashboard"
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-stone-700 shadow-md backdrop-blur transition-all active:scale-95 hover:bg-stone-50"
        >
          Dashboard
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 pb-6 xl:flex-row">
        <aside className="xl:w-[24rem] xl:min-w-[24rem]">
          <Card className="border-stone-200 bg-white/92 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{projectQuery.data.name}</CardTitle>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">
                    System Size
                    <InfoTooltip text="Kilowatt-peak (kWp) — the maximum power your solar system can produce under ideal sunlight conditions." />
                  </p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
                </div>
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">Active Panels</p>
                  <p className="mt-1 text-lg font-semibold">{activePanels.length}</p>
                </div>
              </div>
              {selectedPanelModel && (
                <details className="rounded-lg border border-stone-200 bg-stone-50/80 text-sm">
                  <summary className="cursor-pointer px-3 py-2 font-medium text-stone-700 select-none">
                    {selectedPanelModel.name} — {selectedPanelModel.capacityWp}Wp
                  </summary>
                  <div className="space-y-1 border-t border-stone-200 px-3 py-2 text-stone-600">
                    <p>
                      Dimensions: {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m
                    </p>
                    <p>Capacity: {selectedPanelModel.capacityWp} Wp</p>
                    <p>Efficiency: {(selectedPanelModel.efficiency * 100).toFixed(1)}%</p>
                    {selectedPanelModel.costPerWp > 0 && <p>Cost: RM {selectedPanelModel.costPerWp.toFixed(2)} / Wp</p>}
                  </div>
                </details>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-t border-stone-200 pt-3">
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

              <div
                data-tour="consumption-input"
                className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4"
              >
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
                        <p className="text-[10px] text-stone-400">Click image to enlarge</p>
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
                  <div className="inline-flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-xs">
                    <button
                      type="button"
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'flat' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                      onClick={() =>
                        setFormState((c) => (c ? { ...c, consumptionProfile: 'flat' as ConsumptionProfile } : c))
                      }
                    >
                      Flat
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'seasonal' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
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

              <div className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4">
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

              <div className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4">
                <div className="space-y-1">
                  <Label>
                    System Cost (RM)
                    <InfoTooltip
                      text={
                        selectedPanelModel && selectedPanelModel.costPerWp > 0
                          ? `Estimated cost based on your layout: ${activePanels.length} panels × ${selectedPanelModel.capacityWp} Wp × RM ${selectedPanelModel.costPerWp.toFixed(2)}/Wp = RM ${Math.round(activePanels.length * selectedPanelModel.capacityWp * selectedPanelModel.costPerWp).toLocaleString()}. Adjust based on actual installer quotes.`
                          : 'Total estimated installation cost. Adjust based on actual installer quotes.'
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
                  <div className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4">
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

                  <div className="my-2 border-t border-stone-200" />

                  <div className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4">
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

                  <div className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4">
                    <Label className="text-sm font-semibold text-stone-700">
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
                          className="bg-stone-50 text-stone-500"
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
                <Button data-tour="export-pdf" variant="outline" onClick={handleExportPdf} disabled={isExporting}>
                  {isExporting ? 'Exporting PDF...' : 'Export PDF'}
                </Button>
                <Button onClick={() => void handleSaveAnalysis()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving Analysis...' : 'Save Analysis'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex-1 space-y-6">
          <div
            data-tour="view-toggle"
            className="inline-flex rounded-lg border border-stone-200 bg-white/90 p-1 shadow-sm"
          >
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'simple' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
              onClick={() => setViewMode('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'advanced' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
              onClick={() => setViewMode('advanced')}
            >
              Advanced
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Simple shows key savings figures. Advanced adds tariff breakdowns, projections, and system details.
          </p>

          <div data-tour="hero-cards" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">
                  Average Monthly Savings
                  <InfoTooltip text="How much less you'd pay each month on average compared to not having solar." />
                </p>
                <p className="text-2xl font-semibold">{formatCurrency(analysisResults.averageMonthlySavingsRm)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(analysisResults.averageMonthlySavingsPct, '%')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">
                  Annual Savings
                  <InfoTooltip text="Total savings across the full year — your bill without solar minus your bill with solar." />
                </p>
                <p className="text-2xl font-semibold">{formatCurrency(analysisResults.annualTotals.totalSavingsRm)}</p>
                <p className="text-sm text-muted-foreground">
                  Baseline {formatCurrency(analysisResults.annualTotals.totalBaselineRm)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">
                  Simple Payback
                  <InfoTooltip
                    text={`How many years until your savings cover the cost of installing the system.\n\nNet benefit projections:\n1-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 1) - formState.systemCostRm)}\n5-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 5) - formState.systemCostRm)}\n10-Year: ${formatCurrency(computeDegradedSavings(simulation.totalSavingsRm, formState.degradationRate, 10) - formState.systemCostRm)}`}
                  />
                </p>
                <p className="text-2xl font-semibold">{formatNumber(analysisResults.paybackYears, 'years')}</p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getRoiCondition(analysisResults.paybackYears).bgColor}`}
                >
                  {getRoiCondition(analysisResults.paybackYears).label}
                </span>
                <p className="text-xs text-muted-foreground">
                  {getRoiCondition(analysisResults.paybackYears).description}
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">
                  CO2 Offset
                  <InfoTooltip text="The amount of carbon dioxide emissions avoided by generating clean solar energy instead of using grid power." />
                </p>
                <p className="text-2xl font-semibold">{formatNumber(analysisResults.carbonOffsetKg, 'kg/year')}</p>
                <p className="text-sm text-muted-foreground">
                  Generation {formatNumber(analysisResults.annualTotals.totalGenerationKwh, 'kWh/year')}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card data-tour="monthly-chart" className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>Monthly Bill Comparison</CardTitle>
                <CardDescription>
                  Your estimated monthly bill without solar (baseline) versus with solar for each month.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `RM${value}`} />
                    <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                    <Legend />
                    <Bar dataKey="baselineBill" name="Without Solar" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nemBill" name="With Solar" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {viewMode === 'advanced' && (
              <Card className="border-stone-200 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle>Cumulative Savings</CardTitle>
                  <CardDescription>Total savings accumulated month by month over the year.</CardDescription>
                </CardHeader>
                <CardContent className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `RM${value}`} />
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
            )}
          </div>

          {viewMode === 'advanced' &&
            (() => {
              const round2 = (v: number) => Math.round(v * 100) / 100
              const year1Savings = simulation.totalSavingsRm
              const dr = formState.degradationRate
              const netBenefitData = Array.from({ length: 10 }, (_, i) => ({
                year: `Yr ${i + 1}`,
                value: round2(computeDegradedSavings(year1Savings, dr, i + 1) - formState.systemCostRm)
              }))
              const tenYearBenefit = netBenefitData[9].value

              return (
                <Card className="border-stone-200 bg-white/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>Net Benefit Projection</CardTitle>
                    <CardDescription>
                      How much you gain (or lose) after subtracting the cost of installing your solar system, year by
                      year.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-stone-50 p-4 text-center">
                      <p className="text-sm text-muted-foreground">10-Year Net Benefit</p>
                      <p
                        className={`text-3xl font-semibold ${tenYearBenefit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                      >
                        {formatCurrency(tenYearBenefit)}
                      </p>
                    </div>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={netBenefitData} margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                          <YAxis
                            tickFormatter={(value) => `RM${value >= 0 ? '' : ''}${value.toLocaleString()}`}
                            width={70}
                          />
                          <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                          <Bar dataKey="value" name="Net Benefit" radius={[4, 4, 0, 0]}>
                            {netBenefitData.map((entry, index) => (
                              <Cell key={index} fill={entry.value >= 0 ? '#15803d' : '#dc2626'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

          {viewMode === 'advanced' && buildingInsights && (
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>System Assumptions</CardTitle>
                <CardDescription>
                  Standard industry assumptions used in this analysis. These are not site-measured values.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PR + Losses side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      Performance Ratio
                      <InfoTooltip text="The percentage of theoretical solar output your system actually delivers, accounting for real-world inefficiencies." />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{Math.round(formState.performanceRatio * 100)}%</p>
                    <p className="text-xs text-stone-400">Typical for Malaysian residential systems</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      Assumed Losses
                      <InfoTooltip text="Energy lost to dust, wiring, inverter conversion, and heat. This is automatically calculated as 100% minus the Performance Ratio." />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{Math.round(formState.assumedLosses * 100)}%</p>
                    <p className="text-xs text-stone-400">Soiling, cable, inverter, temperature</p>
                  </div>
                </div>
                {/* Remaining assumptions */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Panel Degradation</p>
                    <p className="mt-1 text-lg font-semibold">{(formState.degradationRate * 100).toFixed(1)}%/yr</p>
                    <p className="text-xs text-stone-400">Annual output decline (N-type ~0.5%)</p>
                  </div>
                  {buildingInsights.solarPotential.panelLifetimeYears && (
                    <div className="rounded-lg bg-stone-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Panel Lifetime
                        <InfoTooltip text="How long the panels are expected to generate electricity. Payback must happen within this period for the investment to be worthwhile." />
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {buildingInsights.solarPotential.panelLifetimeYears} years
                      </p>
                      <p className="text-xs text-stone-400">From Google Solar API estimate</p>
                    </div>
                  )}
                  {buildingInsights.solarPotential.roofSegmentStats.length > 0 && (
                    <div className="rounded-lg bg-stone-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Roof Azimuth / Pitch
                        <InfoTooltip text="Azimuth is the compass direction your roof faces: 0° = North, 90° = East, 180° = South, 270° = West. In Malaysia, south-facing roofs get the most sunlight. Pitch is how steep your roof is — 0° is flat, 45° is a steep slope." />
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {Math.round(buildingInsights.solarPotential.roofSegmentStats[0].azimuthDegrees)}° (
                        {azimuthToCompass(buildingInsights.solarPotential.roofSegmentStats[0].azimuthDegrees)}) /{' '}
                        {Math.round(buildingInsights.solarPotential.roofSegmentStats[0].pitchDegrees)}°
                      </p>
                      <p className="text-xs text-stone-400">Primary roof segment (from Solar API)</p>
                    </div>
                  )}
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      DC/AC Ratio
                      <InfoTooltip text="The ratio of panel capacity to inverter capacity. A ratio of 1.2 means slightly more panel power than the inverter can handle at peak, which maximises output across the day." />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{formState.dcAcRatio}</p>
                    <p className="text-xs text-stone-400">Standard residential inverter sizing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {viewMode === 'advanced' && (
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Bill Component Breakdown</CardTitle>
                    <CardDescription>
                      See how your TNB bill is calculated — select a month to compare charges with and without solar.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MONTH_LABELS.map((label, index) => (
                      <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant={selectedMonthIndex === index ? 'default' : 'outline'}
                        onClick={() => setSelectedMonthIndex(index)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                {thresholdWarnings.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {thresholdWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
              </CardHeader>
              {selectedMonth && (
                <CardContent className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                    <h3 className="text-sm font-semibold text-stone-900">Without Solar</h3>
                    <p className="text-xs text-stone-400">What you'd pay at full consumption</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-stone-500">
                          Energy <InfoTooltip text={BILL_TOOLTIPS.energy} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.energy)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          Capacity <InfoTooltip text={BILL_TOOLTIPS.capacity} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.capacity)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          Network <InfoTooltip text={BILL_TOOLTIPS.network} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.network)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          Retail <InfoTooltip text={BILL_TOOLTIPS.retail} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.retail)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          AFA <InfoTooltip text={BILL_TOOLTIPS.afa} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.afa)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          EEI Rebate <InfoTooltip text={BILL_TOOLTIPS.eeiRebate} />
                        </p>
                        <p className="font-semibold">-{formatCurrency(selectedMonth.baselineBill.eeiRebate)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          RE Fund <InfoTooltip text={BILL_TOOLTIPS.reFund} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.reFund)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">
                          SST <InfoTooltip text={BILL_TOOLTIPS.sst} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.sst)}</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-stone-200 pt-3">
                      <p className="text-sm text-stone-500">
                        Total
                        <InfoTooltip text="Energy + Capacity + Network + Retail + AFA − EEI Rebate + RE Fund + SST" />
                      </p>
                      <p className="text-xl font-semibold">{formatCurrency(selectedMonth.baselineBill.total)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <h3 className="text-sm font-semibold text-emerald-950">With Solar</h3>
                    <p className="text-xs text-emerald-800/50">Your bill after solar offsets your usage under NEM</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-emerald-900/70">
                          Billable kWh <InfoTooltip text={NEM_TOOLTIPS.billableKwh} />
                        </p>
                        <p className="font-semibold">{formatNumber(selectedMonth.billableKwh, 'kWh')}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Credit Used <InfoTooltip text={NEM_TOOLTIPS.creditUsed} />
                        </p>
                        <p className="font-semibold">{formatNumber(selectedMonth.creditUsed, 'kWh')}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Credit Balance <InfoTooltip text={NEM_TOOLTIPS.creditBalance} />
                        </p>
                        <p className="font-semibold">{formatNumber(selectedMonth.creditBalance, 'kWh')}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Credit Forfeited <InfoTooltip text={NEM_TOOLTIPS.creditForfeited} />
                        </p>
                        <p className="font-semibold">{formatNumber(selectedMonth.creditForfeited, 'kWh')}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Energy <InfoTooltip text={BILL_TOOLTIPS.energy} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.energy)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Retail <InfoTooltip text={BILL_TOOLTIPS.retail} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.retail)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Capacity <InfoTooltip text={BILL_TOOLTIPS.capacity} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.capacity)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          AFA <InfoTooltip text={BILL_TOOLTIPS.afa} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.afa)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          Network <InfoTooltip text={BILL_TOOLTIPS.network} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.network)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          EEI Rebate <InfoTooltip text={BILL_TOOLTIPS.eeiRebate} />
                        </p>
                        <p className="font-semibold">-{formatCurrency(selectedMonth.nemBill.eeiRebate)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          RE Fund <InfoTooltip text={BILL_TOOLTIPS.reFund} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.reFund)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-900/70">
                          SST <InfoTooltip text={BILL_TOOLTIPS.sst} />
                        </p>
                        <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.sst)}</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-emerald-200 pt-3">
                      <p className="text-sm text-emerald-900/70">
                        Total
                        <InfoTooltip
                          text={`${formatCurrency(selectedMonth.baselineBill.total)} (without solar) − ${formatCurrency(selectedMonth.savingsRm)} (savings) = ${formatCurrency(selectedMonth.nemBill.total)}`}
                        />
                      </p>
                      <p className="text-xl font-semibold text-emerald-950">
                        {formatCurrency(selectedMonth.nemBill.total)}
                      </p>
                      <p className="text-xs text-emerald-700">
                        You save {formatCurrency(selectedMonth.savingsRm)} this month
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {viewMode === 'advanced' && (
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>Month-by-Month Breakdown</CardTitle>
                <CardDescription>Detailed billing inputs, credits, and savings for every month.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-stone-900"
                  onClick={() => setMonthTableOpen((prev) => !prev)}
                >
                  {monthTableOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {monthTableOpen ? 'Collapse' : 'Expand'} the full billing table
                </button>
                {monthTableOpen && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-left text-stone-500">
                          <th className="px-3 py-2 font-medium">Month</th>
                          <th className="px-3 py-2 font-medium">Consumption</th>
                          <th className="px-3 py-2 font-medium">Generation</th>
                          <th className="px-3 py-2 font-medium">Net Import</th>
                          <th className="px-3 py-2 font-medium">Credit Used</th>
                          <th className="px-3 py-2 font-medium">Credit Balance</th>
                          <th className="px-3 py-2 font-medium">Baseline Bill</th>
                          <th className="px-3 py-2 font-medium">NEM Savings</th>
                          <th className="px-3 py-2 font-medium">Total Bill</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulation.months.map((month, index) => (
                          <tr key={MONTH_LABELS[index]} className="border-b border-stone-100">
                            <td className="px-3 py-2 font-medium">{MONTH_LABELS[index]}</td>
                            <td className="px-3 py-2">{formatNumber(month.consumptionKwh, 'kWh')}</td>
                            <td className="px-3 py-2">{formatNumber(month.generationKwh, 'kWh')}</td>
                            <td className="px-3 py-2">
                              {formatNumber(month.consumptionKwh - month.generationKwh, 'kWh')}
                            </td>
                            <td className="px-3 py-2">{formatNumber(month.creditUsed, 'kWh')}</td>
                            <td className="px-3 py-2">{formatNumber(month.creditBalance, 'kWh')}</td>
                            <td className="px-3 py-2">{formatCurrency(month.baselineBill.total)}</td>
                            <td className="px-3 py-2 text-emerald-700">{formatCurrency(month.savingsRm)}</td>
                            <td className="px-3 py-2 font-semibold text-emerald-700">
                              {formatCurrency(month.nemBill.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-stone-200 bg-white/90 shadow-sm">
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
        </section>
      </div>

      {/* Simple 1-page PDF report (hidden) */}
      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <div
          ref={simpleReportRef}
          className="w-[210mm] bg-white p-8 text-stone-900"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <h1 className="text-2xl font-bold">Solar Savings Report</h1>
          <p className="mt-1 text-sm text-stone-500">
            {projectQuery.data.name} &middot; Generated {new Date().toLocaleDateString('en-MY')}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm text-stone-600">Monthly Savings</p>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(analysisResults.averageMonthlySavingsRm)}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-sm text-stone-600">Payback Period</p>
              <p className="text-xl font-bold text-amber-700">
                {formatNumber(analysisResults.paybackYears, 'years')}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-sm text-stone-600">CO&#8322; Offset</p>
              <p className="text-xl font-bold text-blue-700">
                {formatNumber(analysisResults.carbonOffsetKg, 'kg/yr')}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-stone-200 p-4">
            <p className="text-sm leading-relaxed">
              By installing <strong>{activePanels.length} solar panels</strong> (
              {formatNumber(systemKwp, 'kWp')} system), you could save approximately{' '}
              <strong>{formatCurrency(analysisResults.averageMonthlySavingsRm)}</strong> per month on your
              electricity bill. The system would pay for itself in approximately{' '}
              <strong>{formatNumber(analysisResults.paybackYears, 'years')}</strong>, after which all savings go
              directly to you. Over 10 years, you could save a total of{' '}
              <strong>{formatCurrency(analysisResults.tenYearNetBenefitRm + formState.systemCostRm)}</strong>.
            </p>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">Monthly Bill Comparison</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-300">
                  <th className="py-2 text-left">Month</th>
                  <th className="py-2 text-right">Without Solar</th>
                  <th className="py-2 text-right">With Solar</th>
                  <th className="py-2 text-right">Savings</th>
                </tr>
              </thead>
              <tbody>
                {simulation.months.map((m, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-1.5">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
                    </td>
                    <td className="py-1.5 text-right">{formatCurrency(m.baselineBill.total)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.nemBill.total)}</td>
                    <td className="py-1.5 text-right text-green-700">{formatCurrency(m.savingsRm)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300 font-semibold">
                  <td className="py-2">Annual Total</td>
                  <td className="py-2 text-right">
                    {formatCurrency(analysisResults.annualTotals.totalBaselineRm)}
                  </td>
                  <td className="py-2 text-right">{formatCurrency(analysisResults.annualTotals.totalNemRm)}</td>
                  <td className="py-2 text-right text-green-700">
                    {formatCurrency(analysisResults.annualTotals.totalSavingsRm)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-6 text-[10px] text-stone-400">
            This is a preliminary estimate based on Google Solar API data and Malaysian NEM Rakyat 3.0 tariff rates.
            Actual savings depend on real electricity usage, installation quality, and tariff changes. Consult a
            licensed solar installer for an accurate quotation.
          </p>
        </div>
      </div>

      {/* Advanced full PDF report (hidden) */}
      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <div ref={reportRef} className="w-[794px] bg-white px-10 py-10 text-stone-900">
          <div className="space-y-8">
            <div className="flex items-start justify-between border-b border-stone-200 pb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-stone-500">Solar Layout Generator</p>
                <h1 className="mt-2 text-3xl font-semibold">{projectQuery.data.name}</h1>
                <p className="mt-2 text-sm text-stone-500">
                  Generated on {new Date().toLocaleDateString('en-MY')} for rooftop solar financial analysis.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Project Status</p>
                <p className="mt-1 text-lg font-semibold">Analysis Ready</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-stone-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">System Summary</p>
                <p className="mt-3 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
                <p className="text-sm text-stone-500">{activePanels.length} active panels</p>
                {selectedPanelModel && (
                  <p className="text-sm text-stone-500">
                    {selectedPanelModel.name} ({selectedPanelModel.capacityWp}Wp)
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-stone-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Financial Highlights</p>
                <p className="mt-3 text-lg font-semibold">
                  {formatCurrency(analysisResults.annualTotals.totalSavingsRm)}
                </p>
                <p className="text-sm text-stone-500">Annual savings</p>
              </div>
              <div className="rounded-2xl bg-stone-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Environmental Impact</p>
                <p className="mt-3 text-lg font-semibold">{formatNumber(analysisResults.carbonOffsetKg, 'kg')}</p>
                <p className="text-sm text-stone-500">Estimated CO2 offset per year</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-2xl border border-stone-200 p-4">
                <h2 className="text-lg font-semibold">Assumptions Used</h2>
                <div className="mt-4 space-y-2 text-sm">
                  {selectedPanelModel && (
                    <p>
                      Panel model: {selectedPanelModel.name} ({selectedPanelModel.capacityWp}Wp,{' '}
                      {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m)
                    </p>
                  )}
                  <p>
                    Monthly consumption: {formatNumber(formState.monthlyConsumptionKwh, 'kWh')} (
                    {formState.consumptionProfile === 'seasonal' ? 'seasonal profile' : 'flat'})
                  </p>
                  <p>Connection phase: {formState.connectionPhase === 'single' ? 'Single phase' : 'Three phase'}</p>
                  <p>System cost: {formatCurrency(formState.systemCostRm)}</p>
                  <p>AFA rate: {formatNumber(formState.afaRateSenPerKwh, 'sen/kWh')}</p>
                  <p>Degradation rate: {(formState.degradationRate * 100).toFixed(1)}%/year</p>
                  <p>
                    Location:{' '}
                    {projectQuery.data.location
                      ? `${projectQuery.data.location.lat}, ${projectQuery.data.location.lng}`
                      : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-stone-200 p-4">
                <h2 className="text-lg font-semibold">Return Snapshot</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <p>Average monthly savings: {formatCurrency(analysisResults.averageMonthlySavingsRm)}</p>
                  <p>Simple payback: {formatNumber(analysisResults.paybackYears, 'years')}</p>
                  <p>10-year net benefit: {formatCurrency(analysisResults.tenYearNetBenefitRm)}</p>
                  <p>10-year ROI: {formatNumber(analysisResults.tenYearRoiPercent, '%')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4">
              <h2 className="text-lg font-semibold">Bill Comparison</h2>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Bar dataKey="baselineBill" fill="#ea580c" />
                    <Bar dataKey="nemBill" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4">
              <h2 className="text-lg font-semibold">Month-by-Month Breakdown</h2>
              <table className="mt-4 min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="px-2 py-2 font-medium">Month</th>
                    <th className="px-2 py-2 font-medium">Consumption</th>
                    <th className="px-2 py-2 font-medium">Generation</th>
                    <th className="px-2 py-2 font-medium">Baseline</th>
                    <th className="px-2 py-2 font-medium">NEM</th>
                    <th className="px-2 py-2 font-medium">Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.months.map((month, index) => (
                    <tr key={`report-${MONTH_LABELS[index]}`} className="border-b border-stone-100">
                      <td className="px-2 py-2">{MONTH_LABELS[index]}</td>
                      <td className="px-2 py-2">{formatNumber(month.consumptionKwh, 'kWh')}</td>
                      <td className="px-2 py-2">{formatNumber(month.generationKwh, 'kWh')}</td>
                      <td className="px-2 py-2">{formatCurrency(month.baselineBill.total)}</td>
                      <td className="px-2 py-2">{formatCurrency(month.nemBill.total)}</td>
                      <td className="px-2 py-2">{formatCurrency(month.savingsRm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4 text-sm text-stone-500">
              <h2 className="text-lg font-semibold text-stone-900">Disclaimer</h2>
              <div className="mt-3 space-y-2">
                {ANALYSIS_DISCLAIMERS.map((disclaimer) => (
                  <p key={`report-${disclaimer}`}>{disclaimer}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
