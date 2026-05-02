import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { listProjects } from '@/api/projects'
import { StatCard } from '@/components/dashboard/StatCard'
import { aggregatePortfolio } from '@/components/dashboard/helpers'
import { Receipt, Zap, Leaf, PieChart, TrendingUp, BarChart3, Clock, Wallet, Award } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeaderCard } from '@/components/layout/PageHeaderCard'
import { useTheme } from '@/hooks/useTheme'
import { COLORS, getChartTooltipStyle } from '@/lib/constants'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'

/** Average annual CO2 emissions of a passenger vehicle (kg). EPA reference value. */
const KG_CO2_PER_CAR_YEAR = 4600

type ComparisonMetric = 'payback' | 'monthlySavings' | 'netBenefit' | 'roi'

const METRIC_FORMATTERS: Record<
  ComparisonMetric,
  { axis: (v: number) => string; tooltip: (v: number) => string; label: (v: number) => string }
> = {
  payback: {
    axis: (v) => `${v} yr`,
    tooltip: (v) => `${v.toFixed(1)} yr`,
    label: (v) => `${v.toFixed(1)} yr`
  },
  monthlySavings: {
    axis: (v) => `RM${v}`,
    tooltip: (v) => formatCurrency(v),
    label: (v) => `RM ${v.toFixed(0)}`
  },
  netBenefit: {
    axis: (v) => `RM${(v / 1000).toFixed(0)}k`,
    tooltip: (v) => formatCurrency(v),
    label: (v) => `RM ${(v / 1000).toFixed(0)}k`
  },
  roi: {
    axis: (v) => `${v}%`,
    tooltip: (v) => `${v.toFixed(1)}%`,
    label: (v) => `${v.toFixed(0)}%`
  }
}

/**
 * Renders the cross-project analytics summary
 */
export function AnalyticsPage() {
  const { t } = useTranslation('nav')
  const navigate = useNavigate()
  const { resolved } = useTheme()
  const tooltipStyle = getChartTooltipStyle(resolved)
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  const [metric, setMetric] = useState<ComparisonMetric>('payback')

  const stats = useMemo(() => aggregatePortfolio(projects ?? []), [projects])
  const completedProjects = useMemo(
    () => (projects ?? []).filter((p) => p.status === 'analysis_saved' && p.analysisResults),
    [projects]
  )

  const comparisonData = useMemo(() => {
    const rows = completedProjects.map((p) => {
      const r = p.analysisResults!
      return {
        name: p.name,
        payback: r.paybackYears,
        monthlySavings: r.averageMonthlySavingsRm ?? 0,
        netBenefit: r.twentyFiveYearNetBenefitRm ?? 0,
        roi: r.tenYearRoiPercent
      }
    })
    const filtered = rows.filter((row) => {
      if (metric === 'payback') return row.payback != null
      if (metric === 'roi') return row.roi != null
      return true
    })
    filtered.sort((a, b) => {
      if (metric === 'payback') return (a.payback ?? Infinity) - (b.payback ?? Infinity)
      if (metric === 'monthlySavings') return b.monthlySavings - a.monthlySavings
      if (metric === 'netBenefit') return b.netBenefit - a.netBenefit
      return (b.roi ?? -Infinity) - (a.roi ?? -Infinity)
    })
    return filtered
  }, [completedProjects, metric])

  const excludedCount = completedProjects.length - comparisonData.length

  if (stats.completedCount === 0) {
    return (
      <PageContainer>
        <PageHeaderCard artSrc="/dashboard/analytics.webp">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
              <p className="mt-1 max-w-lg text-muted-foreground">{t('analytics.subtitle')}</p>
            </div>
          </div>
        </PageHeaderCard>
        <div className="mt-6 glass-card flex flex-col items-center py-16 text-center">
          <PieChart className="h-12 w-12 text-muted-foreground/30" />
          <h2 className="mt-4 font-heading text-lg font-semibold">{t('analytics.noData.title')}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('analytics.noData.subtitle')}</p>
        </div>
      </PageContainer>
    )
  }

  const carbonTonnes = stats.totalCarbonKg / 1000
  const carEquivalent = stats.totalCarbonKg / KG_CO2_PER_CAR_YEAR

  const paybackSpread =
    stats.bestPaybackYears != null && stats.worstPaybackYears != null
      ? stats.worstPaybackYears - stats.bestPaybackYears
      : null

  return (
    <PageContainer>
      <PageHeaderCard artSrc="/dashboard/analytics.webp">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
            <p className="mt-1 max-w-lg text-muted-foreground">
              {t('analytics.subtitleWithCount', { count: stats.completedCount })}
            </p>
          </div>
        </div>
      </PageHeaderCard>

      {/* Hero KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label={t('analytics.stats.totalMonthlySavings')}
          value={`RM ${stats.totalMonthlySavingsRm.toFixed(0)}`}
          accent="text-green-600 dark:text-green-400"
          bg="bg-green-500/10 dark:bg-green-500/20"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label={t('analytics.stats.totalAnnualEnergy')}
          value={`${(stats.totalAnnualGenerationKwh / 1000).toFixed(1)} MWh`}
          accent="text-primary"
          bg="bg-primary/10"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t('analytics.stats.total25YrNetBenefit')}
          value={`RM ${(stats.total25YrNetBenefitRm / 1000).toFixed(0)}k`}
          accent="text-amber-600 dark:text-amber-400"
          bg="bg-amber-500/10 dark:bg-amber-500/20"
        />
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Leaf className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{t('analytics.stats.totalCo2Offset')}</p>
            <p className="font-heading text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {carbonTonnes.toFixed(1)} t/yr
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {t('analytics.stats.co2Equivalent', { count: Math.max(1, Math.round(carEquivalent * 10) / 10) })}
            </p>
          </div>
        </div>
      </div>

      {/* Project Comparison */}
      <Card className="mt-6 border-border bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('analytics.comparison.heading')}
          </CardTitle>
          <CardDescription>{t('analytics.comparison.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
            {(['payback', 'monthlySavings', 'netBenefit', 'roi'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  metric === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`analytics.comparison.metric.${m}`)}
              </button>
            ))}
          </div>
          {comparisonData.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('analytics.comparison.empty')}</div>
          ) : (
            <div style={{ height: Math.max(220, comparisonData.length * 52 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={comparisonData} margin={{ top: 8, right: 64, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorComparisonBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor={COLORS.chartSolar} stopOpacity={0.05} />
                      <stop offset="95%" stopColor={COLORS.chartSolar} stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke={COLORS.chartGrid} />
                  <XAxis
                    type="number"
                    tickFormatter={METRIC_FORMATTERS[metric].axis}
                    tick={{ fill: COLORS.chartTick, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fill: COLORS.chartTick, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 18)}…` : v)}
                  />
                  <Tooltip
                    cursor={tooltipStyle.cursor}
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    content={
                      <ChartTooltipContent
                        valueFormatter={(v) => (typeof v === 'number' ? METRIC_FORMATTERS[metric].tooltip(v) : '—')}
                      />
                    }
                  />
                  <Bar
                    dataKey={metric}
                    name={t(`analytics.comparison.metric.${metric}`)}
                    fill="url(#colorComparisonBar)"
                    stroke={COLORS.chartSolar}
                    strokeWidth={2}
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey={metric}
                      position="right"
                      fill={COLORS.chartTick}
                      fontSize={11}
                      formatter={(v: unknown) => (typeof v === 'number' ? METRIC_FORMATTERS[metric].label(v) : '')}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {excludedCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('analytics.comparison.excluded', { count: excludedCount })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Averages */}
      <h2 className="mt-8 font-heading text-lg font-semibold">{t('analytics.averages.heading')}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('analytics.averages.avgPayback')}</p>
            <p className="mt-0.5 font-heading text-xl font-bold text-primary">
              {stats.avgPaybackYears != null ? `${stats.avgPaybackYears.toFixed(1)} yr` : '—'}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('analytics.averages.avg10YrRoi')}</p>
            <p className="mt-0.5 font-heading text-xl font-bold text-amber-600 dark:text-amber-400">
              {stats.avg10YrRoiPercent != null ? `${stats.avg10YrRoiPercent.toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('analytics.averages.avgBillReduction')}</p>
            <p className="mt-0.5 font-heading text-xl font-bold text-green-600 dark:text-green-400">
              {stats.avgBillReductionPct != null ? `${stats.avgBillReductionPct.toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Distribution highlight */}
      {stats.bestPaybackYears != null && stats.bestProjectName && (
        <div className="mt-6 glass-card flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t('analytics.distribution.highlight', {
                project: stats.bestProjectName,
                years: stats.bestPaybackYears.toFixed(1)
              })}
            </p>
            {stats.worstPaybackYears != null && paybackSpread != null && stats.completedCount > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('analytics.distribution.spread', {
                  best: stats.bestPaybackYears.toFixed(1),
                  worst: stats.worstPaybackYears.toFixed(1),
                  spread: paybackSpread.toFixed(1)
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Per-project breakdown */}
      <h2 className="mt-8 font-heading text-lg font-semibold">{t('analytics.breakdown.heading')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('analytics.breakdown.description')}</p>
      <div className="mt-4 glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">{t('analytics.breakdown.colProject')}</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">{t('analytics.breakdown.colSystem')}</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">{t('analytics.breakdown.colSavings')}</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">{t('analytics.breakdown.colPayback')}</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t('analytics.breakdown.col25YrBenefit')}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">{t('analytics.breakdown.colRoi')}</th>
              </tr>
            </thead>
            <tbody>
              {completedProjects.map((p) => {
                const r = p.analysisResults!
                const systemKwp = p.analysisConfig?.systemKwp ?? null
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}/analysis`)}
                    className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{systemKwp != null ? `${systemKwp.toFixed(1)} kWp` : '—'}</td>
                    <td className="px-4 py-3 text-green-600 dark:text-green-400">
                      {formatCurrency(r.averageMonthlySavingsRm)}
                    </td>
                    <td className="px-4 py-3">{r.paybackYears != null ? `${r.paybackYears.toFixed(1)} yr` : '—'}</td>
                    <td className="px-4 py-3 text-amber-600 dark:text-amber-400">
                      {formatCurrency(r.twentyFiveYearNetBenefitRm)}
                    </td>
                    <td className="px-4 py-3">
                      {r.tenYearRoiPercent != null ? `${r.tenYearRoiPercent.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  )
}
