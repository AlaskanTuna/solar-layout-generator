import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import html2pdf from 'html2pdf.js'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ANALYSIS_DISCLAIMERS,
  MONTH_LABELS,
  aggregateMonthlyGeneration,
  buildAnalysisResults,
  buildThresholdWarnings,
  parseSavedAnalysisConfig,
  type AnalysisConfig,
  type AnalysisResultsRecord,
  type ConnectionPhase
} from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { runAnnualSimulation } from '@/lib/billingEngine'
import { InfoTooltip } from '@/components/InfoTooltip'

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
  const initializedProjectIdRef = useRef<string | null>(null)

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [formState, setFormState] = useState<AnalysisFormState | null>(null)
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple')

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
  const panelCapacityWatts = buildingInsights?.solarPotential.panelCapacityWatts ?? 0
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
    setFormState({
      monthlyConsumptionKwh: savedConfig?.monthlyConsumptionKwh ?? 600,
      connectionPhase: savedConfig?.connectionPhase ?? 'single',
      systemCostRm: savedConfig?.systemCostRm ?? Math.round(systemKwp * tariffQuery.data.defaults.systemCostPerKwp),
      afaRateSenPerKwh: savedConfig?.afaRateSenPerKwh ?? tariffQuery.data.afaRateDefault
    })
    initializedProjectIdRef.current = projectId
  }, [projectId, projectQuery.data, tariffQuery.data, buildingInsights, systemKwp])

  const billingConfig = useMemo(() => {
    if (!tariffQuery.data || !formState) return null

    return {
      rates: tariffQuery.data.rates,
      thresholds: tariffQuery.data.thresholds,
      eeiTable: tariffQuery.data.eeiTable,
      afaRate: formState.afaRateSenPerKwh
    }
  }, [tariffQuery.data, formState])

  const simulation = useMemo(() => {
    if (!formState || !billingConfig) return null
    return runAnnualSimulation(formState.monthlyConsumptionKwh, monthlyGeneration, billingConfig)
  }, [billingConfig, formState, monthlyGeneration])

  const analysisResults = useMemo(() => {
    if (!simulation || !formState) return null

    return buildAnalysisResults({
      simulation,
      systemCostRm: formState.systemCostRm,
      carbonOffsetFactorKgPerMwh,
      activePanelCount: activePanels.length
    })
  }, [activePanels.length, carbonOffsetFactorKgPerMwh, formState, simulation])

  const chartData = useMemo(() => (simulation ? buildChartData(simulation) : []), [simulation])
  const selectedMonth = simulation?.months[selectedMonthIndex] ?? null
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
    if (!reportRef.current || !projectQuery.data) return

    setIsExporting(true)
    try {
      // html2canvas cannot parse oklch() colors — override with hex equivalents on the PDF container
      const pdfRoot = reportRef.current
      const prevStyle = pdfRoot.getAttribute('style') ?? ''
      pdfRoot.style.setProperty('--background', '#ffffff')
      pdfRoot.style.setProperty('--foreground', '#0a0a0a')
      pdfRoot.style.setProperty('--muted-foreground', '#737373')
      pdfRoot.style.setProperty('--border', '#e5e5e5')
      pdfRoot.style.setProperty('--card', '#ffffff')

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: buildPdfFileName(projectQuery.data.name),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(pdfRoot)
        .save()

      // Restore original styles
      if (prevStyle) {
        pdfRoot.setAttribute('style', prevStyle)
      } else {
        pdfRoot.removeAttribute('style')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export the PDF report')
    } finally {
      setIsExporting(false)
    }
  }

  if (projectQuery.isLoading || tariffQuery.isLoading || locationQuery.isLoading || !formState || !buildingInsights) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f7f4_0%,#f3efe7_45%,#f7faf7_100%)]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 xl:flex-row">
          <aside className="xl:w-[24rem] xl:min-w-[24rem]">
            <Card className="border-stone-200 bg-white/92 shadow-sm">
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </aside>
          <section className="min-w-0 flex-1 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="py-6">
                    <Skeleton className="mx-auto h-4 w-20" />
                    <Skeleton className="mx-auto mt-2 h-8 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="py-6">
                <Skeleton className="h-64 w-full rounded-lg" />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f7f4_0%,#f3efe7_45%,#f7faf7_100%)]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 xl:flex-row">
        <aside className="xl:w-[24rem] xl:min-w-[24rem]">
          <Card className="border-stone-200 bg-white/92 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{projectQuery.data.name}</CardTitle>
                  <CardDescription>
                    Adjust assumptions and review the NEM billing outcome before saving.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {projectQuery.data.status === 'analysis_saved' ? 'Analysis Saved' : 'Layout Saved'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">System Size</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
                </div>
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">Active Panels</p>
                  <p className="mt-1 text-lg font-semibold">{activePanels.length}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="space-y-2 rounded-xl border border-stone-200 bg-white/90 p-4">
                <div className="space-y-1">
                  <Label>
                    Monthly Electricity Consumption (kWh)
                    <InfoTooltip text="Your average monthly electricity usage in kWh. Check your TNB bill for the 'kWh Usage' figure. The same value is applied to all 12 months." />
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
                    System Cost
                    <InfoTooltip text="Total estimated installation cost in RM. Default is RM 4,500 per kWp. Adjust based on actual installer quotes." />
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
                        ? { ...current, afaRateSenPerKwh: raw === '' || raw === '-' ? 0 : Number.isFinite(parsed) ? parsed : current.afaRateSenPerKwh }
                        : current
                    )
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Button variant="outline" asChild>
                  <Link to={`/project/${projectId}/workbench`}>Back to Workbench</Link>
                </Button>
                <Button variant="outline" onClick={handleExportPdf} disabled={isExporting}>
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
          <div className="inline-flex rounded-lg border border-stone-200 bg-white/90 p-1 shadow-sm">
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">Average Monthly Savings</p>
                <p className="text-2xl font-semibold">{formatCurrency(analysisResults.averageMonthlySavingsRm)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(analysisResults.averageMonthlySavingsPct, '%')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">Annual Savings</p>
                <p className="text-2xl font-semibold">{formatCurrency(analysisResults.annualTotals.totalSavingsRm)}</p>
                <p className="text-sm text-muted-foreground">
                  Baseline {formatCurrency(analysisResults.annualTotals.totalBaselineRm)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">Simple Payback</p>
                <p className="text-2xl font-semibold">{formatNumber(analysisResults.paybackYears, 'years')}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getRoiCondition(analysisResults.paybackYears).bgColor}`}>
                  {getRoiCondition(analysisResults.paybackYears).label}
                </span>
                <p className="text-xs text-muted-foreground">{getRoiCondition(analysisResults.paybackYears).description}</p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">10-Year Net Benefit</p>
                <p className={`text-2xl font-semibold ${analysisResults.tenYearNetBenefitRm !== null && analysisResults.tenYearNetBenefitRm >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCurrency(analysisResults.tenYearNetBenefitRm)}
                </p>
                <p className="text-sm text-muted-foreground">
                  ROI {formatNumber(analysisResults.tenYearRoiPercent, '%')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardContent className="space-y-1 p-5">
                <p className="text-sm text-muted-foreground">CO2 Offset</p>
                <p className="text-2xl font-semibold">{formatNumber(analysisResults.carbonOffsetKg, 'kg/year')}</p>
                <p className="text-sm text-muted-foreground">
                  Generation {formatNumber(analysisResults.annualTotals.totalGenerationKwh, 'kWh/year')}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>Monthly Bill Comparison</CardTitle>
                <CardDescription>Baseline bill versus post-solar NEM bill for each month.</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `RM${value}`} />
                    <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                    <Legend />
                    <Bar dataKey="baselineBill" name="Without Solar" fill="#1f2937" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nemBill" name="With Solar" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>Cumulative Savings</CardTitle>
                <CardDescription>Running savings over the settlement year.</CardDescription>
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
          </div>

          {viewMode === 'advanced' && (
          <Card className="border-stone-200 bg-white/90 shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Bill Component Breakdown</CardTitle>
                  <CardDescription>Select a month to inspect the exact tariff components.</CardDescription>
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
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-stone-500">Energy</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.energy)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Capacity</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.capacity)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Network</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.network)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Retail</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.retail)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">AFA</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.afa)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">EEI Rebate</p>
                      <p className="font-semibold">-{formatCurrency(selectedMonth.baselineBill.eeiRebate)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">RE Fund</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.reFund)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">SST</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.sst)}</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-stone-200 pt-3">
                    <p className="text-sm text-stone-500">Total</p>
                    <p className="text-xl font-semibold">{formatCurrency(selectedMonth.baselineBill.total)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <h3 className="text-sm font-semibold text-emerald-950">With Solar</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-emerald-900/70">Billable kWh</p>
                      <p className="font-semibold">{formatNumber(selectedMonth.billableKwh, 'kWh')}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Credit Used</p>
                      <p className="font-semibold">{formatNumber(selectedMonth.creditUsed, 'kWh')}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Credit Balance</p>
                      <p className="font-semibold">{formatNumber(selectedMonth.creditBalance, 'kWh')}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Credit Forfeited</p>
                      <p className="font-semibold">{formatNumber(selectedMonth.creditForfeited, 'kWh')}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Energy</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.energy)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Retail</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.retail)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Capacity</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.capacity)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">AFA</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.afa)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">Network</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.network)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">EEI Rebate</p>
                      <p className="font-semibold">-{formatCurrency(selectedMonth.nemBill.eeiRebate)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">RE Fund</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.reFund)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-900/70">SST</p>
                      <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.sst)}</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-emerald-200 pt-3">
                    <p className="text-sm text-emerald-900/70">Savings</p>
                    <p className="text-xl font-semibold text-emerald-950">{formatCurrency(selectedMonth.savingsRm)}</p>
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
            <CardContent>
              <details open className="space-y-4">
                <summary className="cursor-pointer text-sm font-medium text-stone-700">
                  Expand or collapse the full billing table
                </summary>
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
                        <th className="px-3 py-2 font-medium">NEM Bill</th>
                        <th className="px-3 py-2 font-medium">Savings</th>
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
                          <td className="px-3 py-2">{formatCurrency(month.nemBill.total)}</td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">
                            {formatCurrency(month.savingsRm)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
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
                  <p>Monthly consumption: {formatNumber(formState.monthlyConsumptionKwh, 'kWh')}</p>
                  <p>Connection phase: {formState.connectionPhase === 'single' ? 'Single phase' : 'Three phase'}</p>
                  <p>System cost: {formatCurrency(formState.systemCostRm)}</p>
                  <p>AFA rate: {formatNumber(formState.afaRateSenPerKwh, 'sen/kWh')}</p>
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
                    <Bar dataKey="baselineBill" fill="#1f2937" />
                    <Bar dataKey="nemBill" fill="#0f766e" />
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
