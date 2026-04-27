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
  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          System Assumptions
          <InfoTooltip text="The technical inputs feeding this analysis. Some come from Google Solar API for your roof, others are industry-standard defaults used across Malaysian residential systems." />
        </CardTitle>
        <CardDescription>
          Standard industry assumptions used in this analysis (not site-measured values).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Performance Ratio
              <InfoTooltip text="How much of the panels' rated output actually reaches your meter after real-world losses. A higher number means better real-world performance." />
            </p>
            <p className="mt-1 text-lg font-semibold">{Math.round(performanceRatio * 100)}%</p>
            <p className="text-xs text-muted-foreground">Typical for Malaysian residential systems</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assumed Losses
              <InfoTooltip text="The share of generation lost to dust, wiring, heat, and inverter conversion. Calculated automatically as 100% minus the Performance Ratio." />
            </p>
            <p className="mt-1 text-lg font-semibold">{Math.round(assumedLosses * 100)}%</p>
            <p className="text-xs text-muted-foreground">Soiling, cable, inverter, temperature</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Panel Degradation</p>
            <p className="mt-1 text-lg font-semibold">{(degradationRate * 100).toFixed(1)}%/yr</p>
            <p className="text-xs text-muted-foreground">Annual output decline (N-type ~0.5%)</p>
          </div>
          {panelLifetimeYears != null && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Panel Lifetime
                <InfoTooltip text="How long the panels are expected to keep generating. Your payback should land well within this window for the system to be worthwhile." />
              </p>
              <p className="mt-1 text-lg font-semibold">{panelLifetimeYears} years</p>
              <p className="text-xs text-muted-foreground">From Google Solar API estimate</p>
            </div>
          )}
          {layoutOrientation && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Azimuth / Pitch
                <InfoTooltip text="The average direction (azimuth) and tilt (pitch) of your active panels, weighted by panel count across the roof segments they sit on. Updates as you add, remove, or move panels in the Workbench." />
              </p>
              <p className="mt-1 text-lg font-semibold">
                {Math.round(layoutOrientation.azimuthDegrees)}° ({azimuthToCompass(layoutOrientation.azimuthDegrees)}) /{' '}
                {Math.round(layoutOrientation.pitchDegrees)}°
              </p>
              <p className="text-xs text-muted-foreground">
                {layoutOrientation.segmentCount > 1
                  ? `${layoutOrientation.panelCount} panels across ${layoutOrientation.segmentCount} roof segments`
                  : `${layoutOrientation.panelCount} panels on one roof segment`}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              DC/AC Ratio
              <InfoTooltip text="How much panel capacity is paired with each unit of inverter capacity. A value above 1.0 means slightly oversizing the panels, which lifts daily output without a bigger inverter." />
            </p>
            <p className="mt-1 text-lg font-semibold">{dcAcRatio}</p>
            <p className="text-xs text-muted-foreground">Standard residential inverter sizing</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
