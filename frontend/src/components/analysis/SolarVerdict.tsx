import type { ReactNode } from 'react'
import { Calendar, Clock, Gauge, Star, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { formatCurrency, formatNumber } from './formatters'
import { getRoiCondition } from './roiVerdict'
import { classifyNemFit, computeNemFitMetrics, type AnalysisResultsRecord } from '@/lib/analysis'

type SolarVerdictProps = {
  analysisResults: AnalysisResultsRecord
  paybackTooltip: ReactNode
}

function StarRating({ count, color, label, ariaLabel }: { count: number; color: string; label: string; ariaLabel: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={ariaLabel}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < count ? `${color} fill-current` : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  )
}

/**
 * Renders the SolarVerdict component
 * @param {SolarVerdictProps} props - Props for the component
 */
export function SolarVerdict({ analysisResults, paybackTooltip }: SolarVerdictProps) {
  const { t } = useTranslation('analysis')
  const condition = getRoiCondition(analysisResults.paybackYears)
  const { averageMonthlySavingsRm, averageMonthlySavingsPct, annualTotals, paybackYears, monthlyBreakdown } =
    analysisResults

  let headline: string
  if (averageMonthlySavingsRm === null || averageMonthlySavingsRm <= 0) {
    headline = t('verdict.headline.noPanels')
  } else if (paybackYears === null || paybackYears > 25) {
    headline = t('verdict.headline.noPayback', { amount: formatCurrency(averageMonthlySavingsRm) })
  } else {
    headline = t('verdict.headline.withPayback', {
      amount: formatCurrency(averageMonthlySavingsRm),
      years: paybackYears.toFixed(1)
    })
  }

  const nemFitMetrics = computeNemFitMetrics(monthlyBreakdown)
  const nemFit = classifyNemFit(nemFitMetrics)
  const importRatePct = Math.round(nemFitMetrics.billableImportRate * 100)
  const exportRatePct = Math.round(nemFitMetrics.monthlyExportRate * 100)

  const nemFitLabel = t(`verdict.metrics.nemFit.labels.${nemFit.fit}`)

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              {t('verdict.title')}
              <InfoTooltip>
                <div className="space-y-2">
                  <p>{t('verdict.titleTooltip.intro')}</p>
                  <p>{t('verdict.titleTooltip.ratingIntro')}</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>{t('verdict.titleTooltip.star5')}</li>
                    <li>{t('verdict.titleTooltip.star4')}</li>
                    <li>{t('verdict.titleTooltip.star3')}</li>
                    <li>{t('verdict.titleTooltip.star1')}</li>
                  </ul>
                </div>
              </InfoTooltip>
            </CardTitle>
            <CardDescription>{t('verdict.description')}</CardDescription>
          </div>
          <StarRating
            count={condition.starCount}
            color={condition.starColor}
            label={condition.label}
            ariaLabel={t('verdict.starAriaLabel', { label: condition.label, count: condition.starCount })}
          />
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
                {t('verdict.metrics.monthlySavings.label')}
                <InfoTooltip>
                  <div className="space-y-1.5">
                    <p>{t('verdict.metrics.monthlySavings.tooltip.line1')}</p>
                    <p className="text-primary-foreground/80">
                      {t('verdict.metrics.monthlySavings.tooltip.line2')}
                    </p>
                  </div>
                </InfoTooltip>
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(averageMonthlySavingsRm)}</p>
            <p className="text-xs text-muted-foreground">
              {t('verdict.metrics.monthlySavings.detail', { pct: formatNumber(averageMonthlySavingsPct, '') })}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {t('verdict.metrics.annualSavings.label')}
                <InfoTooltip>
                  <div className="space-y-1.5">
                    <p>{t('verdict.metrics.annualSavings.tooltip.line1')}</p>
                    <p className="text-primary-foreground/80">
                      {t('verdict.metrics.annualSavings.tooltip.line2')}
                    </p>
                  </div>
                </InfoTooltip>
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(annualTotals.totalSavingsRm)}</p>
            <p className="text-xs text-muted-foreground">
              {t('verdict.metrics.annualSavings.baseline', { amount: formatCurrency(annualTotals.totalBaselineRm) })}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {analysisResults.analysisMode === 'lifecycle'
                  ? t('verdict.metrics.payback.lifecycleLabel')
                  : t('verdict.metrics.payback.simpleLabel')}
                <InfoTooltip>{paybackTooltip}</InfoTooltip>
              </span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatNumber(paybackYears, 'years')}</p>
            <p className="text-xs text-muted-foreground">{condition.description}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              <span>
                {t('verdict.metrics.nemFit.label')}
                <InfoTooltip>
                  <div className="space-y-2">
                    <p>{t('verdict.metrics.nemFit.tooltip.intro')}</p>
                    <div className="space-y-1">
                      <p>
                        <span className="font-semibold">{t('verdict.metrics.nemFit.tooltip.good')}</span>{' '}
                        {t('verdict.metrics.nemFit.tooltip.goodDetail')}
                      </p>
                      <p>
                        <span className="font-semibold">{t('verdict.metrics.nemFit.tooltip.moderate')}</span>{' '}
                        {t('verdict.metrics.nemFit.tooltip.moderateDetail')}
                      </p>
                      <p>
                        <span className="font-semibold">{t('verdict.metrics.nemFit.tooltip.oversized')}</span>{' '}
                        {t('verdict.metrics.nemFit.tooltip.oversizedDetail')}
                      </p>
                    </div>
                    <div className="space-y-0.5 border-t border-primary-foreground/20 pt-2 text-primary-foreground/80">
                      <p>
                        {t('verdict.metrics.nemFit.tooltip.importRate')}{' '}
                        <span className="font-semibold text-primary-foreground">{importRatePct}%</span>{' '}
                        {t('verdict.metrics.nemFit.tooltip.importRateSuffix')}
                      </p>
                      <p>
                        {t('verdict.metrics.nemFit.tooltip.exportRate')}{' '}
                        <span className="font-semibold text-primary-foreground">{exportRatePct}%</span>{' '}
                        {t('verdict.metrics.nemFit.tooltip.exportRateSuffix')}
                      </p>
                    </div>
                  </div>
                </InfoTooltip>
              </span>
            </div>
            <p className="text-xl font-semibold">{nemFitLabel}</p>
            <p className="text-xs text-muted-foreground">{nemFit.detail}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
