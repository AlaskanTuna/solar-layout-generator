import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/InfoTooltip'
import { useTheme } from '@/hooks/useTheme'
import { COLORS, getChartTooltipStyle } from '@/lib/constants'
import { ChartTooltipContent } from './ChartTooltipContent'

type BillComparisonChartProps = {
  chartData: { month: string; baselineBill: number; nemBill: number }[]
}

export function BillComparisonChart({ chartData }: BillComparisonChartProps) {
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)

  return (
    <Card data-tour="monthly-chart" className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          Monthly Bill Comparison
          <InfoTooltip text="Compares your estimated TNB bill with and without solar panels for each month. The orange bars show what you'd normally pay; the green bars show what you'd pay with NEM solar credits applied." />
        </CardTitle>
        <CardDescription>
          Your estimated monthly bill without solar (baseline) versus with solar for each month.
        </CardDescription>
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
                    if (entry.name === 'With Solar') {
                      return 'font-bold text-orange-600 dark:text-orange-400'
                    }

                    if (entry.name === 'Without Solar') {
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
              name="Without Solar"
              fill="url(#colorBaseline)"
              stroke={COLORS.chartBaseline}
              strokeWidth={2}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="nemBill"
              name="With Solar"
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
