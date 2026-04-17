import { Card, CardContent } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { formatCurrency, formatNumber } from './formatters'
import { type AnalysisResultsRecord } from '@/lib/analysis'

type HeroMetricsProps = {
  analysisResults: AnalysisResultsRecord
  paybackTooltip: string
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

export function HeroMetrics({ analysisResults, paybackTooltip }: HeroMetricsProps) {
  return (
    <div data-tour="hero-cards" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border bg-card/90 shadow-sm">
        <CardContent className="space-y-1 p-5">
          <p className="text-sm text-muted-foreground">
            Average Monthly Savings
            <InfoTooltip text="How much less you'd pay each month on average compared to not having solar." />
          </p>
          <p className="text-2xl font-semibold">{formatCurrency(analysisResults.averageMonthlySavingsRm)}</p>
          <p className="text-sm text-muted-foreground">{formatNumber(analysisResults.averageMonthlySavingsPct, '%')}</p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/90 shadow-sm">
        <CardContent className="space-y-1 p-5">
          <p className="text-sm text-muted-foreground">
            Annual Savings
            <InfoTooltip text="Total savings across the full year. This is your bill without solar minus your bill with solar." />
          </p>
          <p className="text-2xl font-semibold">{formatCurrency(analysisResults.annualTotals.totalSavingsRm)}</p>
          <p className="text-sm text-muted-foreground">
            Baseline {formatCurrency(analysisResults.annualTotals.totalBaselineRm)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/90 shadow-sm">
        <CardContent className="space-y-1 p-5">
          <p className="text-sm text-muted-foreground">
            Simple Payback
            <InfoTooltip text={paybackTooltip} />
          </p>
          <p className="text-2xl font-semibold">{formatNumber(analysisResults.paybackYears, 'years')}</p>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getRoiCondition(analysisResults.paybackYears).bgColor}`}
          >
            {getRoiCondition(analysisResults.paybackYears).label}
          </span>
          <p className="text-xs text-muted-foreground">{getRoiCondition(analysisResults.paybackYears).description}</p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/90 shadow-sm">
        <CardContent className="space-y-1 p-5">
          <p className="text-sm text-muted-foreground">
            CO2 Offset
            <InfoTooltip text="The amount of carbon dioxide emissions avoided by generating clean solar energy instead of using grid power." />
          </p>
          <p className="text-2xl font-semibold">{formatNumber(analysisResults.carbonOffsetKg, 'kg/year')}</p>
          <p className="text-sm text-muted-foreground">
            Generation {formatNumber(analysisResults.annualTotals.totalGenerationKwh, 'kWh/year')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
