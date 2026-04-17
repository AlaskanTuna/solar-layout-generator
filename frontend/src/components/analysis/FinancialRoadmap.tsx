import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { formatCurrency } from './formatters'

type FinancialRoadmapProps = {
  systemCostRm: number
  paybackYears: number | null
  year1Savings: number
  degradationRate: number
  systemKwp: number
}

type Milestone = {
  label: string
  description: string
  accent: string
}

export function FinancialRoadmap({
  systemCostRm,
  paybackYears,
  year1Savings,
  degradationRate,
  systemKwp
}: FinancialRoadmapProps) {
  const outputAtYear25 = Math.round((1 - degradationRate) ** 24 * 100)
  // Midpoint of the RM 3,000–6,000 residential string inverter replacement range
  // Documented in MVP-PAGE-3-SOLAR-COST-MODEL.md §7. Flat figure since replacement
  // SKUs don't scale linearly with kWp for residential sizes.
  const estimatedInverterCost = 4500

  const milestones: Milestone[] = [
    {
      label: 'Year 0',
      description: `Initial investment of ${formatCurrency(systemCostRm)} for a ${systemKwp} kWp turnkey system (panels, inverter, mounting, wiring, labour and permitting).`,
      accent: 'bg-primary/20 border-primary/40'
    },
    {
      label: 'Year 1',
      description: `Estimated first-year savings of ${formatCurrency(year1Savings)} on your electricity bill through NEM credit offsets.`,
      accent: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
    }
  ]

  if (paybackYears !== null && paybackYears <= 25) {
    milestones.push({
      label: `Year ${paybackYears.toFixed(1)}`,
      description:
        'Break-even point — cumulative electricity savings exceed your initial system cost. Every ringgit saved beyond this is net profit.',
      accent: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
    })
  }

  milestones.push({
    label: 'Year 10–15',
    description: `String inverters typically need replacement in this window (~${formatCurrency(estimatedInverterCost)} based on your system size). This is not included in the payback calculation above.`,
    accent: 'bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-800'
  })

  milestones.push({
    label: 'Year 25',
    description: `Standard panel warranty period ends. At ${degradationRate * 100}%/yr degradation, your system still produces ~${outputAtYear25}% of its original output.`,
    accent: 'bg-muted border-border'
  })

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          Financial Roadmap
          <InfoTooltip text="A simplified timeline of key financial milestones for your solar investment. Actual results depend on tariff changes, maintenance, weather and equipment lifespan." />
        </CardTitle>
        <CardDescription>Key milestones for your solar investment over its lifetime.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {milestones.map((milestone) => (
          <div key={milestone.label} className={`rounded-lg border p-3 ${milestone.accent}`}>
            <p className="text-sm font-semibold">{milestone.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{milestone.description}</p>
          </div>
        ))}

        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keep in mind</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This roadmap does not account for electricity tariff escalation (which would shorten payback), annual
            maintenance costs (~RM 500/yr), or inflation. Malaysian tariffs have historically risen over time, meaning
            real-world savings may grow faster than projected.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
