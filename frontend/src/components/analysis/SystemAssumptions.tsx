import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

type RoofSegmentStat = { azimuthDegrees: number; pitchDegrees: number }

type SystemAssumptionsProps = {
  performanceRatio: number
  assumedLosses: number
  degradationRate: number
  dcAcRatio: number
  panelLifetimeYears: number | null | undefined
  roofSegmentStats: RoofSegmentStat[]
}

function azimuthToCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

export function SystemAssumptions({
  performanceRatio,
  assumedLosses,
  degradationRate,
  dcAcRatio,
  panelLifetimeYears,
  roofSegmentStats
}: SystemAssumptionsProps) {
  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          System Assumptions
          <InfoTooltip text="Technical parameters used by Google Solar API and industry standards. These include building orientation, tilt angles, panel characteristics and environmental factors specific to your location." />
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
              <InfoTooltip text="The percentage of theoretical solar output your system actually delivers, accounting for real-world inefficiencies." />
            </p>
            <p className="mt-1 text-lg font-semibold">{Math.round(performanceRatio * 100)}%</p>
            <p className="text-xs text-muted-foreground">Typical for Malaysian residential systems</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assumed Losses
              <InfoTooltip text="Energy lost to dust, wiring, inverter conversion and heat. This is automatically calculated as 100% minus the Performance Ratio." />
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
                <InfoTooltip text="How long the panels are expected to generate electricity. Payback must happen within this period for the investment to be worthwhile." />
              </p>
              <p className="mt-1 text-lg font-semibold">{panelLifetimeYears} years</p>
              <p className="text-xs text-muted-foreground">From Google Solar API estimate</p>
            </div>
          )}
          {roofSegmentStats.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Roof Azimuth / Pitch
                <InfoTooltip text="Azimuth is the compass direction your roof faces. Pitch is how steep your roof is." />
              </p>
              <p className="mt-1 text-lg font-semibold">
                {Math.round(roofSegmentStats[0].azimuthDegrees)}° (
                {azimuthToCompass(roofSegmentStats[0].azimuthDegrees)}) / {Math.round(roofSegmentStats[0].pitchDegrees)}
                °
              </p>
              <p className="text-xs text-muted-foreground">Primary roof segment (from Solar API)</p>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              DC/AC Ratio
              <InfoTooltip text="The ratio of panel capacity to inverter capacity. A ratio of 1.2 means slightly more panel power than the inverter can handle at peak, which maximises output across the day." />
            </p>
            <p className="mt-1 text-lg font-semibold">{dcAcRatio}</p>
            <p className="text-xs text-muted-foreground">Standard residential inverter sizing</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
