import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { ProjectResponse } from '@/api/projects'
import type { AnalysisResultsRecord } from '@/lib/analysis'
import {
  ANALYSIS_DISCLAIMER_KEYS,
  MONTH_LABELS,
  computeDegradedSavings,
  normalizeInverterReplacements,
  summarizeLayoutOrientation
} from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { computeSystemCost, getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import type { CostBreakdown, RoofType } from '@shared/types'
import { useTheme } from '@/hooks/useTheme'
import { COLORS, getChartTooltipStyle } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SolarVerdict } from '@/components/analysis/SolarVerdict'
import { FinancialRoadmap } from '@/components/analysis/FinancialRoadmap'
import { NetBenefitChart } from '@/components/analysis/NetBenefitChart'
import { MonthTable } from '@/components/analysis/MonthTable'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import { formatCurrency } from '@/components/analysis/formatters'
import { PdfPageShell } from './PdfPageShell'

type ChartDataPoint = { month: string; baselineBill: number; nemBill: number; cumulativeSavings: number }

type Props = {
  project: ProjectResponse
  /** ISO date string for when the seeded AFA / tariff was last verified. Null when not seeded. */
  tariffEffectiveDate?: string | null
}

const SEGMENT_COLORS = {
  panels: '#16a34a',
  inverter: '#2563eb',
  mounting: '#9333ea',
  electricalBos: '#ea580c',
  scaffolding: '#db2777',
  permit: '#0891b2',
  labour: '#ca8a04',
  installerMargin: '#475569'
} as const

function azimuthToCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

function buildChartData(monthlyBreakdown: AnalysisResultsRecord['monthlyBreakdown']): ChartDataPoint[] {
  let cumulativeSavings = 0
  return monthlyBreakdown.map((month, index) => {
    cumulativeSavings += month.savingsRm
    return {
      month: MONTH_LABELS[index] ?? String(index + 1),
      baselineBill: month.baselineBill.total,
      nemBill: month.nemBill.total,
      cumulativeSavings: Math.round(cumulativeSavings * 100) / 100
    }
  })
}

function SummaryTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {detail && <p className="text-[9px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

function SummaryCard({
  title,
  tiles,
  columns = 3
}: {
  title: string
  tiles: { label: string; value: string; detail?: string }[]
  columns?: 3 | 4 | 6
}) {
  const gridClass = columns === 4 ? 'grid-cols-4' : columns === 6 ? 'grid-cols-6' : 'grid-cols-3'
  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardContent className="p-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className={`grid gap-2 ${gridClass}`}>
          {tiles.map((tile) => (
            <SummaryTile key={tile.label} {...tile} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function CompactBillComparison({
  chartData,
  tooltipStyle,
  withoutSolarLabel,
  withSolarLabel
}: {
  chartData: ChartDataPoint[]
  tooltipStyle: ReturnType<typeof getChartTooltipStyle>
  withoutSolarLabel: string
  withSolarLabel: string
}) {
  const { t } = useTranslation('pdf')
  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('page4.billComparison.title')}</CardTitle>
        <CardDescription className="text-xs">{t('page4.billComparison.description')}</CardDescription>
      </CardHeader>
      <CardContent className="h-[200px] pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pdfBillBaseline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.chartBaseline} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.chartBaseline} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="pdfBillNem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.chartSolar} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.chartSolar} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={COLORS.chartGrid} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: COLORS.chartTick, fontSize: 10 }} dy={6} />
            <YAxis
              tickFormatter={(value) => `RM${value}`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.chartTick, fontSize: 10 }}
              dx={-6}
            />
            <Tooltip cursor={tooltipStyle.cursor} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} content={<ChartTooltipContent />} />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '6px', fontSize: '10px' }} />
            <Bar dataKey="baselineBill" name={withoutSolarLabel} fill="url(#pdfBillBaseline)" stroke={COLORS.chartBaseline} strokeWidth={1.5} radius={[2, 2, 0, 0]} />
            <Bar dataKey="nemBill" name={withSolarLabel} fill="url(#pdfBillNem)" stroke={COLORS.chartSolar} strokeWidth={1.5} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function CompactCumulativeSavings({
  chartData,
  tooltipStyle
}: {
  chartData: ChartDataPoint[]
  tooltipStyle: ReturnType<typeof getChartTooltipStyle>
}) {
  const { t } = useTranslation('pdf')
  return (
    <Card className="h-full border-border bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('page4.cumulativeSavings.title')}</CardTitle>
        <CardDescription className="text-xs">{t('page4.cumulativeSavings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="h-[210px] pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 20, top: 6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis width={60} tickFormatter={(v) => `RM${v}`} tick={{ fontSize: 10 }} />
            <Tooltip cursor={tooltipStyle.cursor} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="cumulativeSavings" name={t('page4.cumulativeSavings.seriesName')} stroke="#ca8a04" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

type Segment = { key: string; name: string; detail: string; value: number; color: string }

function CompactSystemCostWithAssumptions({
  costBreakdown,
  activePanelCount,
  panelCapacityWp,
  panelCostPerWp,
  roofType,
  tooltipStyle,
  assumptionTiles
}: {
  costBreakdown: CostBreakdown
  activePanelCount: number
  panelCapacityWp: number
  panelCostPerWp: number
  roofType: RoofType
  tooltipStyle: ReturnType<typeof getChartTooltipStyle>
  assumptionTiles: { label: string; value: string; detail?: string }[]
}) {
  const { t } = useTranslation('pdf')
  const segments = useMemo<Segment[]>(() => {
    const roofLabel = t(`page5.systemCost.roofLabels.${roofType}` as const) ?? roofType
    const items: Segment[] = [
      {
        key: 'panels',
        name: t('page5.systemCost.segments.panels'),
        detail: `${activePanelCount} × ${panelCapacityWp} Wp @ RM ${panelCostPerWp.toFixed(2)}/Wp`,
        value: costBreakdown.panels,
        color: SEGMENT_COLORS.panels
      },
      {
        key: 'inverter',
        name: t('page5.systemCost.segments.inverter'),
        detail: `${costBreakdown.inverterSku} · ${costBreakdown.inverterKwac} kWac`,
        value: costBreakdown.inverter,
        color: SEGMENT_COLORS.inverter
      },
      {
        key: 'mounting',
        name: t('page5.systemCost.segments.mounting'),
        detail: `${roofLabel} Roof`,
        value: costBreakdown.mounting,
        color: SEGMENT_COLORS.mounting
      },
      {
        key: 'electricalBos',
        name: t('page5.systemCost.segments.electricalBos'),
        detail: t('page5.systemCost.segments.electricalBosDetail'),
        value: costBreakdown.electricalBos,
        color: SEGMENT_COLORS.electricalBos
      }
    ]
    if (costBreakdown.scaffolding > 0) {
      items.push({
        key: 'scaffolding',
        name: t('page5.systemCost.segments.scaffolding'),
        detail: t('page5.systemCost.segments.scaffoldingDetail'),
        value: costBreakdown.scaffolding,
        color: SEGMENT_COLORS.scaffolding
      })
    }
    items.push({
      key: 'permit',
      name: t('page5.systemCost.segments.permit'),
      detail: costBreakdown.cccFeeTriggered
        ? t('page5.systemCost.segments.permitCcc')
        : t('page5.systemCost.segments.permitSeda'),
      value: costBreakdown.permit,
      color: SEGMENT_COLORS.permit
    })
    items.push({
      key: 'labour',
      name: t('page5.systemCost.segments.labour'),
      detail: t('page5.systemCost.segments.labourDetail'),
      value: costBreakdown.labour,
      color: SEGMENT_COLORS.labour
    })
    items.push({
      key: 'installerMargin',
      name: t('page5.systemCost.segments.installerMargin'),
      detail: t('page5.systemCost.segments.installerMarginDetail'),
      value: costBreakdown.installerMargin,
      color: SEGMENT_COLORS.installerMargin
    })
    return items
  }, [costBreakdown, activePanelCount, panelCapacityWp, panelCostPerWp, roofType, t])

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{t('page5.systemCost.title')}</CardTitle>
            <CardDescription className="text-xs">{t('page5.systemCost.description')}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-foreground tabular-nums">{formatCurrency(costBreakdown.total)}</p>
            <p className="text-[9px] text-muted-foreground">{t('page5.systemCost.quoteVariance')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-4">
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {(Object.keys(SEGMENT_COLORS) as (keyof typeof SEGMENT_COLORS)[]).map((key) => (
                    <linearGradient key={key} id={`pdfSystemCost-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SEGMENT_COLORS[key]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={SEGMENT_COLORS[key]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={segments} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={0}>
                  {segments.map((segment) => (
                    <Cell key={segment.key} fill={`url(#pdfSystemCost-${segment.key})`} stroke={segment.color} strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip cursor={tooltipStyle.cursor} contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-0.5 text-[10px]">
            {segments.map((segment) => {
              const rawPercent = (segment.value / costBreakdown.total) * 100
              const percent = Number.isFinite(rawPercent) ? rawPercent : 0
              return (
                <li key={segment.key} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{segment.name}</p>
                      <p className="truncate text-[9px] text-muted-foreground">{segment.detail}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-foreground">{formatCurrency(segment.value)}</p>
                      <p className="text-[9px] text-muted-foreground">{percent.toFixed(0)}%</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="text-[9px] text-muted-foreground">{t('page5.systemCost.pricingNote')}</p>
        <div className="border-t border-border pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('page5.assumptions.sectionTitle')}
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {assumptionTiles.map((tile) => (
              <SummaryTile key={tile.label} {...tile} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PrintPage2Analysis({ project, tariffEffectiveDate = null }: Props) {
  const { t } = useTranslation('pdf')
  const { resolved } = useTheme()
  const tooltipStyle = getChartTooltipStyle(resolved)
  const analysisResults = project.analysisResults

  if (!analysisResults) {
    return (
      <PdfPageShell sectionLabel="Analysis" pageBreak={false}>
        <div className="rounded-lg border border-destructive bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-semibold">{t('analysisError.title')}</p>
          <p className="mt-2">{t('analysisError.description')}</p>
        </div>
      </PdfPageShell>
    )
  }

  const activePanels = parsePanelEdits(project.editedLayout).filter((p) => p.status !== 'deleted')
  const panelModel = getPanelModel(project.analysisConfig?.selectedPanelModelId ?? DEFAULT_PANEL_MODEL_ID)
  const panelCapacityWp = panelModel?.capacityWp ?? 0
  const panelCostPerWp = panelModel?.costPerWp && panelModel.costPerWp > 0 ? panelModel.costPerWp : 0.95
  const systemKwp = Math.round(((activePanels.length * panelCapacityWp) / 1000) * 100) / 100
  const roofType = project.analysisConfig?.roofType ?? 'tile'
  const connectionPhase = project.analysisConfig?.connectionPhase ?? 'single'
  const degradationRate = project.analysisConfig?.degradationRate ?? 0.005
  const tariffEscalationRate = project.analysisConfig?.tariffEscalationRate ?? 0
  const performanceRatio = project.analysisConfig?.performanceRatio ?? 0.8
  const assumedLosses = project.analysisConfig?.assumedLosses ?? 0.2
  const dcAcRatio = project.analysisConfig?.dcAcRatio ?? 1.2
  const systemCostRm = project.analysisConfig?.systemCostRm ?? 0
  const analysisMode = project.analysisConfig?.analysisMode === 'lifecycle' ? 'lifecycle' : 'simple'
  const annualMaintenanceRm = project.analysisConfig?.annualMaintenanceRm ?? 0
  const inverterReplacements = normalizeInverterReplacements(
    project.analysisConfig?.inverterReplacements,
    project.analysisConfig?.inverterReplacementCostRm,
    project.analysisConfig?.inverterReplacementYear
  )
  const buildingInsights = project.location?.buildingInsightsJson
    ? parseBuildingInsights(project.location.buildingInsightsJson)
    : null
  const panelLifetimeYears = buildingInsights?.solarPotential.panelLifetimeYears ?? null
  const layoutOrientation = buildingInsights
    ? summarizeLayoutOrientation(
        activePanels,
        buildingInsights.solarPotential.solarPanels,
        buildingInsights.solarPotential.roofSegmentStats
      )
    : null

  const simulation = {
    months: analysisResults.monthlyBreakdown,
    totalConsumptionKwh: analysisResults.annualTotals.totalConsumptionKwh,
    totalGenerationKwh: analysisResults.annualTotals.totalGenerationKwh,
    totalBaselineRm: analysisResults.annualTotals.totalBaselineRm,
    totalNemRm: analysisResults.annualTotals.totalNemRm,
    totalSavingsRm: analysisResults.annualTotals.totalSavingsRm,
    totalCreditsForfeited: analysisResults.annualTotals.totalCreditsForfeitedKwh
  }

  const chartData = buildChartData(analysisResults.monthlyBreakdown)
  const costBreakdown =
    activePanels.length > 0 && panelCapacityWp > 0
      ? computeSystemCost({
          panelCount: activePanels.length,
          panelWattageWp: panelCapacityWp,
          panelCostPerWp,
          roofType,
          supplyPhase: connectionPhase
        })
      : null

  const year1Savings = analysisResults.annualTotals.totalSavingsRm

  // Cumulative savings summary
  const monthlySavings = analysisResults.monthlyBreakdown.map((m) => m.savingsRm)
  const peakMonthlyIdx = monthlySavings.reduce((best, v, i) => (v > monthlySavings[best] ? i : best), 0)
  const peakMonthly = monthlySavings[peakMonthlyIdx] ?? 0
  const avgMonthly = year1Savings / 12

  // Net benefit summary (25-year)
  const year25DegradedCumulative =
    Array.from({ length: 25 }, (_, i) =>
      computeDegradedSavings(year1Savings, degradationRate, i + 1, tariffEscalationRate)
    ).pop() ?? 0
  const year25NetBenefit = year25DegradedCumulative - systemCostRm
  const breakEvenYear = analysisResults.paybackYears

  const lifecycleActive = analysisMode === 'lifecycle'
  const assumptionTiles = [
    {
      label: t('page5.assumptions.financialMode'),
      value: lifecycleActive ? t('page5.assumptions.financialModeLifecycle') : t('page5.assumptions.financialModeSimple'),
      detail: lifecycleActive ? t('page5.assumptions.financialModeLifecycleDetail') : t('page5.assumptions.financialModeSimpleDetail')
    },
    { label: t('page5.assumptions.perfRatio'), value: `${Math.round(performanceRatio * 100)}%`, detail: t('page5.assumptions.perfRatioDetail') },
    { label: t('page5.assumptions.losses'), value: `${Math.round(assumedLosses * 100)}%`, detail: t('page5.assumptions.lossesDetail') },
    { label: t('page5.assumptions.degradation'), value: `${(degradationRate * 100).toFixed(1)}%/yr`, detail: t('page5.assumptions.degradationDetail') },
    tariffEscalationRate > 0
      ? { label: t('page5.assumptions.tariffEscalation'), value: `${(tariffEscalationRate * 100).toFixed(1)}%/yr`, detail: t('page5.assumptions.tariffEscalationDetail') }
      : null,
    { label: t('page5.assumptions.dcAcRatio'), value: String(dcAcRatio), detail: t('page5.assumptions.dcAcRatioDetail') },
    lifecycleActive && annualMaintenanceRm > 0
      ? { label: t('page5.assumptions.maintenance'), value: `${formatCurrency(annualMaintenanceRm)}/yr`, detail: t('page5.assumptions.maintenanceDetail') }
      : null,
    ...(lifecycleActive
      ? inverterReplacements.map((r, idx) => ({
          label: inverterReplacements.length === 1
            ? t('page5.assumptions.inverterSwap')
            : t('page5.assumptions.inverterSwapNumbered', { index: idx + 1 }),
          value: formatCurrency(r.costRm),
          detail: t('page5.assumptions.inverterSwapDetail', { year: r.year })
        }))
      : []),
    panelLifetimeYears != null
      ? {
          label: t('page5.assumptions.panelLifetime'),
          value: `${panelLifetimeYears} ${t('page5.assumptions.panelLifetimeSuffix')}`,
          detail: t('page5.assumptions.panelLifetimeDetail')
        }
      : null,
    layoutOrientation
      ? {
          label: t('page5.assumptions.azimuthPitch'),
          value: `${Math.round(layoutOrientation.azimuthDegrees)}° / ${Math.round(layoutOrientation.pitchDegrees)}°`,
          detail:
            layoutOrientation.segmentCount > 1
              ? t('page5.assumptions.azimuthPitchMultiSegment', {
                  compass: azimuthToCompass(layoutOrientation.azimuthDegrees),
                  count: layoutOrientation.segmentCount
                })
              : t('page5.assumptions.azimuthPitchOneSegment', {
                  compass: azimuthToCompass(layoutOrientation.azimuthDegrees),
                  count: layoutOrientation.panelCount
                })
        }
      : null,
    tariffEffectiveDate
      ? {
          label: t('page5.assumptions.tariffVerified'),
          value: new Date(tariffEffectiveDate).toLocaleDateString('en-MY', { year: 'numeric', month: 'short' }),
          detail: t('page5.assumptions.tariffVerifiedDetail')
        }
      : null
  ].filter((tile) => tile !== null) as { label: string; value: string; detail?: string }[]

  const withoutSolarLabel = t('page4.billComparison.withoutSolar')
  const withSolarLabel = t('page4.billComparison.withSolar')

  return (
    <>
      {/* Page 2: Solar Verdict + Bill Comparison */}
      <PdfPageShell
        sectionLabel={t('page2.sectionLabel')}
        context={t('page2.context')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pdf-card-break">
            <SolarVerdict
              analysisResults={analysisResults}
              paybackTooltip={t('page2.paybackTooltip')}
            />
          </div>
          <div className="pdf-card-break">
            <CompactBillComparison
              chartData={chartData}
              tooltipStyle={tooltipStyle}
              withoutSolarLabel={withoutSolarLabel}
              withSolarLabel={withSolarLabel}
            />
          </div>
        </div>
      </PdfPageShell>

      {/* Page 3: Month-by-Month Breakdown */}
      <PdfPageShell
        sectionLabel={t('page3.sectionLabel')}
        context={t('page3.context')}
      >
        <div className="min-h-0 flex-1">
          <MonthTable simulation={simulation} isOpen={true} onToggle={() => {}} />
        </div>
      </PdfPageShell>

      {/* Page 4: Cumulative Savings + Summary */}
      <PdfPageShell
        sectionLabel={t('page4.sectionLabel')}
        context={t('page4.context')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pdf-card-break min-h-0 flex-1">
            <CompactCumulativeSavings chartData={chartData} tooltipStyle={tooltipStyle} />
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title={t('page4.summary.title')}
              tiles={[
                {
                  label: t('page4.summary.peakMonthSavings'),
                  value: formatCurrency(peakMonthly),
                  detail: MONTH_LABELS[peakMonthlyIdx]
                },
                {
                  label: t('page4.summary.averageMonthSavings'),
                  value: formatCurrency(avgMonthly),
                  detail: t('page4.summary.averageMonthSavingsDetail')
                },
                {
                  label: t('page4.summary.year1TotalSavings'),
                  value: formatCurrency(year1Savings),
                  detail: t('page4.summary.year1TotalSavingsDetail')
                }
              ]}
            />
          </div>
        </div>
      </PdfPageShell>

      {/* Page 5: System Cost with nested Assumptions */}
      <PdfPageShell
        sectionLabel={t('page5.sectionLabel')}
        context={t('page5.context')}
      >
        <div className="min-h-0 flex-1">
          {costBreakdown ? (
            <CompactSystemCostWithAssumptions
              costBreakdown={costBreakdown}
              activePanelCount={activePanels.length}
              panelCapacityWp={panelCapacityWp}
              panelCostPerWp={panelCostPerWp}
              roofType={roofType}
              tooltipStyle={tooltipStyle}
              assumptionTiles={assumptionTiles}
            />
          ) : (
            <Card className="border-border bg-card/90 shadow-sm">
              <CardContent className="p-4 text-sm text-muted-foreground">
                {t('page5.noCostBreakdown')}
              </CardContent>
            </Card>
          )}
        </div>
      </PdfPageShell>

      {/* Page 6: Net Benefit Projection + Summary */}
      <PdfPageShell
        sectionLabel={t('page6.sectionLabel')}
        context={lifecycleActive ? t('page6.contextLifecycle') : t('page6.contextSimple')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pdf-card-break min-h-0 flex-1">
            <NetBenefitChart
              year1Savings={year1Savings}
              degradationRate={degradationRate}
              systemCostRm={systemCostRm}
              tariffEscalationRate={tariffEscalationRate}
              defaultYearRange={25}
              analysisMode={analysisMode}
              annualMaintenanceRm={annualMaintenanceRm}
              inverterReplacements={inverterReplacements}
            />
          </div>
          <div className="pdf-card-break">
            <SummaryCard
              title={t('page6.summary.title')}
              tiles={[
                {
                  label: t('page6.summary.breakEven'),
                  value: breakEvenYear !== null ? `${breakEvenYear.toFixed(1)} yrs` : t('page6.summary.breakEvenNA'),
                  detail: t('page6.summary.breakEvenDetail')
                },
                {
                  label: t('page6.summary.year25NetBenefit'),
                  value: formatCurrency(year25NetBenefit),
                  detail: t('page6.summary.year25NetBenefitDetail')
                },
                {
                  label: t('page6.summary.year25GrossSavings'),
                  value: formatCurrency(year25DegradedCumulative),
                  detail: t('page6.summary.year25GrossSavingsDetail')
                }
              ]}
            />
          </div>
        </div>
      </PdfPageShell>

      {/* Page 7: Financial Roadmap */}
      <PdfPageShell
        sectionLabel={t('page7.sectionLabel')}
        context={t('page7.context')}
      >
        <div className="min-h-0 flex-1">
          <FinancialRoadmap
            systemCostRm={systemCostRm}
            paybackYears={analysisResults.paybackYears}
            year1Savings={year1Savings}
            degradationRate={degradationRate}
            systemKwp={systemKwp}
            tariffEscalationRate={tariffEscalationRate}
            analysisMode={analysisMode}
            annualMaintenanceRm={annualMaintenanceRm}
            inverterReplacements={inverterReplacements}
          />
        </div>
      </PdfPageShell>

      {/* Page 8: Disclaimers (natural height, no stretch) */}
      <PdfPageShell sectionLabel={t('page8.sectionLabel')} pageBreak={false}>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
          <p className="mb-2 text-sm font-semibold text-foreground">{t('page8.title')}</p>
          <ul className="space-y-2">
            {ANALYSIS_DISCLAIMER_KEYS.map((key) => (
              <li key={key}>&middot; {t(`page8.disclaimers.${key}` as const)}</li>
            ))}
          </ul>
        </div>
      </PdfPageShell>
    </>
  )
}
