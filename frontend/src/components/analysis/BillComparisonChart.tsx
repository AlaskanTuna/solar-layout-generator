import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { COLORS, CHART_TOOLTIP_STYLE } from '@/lib/constants'
import { formatTooltipCurrency } from './formatters'

type BillComparisonChartProps = {
  chartData: { month: string; baselineBill: number; nemBill: number }[]
}

export function BillComparisonChart({ chartData }: BillComparisonChartProps) {
  return (
    <Card data-tour="monthly-chart" className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>Monthly Bill Comparison</CardTitle>
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
              formatter={(value) => formatTooltipCurrency(value)}
              cursor={CHART_TOOLTIP_STYLE.cursor}
              contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
              labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
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
