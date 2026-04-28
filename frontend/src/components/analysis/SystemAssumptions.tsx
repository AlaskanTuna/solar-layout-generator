import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { azimuthToCompass, type LayoutOrientationSummary } from '@/lib/analysis'

type SystemAssumptionsProps = {
  performanceRatio: number
  assumedLosses: number
  degradationRate: number
  dcAcRatio: number
  panelLifetimeYears: number | null | undefined
  layoutOrientation: LayoutOrientationSummary | null
}

export function SystemAssumptions({
  performanceRatio,
  assumedLosses,
  degradationRate,
  dcAcRatio,
  panelLifetimeYears,
  layoutOrientation
}: SystemAssumptionsProps) {
  const { t } = useTranslation('analysis')

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          {t('systemAssumptions.title')}
          <InfoTooltip text={t('systemAssumptions.titleTooltip')} />
        </CardTitle>
        <CardDescription>{t('systemAssumptions.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('systemAssumptions.performanceRatio.label')}
              <InfoTooltip text={t('systemAssumptions.performanceRatio.tooltip')} />
            </p>
            <p className="mt-1 text-lg font-semibold">{Math.round(performanceRatio * 100)}%</p>
            <p className="text-xs text-muted-foreground">{t('systemAssumptions.performanceRatio.detail')}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('systemAssumptions.assumedLosses.label')}
              <InfoTooltip text={t('systemAssumptions.assumedLosses.tooltip')} />
            </p>
            <p className="mt-1 text-lg font-semibold">{Math.round(assumedLosses * 100)}%</p>
            <p className="text-xs text-muted-foreground">{t('systemAssumptions.assumedLosses.detail')}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('systemAssumptions.degradation.label')}
            </p>
            <p className="mt-1 text-lg font-semibold">{(degradationRate * 100).toFixed(1)}%/yr</p>
            <p className="text-xs text-muted-foreground">{t('systemAssumptions.degradation.detail')}</p>
          </div>
          {panelLifetimeYears != null && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('systemAssumptions.panelLifetime.label')}
                <InfoTooltip text={t('systemAssumptions.panelLifetime.tooltip')} />
              </p>
              <p className="mt-1 text-lg font-semibold">{t('systemAssumptions.panelLifetime.value', { years: panelLifetimeYears })}</p>
              <p className="text-xs text-muted-foreground">{t('systemAssumptions.panelLifetime.detail')}</p>
            </div>
          )}
          {layoutOrientation && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('systemAssumptions.azimuthPitch.label')}
                <InfoTooltip text={t('systemAssumptions.azimuthPitch.tooltip')} />
              </p>
              <p className="mt-1 text-lg font-semibold">
                {Math.round(layoutOrientation.azimuthDegrees)}° ({azimuthToCompass(layoutOrientation.azimuthDegrees)}) /{' '}
                {Math.round(layoutOrientation.pitchDegrees)}°
              </p>
              <p className="text-xs text-muted-foreground">
                {layoutOrientation.segmentCount > 1
                  ? t('systemAssumptions.azimuthPitch.multiSegment', {
                      count: layoutOrientation.panelCount,
                      segments: layoutOrientation.segmentCount
                    })
                  : t('systemAssumptions.azimuthPitch.oneSegment', { count: layoutOrientation.panelCount })}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('systemAssumptions.dcAc.label')}
              <InfoTooltip text={t('systemAssumptions.dcAc.tooltip')} />
            </p>
            <p className="mt-1 text-lg font-semibold">{dcAcRatio}</p>
            <p className="text-xs text-muted-foreground">{t('systemAssumptions.dcAc.detail')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
