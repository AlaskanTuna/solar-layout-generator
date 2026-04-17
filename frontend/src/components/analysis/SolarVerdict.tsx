import { Calendar, Clock, Leaf, Star, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { formatCurrency, formatNumber } from './formatters'
import { getRoiCondition } from './roiVerdict'
import type { AnalysisResultsRecord } from '@/lib/analysis'

type SolarVerdictProps = {
  analysisResults: AnalysisResultsRecord
  paybackTooltip: string
}

function buildHeadline(analysisResults: AnalysisResultsRecord) {
  const monthlySavings = analysisResults.averageMonthlySavingsRm
  const payback = analysisResults.paybackYears

  if (monthlySavings === null || monthlySavings <= 0) {
    return 'Add panels on the Workbench to see your savings.'
  }

  if (payback === null || payback > 25) {
    return `Solar saves you ${formatCurrency(monthlySavings)}/month but may not pay back within 25 years.`
  }

  return `Solar saves you ${formatCurrency(monthlySavings)}/month and pays back in about ${payback.toFixed(1)} years.`
}

function StarRating({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${label}: ${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < count ? `${color} fill-current` : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  )
}

export function SolarVerdict({ analysisResults, paybackTooltip }: SolarVerdictProps) {
  const condition = getRoiCondition(analysisResults.paybackYears)
  const headline = buildHeadline(analysisResults)
  const { averageMonthlySavingsRm, averageMonthlySavingsPct, annualTotals, paybackYears, carbonOffsetKg } =
    analysisResults

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              Your Solar Verdict
              <InfoTooltip text="A plain-language summary of your solar investment. The star rating reflects your simple payback period: 5 stars (under 6 years), 4 stars (6-12), 3 stars (12-25), 1 star (over 25)." />
            </CardTitle>
            <CardDescription>Headline recommendation and key numbers at a glance.</CardDescription>
          </div>
          <StarRating count={condition.starCount} color={condition.starColor} label={condition.label} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={`rounded-lg border p-4 ${condition.accent}`}>
          <p className="text-base font-semibold text-foreground sm:text-sm">{headline}</p>
        </div>
        <div data-tour="hero-cards" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span>
                Monthly Savings
                <InfoTooltip text="How much less you'd pay each month on average compared to not having solar." />
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(averageMonthlySavingsRm)}</p>
            <p className="text-xs text-muted-foreground">{formatNumber(averageMonthlySavingsPct, '%')} off your bill</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Annual Savings
                <InfoTooltip text="Total savings across the full year. This is your bill without solar minus your bill with solar." />
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(annualTotals.totalSavingsRm)}</p>
            <p className="text-xs text-muted-foreground">Baseline {formatCurrency(annualTotals.totalBaselineRm)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Simple Payback
                <InfoTooltip text={paybackTooltip} />
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatNumber(paybackYears, 'years')}</p>
            <p className="text-xs text-muted-foreground">{condition.description}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Leaf className="h-3.5 w-3.5" />
              <span>
                CO2 Offset
                <InfoTooltip text="The amount of carbon dioxide emissions avoided by generating clean solar energy instead of using grid power." />
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatNumber(carbonOffsetKg, 'kg/year')}</p>
            <p className="text-xs text-muted-foreground">{formatNumber(annualTotals.totalGenerationKwh, 'kWh/year')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
