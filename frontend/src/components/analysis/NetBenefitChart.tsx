import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import { computeDegradedSavings } from '@/lib/analysis'

type NetBenefitChartProps = {
  year1Savings: number
  degradationRate: number
  systemCostRm: number
}

const YEAR_RANGES = [5, 10, 15, 20, 25] as const
type YearRange = (typeof YEAR_RANGES)[number]

const round2 = (v: number) => Math.round(v * 100) / 100

export function NetBenefitChart({ year1Savings, degradationRate, systemCostRm }: NetBenefitChartProps) {
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)
  const [yearRange, setYearRange] = useState<YearRange>(10)

  const netBenefitData = useMemo(
    () =>
      Array.from({ length: yearRange }, (_, i) => ({
        year: `Yr ${i + 1}`,
        value: round2(computeDegradedSavings(year1Savings, degradationRate, i + 1) - systemCostRm)
      })),
    [year1Savings, degradationRate, systemCostRm, yearRange]
  )

  const finalYearBenefit = netBenefitData[netBenefitData.length - 1].value
  const xAxisInterval = yearRange <= 10 ? 0 : yearRange <= 20 ? 1 : 2

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              Net Benefit Projection
              <InfoTooltip
                text={`Projects your cumulative savings minus the upfront system cost over ${yearRange} years. When bars turn green, you've recovered your investment and are in net profit. Includes annual panel degradation.`}
              />
            </CardTitle>
            <CardDescription>
              How much you gain/lose after subtracting the cost of installing your solar system yearly.
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {yearRange}-Year
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
                    {range}-Year
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">{yearRange}-Year Net Benefit</p>
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

                      if (entry.name === 'Net Benefit') {
                        return value < 0
                          ? 'font-bold text-red-600 dark:text-red-400'
                          : 'font-bold text-emerald-600 dark:text-emerald-400'
                      }

                      return 'font-semibold text-foreground'
                    }}
                  />
                }
              />
              <Bar dataKey="value" name="Net Benefit" radius={[2, 2, 0, 0]} strokeWidth={2}>
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
