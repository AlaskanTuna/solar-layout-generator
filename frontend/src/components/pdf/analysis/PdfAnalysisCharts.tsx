import { useTranslation } from 'react-i18next'
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
import { COLORS, getChartTooltipStyle } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import type { AnalysisChartDataPoint } from '@/lib/analysis'

type TooltipStyle = ReturnType<typeof getChartTooltipStyle>

export function PdfBillComparisonChart({
  chartData,
  tooltipStyle,
  withoutSolarLabel,
  withSolarLabel
}: {
  chartData: AnalysisChartDataPoint[]
  tooltipStyle: TooltipStyle
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
            <Tooltip
              cursor={tooltipStyle.cursor}
              contentStyle={tooltipStyle.contentStyle}
              labelStyle={tooltipStyle.labelStyle}
              content={<ChartTooltipContent />}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '6px', fontSize: '10px' }} />
            <Bar
              dataKey="baselineBill"
              name={withoutSolarLabel}
              fill="url(#pdfBillBaseline)"
              stroke={COLORS.chartBaseline}
              strokeWidth={1.5}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="nemBill"
              name={withSolarLabel}
              fill="url(#pdfBillNem)"
              stroke={COLORS.chartSolar}
              strokeWidth={1.5}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function PdfCumulativeSavingsChart({
  chartData,
  tooltipStyle
}: {
  chartData: AnalysisChartDataPoint[]
  tooltipStyle: TooltipStyle
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
            <YAxis width={60} tickFormatter={(value) => `RM${value}`} tick={{ fontSize: 10 }} />
            <Tooltip
              cursor={tooltipStyle.cursor}
              contentStyle={tooltipStyle.contentStyle}
              labelStyle={tooltipStyle.labelStyle}
              content={<ChartTooltipContent />}
            />
            <Line
              type="monotone"
              dataKey="cumulativeSavings"
              name={t('page4.cumulativeSavings.seriesName')}
              stroke="#ca8a04"
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
