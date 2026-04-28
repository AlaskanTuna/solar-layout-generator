import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/DropdownMenu'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useTheme } from '@/hooks/useTheme'
import { COLORS, getChartTooltipStyle } from '@/lib/constants'
import { ChartTooltipContent } from './ChartTooltipContent'
import { formatCurrency } from './formatters'
import { buildNetBenefitSeries, type InverterReplacement } from '@/lib/analysis'

type NetBenefitChartProps = {
  year1Savings: number
  degradationRate: number
  systemCostRm: number
  /** Compounding tariff escalation rate, e.g. 0.04 = 4%/year. Defaults to 0 (no escalation). */
  tariffEscalationRate?: number
  /** Override the default active year range (e.g. 25 for PDF exports). */
  defaultYearRange?: YearRange
  /** When 'lifecycle', subtracts maintenance and any scheduled inverter replacements. Defaults to 'simple'. */
  analysisMode?: 'simple' | 'lifecycle'
  annualMaintenanceRm?: number
  /** Each entry is one planned inverter swap. Empty array = no swaps factored in. */
  inverterReplacements?: InverterReplacement[]
  /** @deprecated Pass `inverterReplacements` instead. */
  inverterReplacementCostRm?: number
  /** @deprecated Pass `inverterReplacements` instead. */
  inverterReplacementYear?: number
}

const YEAR_RANGES = [5, 10, 15, 20, 25] as const
type YearRange = (typeof YEAR_RANGES)[number]

export function NetBenefitChart({
  year1Savings,
  degradationRate,
  systemCostRm,
  tariffEscalationRate = 0,
  defaultYearRange = 10,
  analysisMode = 'simple',
  annualMaintenanceRm = 0,
  inverterReplacements,
  inverterReplacementCostRm,
  inverterReplacementYear
}: NetBenefitChartProps) {
  const { t } = useTranslation('analysis')
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)
  const [yearRange, setYearRange] = useState<YearRange>(defaultYearRange)

  const netBenefitData = useMemo(
    () =>
      buildNetBenefitSeries({
        year1Savings,
        degradationRate,
        years: yearRange,
        systemCostRm,
        tariffEscalationRate,
        analysisMode,
        annualMaintenanceRm,
        inverterReplacements,
        inverterReplacementCostRm,
        inverterReplacementYear
      }).map((point) => ({
        year: t('netBenefit.yearLabel', { year: point.year }),
        value: point.netBenefit
      })),
    [
      year1Savings,
      degradationRate,
      systemCostRm,
      tariffEscalationRate,
      yearRange,
      analysisMode,
      annualMaintenanceRm,
      inverterReplacements,
      inverterReplacementCostRm,
      inverterReplacementYear,
      t
    ]
  )

  const seriesName = t('netBenefit.seriesName')
  const finalYearBenefit = netBenefitData[netBenefitData.length - 1].value
  const xAxisInterval = yearRange <= 10 ? 0 : yearRange <= 20 ? 1 : 2

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              {t('netBenefit.title')}
              <InfoTooltip
                text={
                  analysisMode === 'lifecycle'
                    ? t('netBenefit.titleTooltip.lifecycle', { years: yearRange })
                    : t('netBenefit.titleTooltip.simple', { years: yearRange })
                }
              />
            </CardTitle>
            <CardDescription>
              {analysisMode === 'lifecycle'
                ? t('netBenefit.description.lifecycle')
                : t('netBenefit.description.simple')}
            </CardDescription>
          </div>
          <div className="pdf-hide">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {t('netBenefit.yearRangeButton', { years: yearRange })}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={String(yearRange)}
                  onValueChange={(v) => setYearRange(Number(v) as YearRange)}
                >
                  {YEAR_RANGES.map((range) => (
                    <DropdownMenuRadioItem key={range} value={String(range)}>
                      {t('netBenefit.yearRangeOption', { years: range })}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">{t('netBenefit.netBenefitLabel', { years: yearRange })}</p>
          <p className={`text-3xl font-semibold ${finalYearBenefit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatCurrency(finalYearBenefit)}
          </p>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={netBenefitData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.chartSolar} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.chartSolar} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.chartBaseline} stopOpacity={0.05} />
                  <stop offset="95%" stopColor={COLORS.chartBaseline} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={COLORS.chartGrid} />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tick={{ fill: COLORS.chartTick, fontSize: 11 }}
                dy={10}
                interval={xAxisInterval}
              />
              <YAxis
                tickFormatter={(value) => `RM${value.toLocaleString()}`}
                width={70}
                tickLine={false}
                axisLine={false}
                tick={{ fill: COLORS.chartTick, fontSize: 11 }}
                dx={-10}
              />
              <Tooltip
                cursor={chartTooltipStyle.cursor}
                contentStyle={chartTooltipStyle.contentStyle}
                labelStyle={chartTooltipStyle.labelStyle}
                content={
                  <ChartTooltipContent
                    getItemClassName={(entry) => {
                      const value = typeof entry.value === 'number' ? entry.value : Number(entry.value)

                      if (entry.name === seriesName) {
                        return value < 0
                          ? 'font-bold text-red-600 dark:text-red-400'
                          : 'font-bold text-emerald-600 dark:text-emerald-400'
                      }

                      return 'font-semibold text-foreground'
                    }}
                  />
                }
              />
              <Bar dataKey="value" name={seriesName} radius={[2, 2, 0, 0]} strokeWidth={2}>
                {netBenefitData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.value >= 0 ? 'url(#colorPositive)' : 'url(#colorNegative)'}
                    stroke={entry.value >= 0 ? COLORS.chartSolar : COLORS.chartBaseline}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
