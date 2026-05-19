/**
 * Monthly bill comparison chart for the analysis dashboard.
 * Shows Malaysian homeowner bills with and without rooftop solar under NEM assumptions.
 */

import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useTheme } from '@/hooks/useTheme'
import { COLORS, getChartTooltipStyle } from '@/lib/constants'
import { ChartTooltipContent } from './ChartTooltipContent'

type BillComparisonChartProps = {
  chartData: { month: string; baselineBill: number; nemBill: number }[]
}

/**
 * Renders a responsive bar chart comparing baseline RM bills against NEM bills for each month.
 * @param props - Chart data containing month labels plus baseline and solar-adjusted bill totals.
 */
export function BillComparisonChart({ chartData }: BillComparisonChartProps) {
  const { t } = useTranslation('analysis')
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)

  const withoutSolar = t('billComparison.withoutSolar')
  const withSolar = t('billComparison.withSolar')

  return (
    <Card data-tour="monthly-chart" className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          {t('billComparison.title')}
          <InfoTooltip text={t('billComparison.titleTooltip')} />
        </CardTitle>
        <CardDescription>{t('billComparison.description')}</CardDescription>
      </CardHeader>
      <CardContent className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.chartBaseline} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.chartBaseline} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorNem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.chartSolar} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.chartSolar} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={COLORS.chartGrid} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.chartTick, fontSize: 12 }}
              dy={10}
            />
            <YAxis
              tickFormatter={(value) => `RM${value}`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.chartTick, fontSize: 12 }}
              dx={-10}
            />
            <Tooltip
              cursor={chartTooltipStyle.cursor}
              contentStyle={chartTooltipStyle.contentStyle}
              labelStyle={chartTooltipStyle.labelStyle}
              content={
                <ChartTooltipContent
                  getItemClassName={(entry) => {
                    if (entry.name === withSolar) {
                      return 'font-bold text-orange-600 dark:text-orange-400'
                    }

                    if (entry.name === withoutSolar) {
                      return 'font-bold text-emerald-600 dark:text-emerald-400'
                    }

                    return 'font-semibold text-foreground'
                  }}
                />
              }
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            <Bar
              dataKey="baselineBill"
              name={withoutSolar}
              fill="url(#colorBaseline)"
              stroke={COLORS.chartBaseline}
              strokeWidth={2}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="nemBill"
              name={withSolar}
              fill="url(#colorNem)"
              stroke={COLORS.chartSolar}
              strokeWidth={2}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
