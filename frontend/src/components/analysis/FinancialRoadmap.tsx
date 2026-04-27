import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { normalizeInverterReplacements, type InverterReplacement } from '@/lib/analysis'
import { formatCurrency } from './formatters'

type FinancialRoadmapProps = {
  systemCostRm: number
  paybackYears: number | null
  year1Savings: number
  degradationRate: number
  systemKwp: number
  /** Compounding tariff escalation rate, e.g. 0.04 = 4%/year. Defaults to 0. */
  tariffEscalationRate?: number
  /** Active financial mode. Lifecycle adds the maintenance + inverter milestones and footer; Simple hides them. */
  analysisMode?: 'simple' | 'lifecycle'
  /** Each entry is one planned inverter swap rendered as its own milestone in Lifecycle mode. */
  inverterReplacements?: InverterReplacement[]
  /** @deprecated Pass `inverterReplacements` instead. */
  inverterReplacementCostRm?: number
  /** @deprecated Pass `inverterReplacements` instead. */
  inverterReplacementYear?: number
  annualMaintenanceRm?: number
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
  systemKwp,
  tariffEscalationRate = 0,
  analysisMode = 'simple',
  inverterReplacements,
  inverterReplacementCostRm,
  inverterReplacementYear,
  annualMaintenanceRm
}: FinancialRoadmapProps) {
  const outputAtYear25 = Math.round((1 - degradationRate) ** 24 * 100)
  const lifecycleActive = analysisMode === 'lifecycle'
  const maintenancePerYear = annualMaintenanceRm && annualMaintenanceRm > 0 ? annualMaintenanceRm : 500
  const replacements = normalizeInverterReplacements(
    inverterReplacements,
    inverterReplacementCostRm,
    inverterReplacementYear
  )
  const replacementsWithin25 = replacements.filter((r) => r.year <= 25)
  const replacementCostTotal = replacementsWithin25.reduce((sum, r) => sum + r.costRm, 0)

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
        'Break-even point. Your cumulative electricity savings have now covered the system cost. Every ringgit saved beyond this is net profit.',
      accent: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
    })
  }

  if (lifecycleActive && replacementsWithin25.length > 0) {
    replacementsWithin25.forEach((r, idx) => {
      const ordinal = replacementsWithin25.length === 1 ? 'Inverter replacement' : `Inverter replacement #${idx + 1}`
      milestones.push({
        label: `Year ${r.year}`,
        description: `${ordinal} of ~${formatCurrency(r.costRm)} subtracted from your cumulative savings. The payback figure above already reflects this cost.`,
        accent: 'bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-800'
      })
    })
  }

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
          <InfoTooltip text="A simplified timeline of key money milestones for your solar investment. Real-world results will shift based on tariff changes, maintenance, weather, and equipment lifespan." />
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

        <p className="mt-4 text-xs text-muted-foreground">
          {lifecycleActive
            ? `Lifecycle mode subtracts ~${formatCurrency(maintenancePerYear)}/yr maintenance${
                replacementsWithin25.length > 0
                  ? ` and ${replacementsWithin25.length} inverter replacement${replacementsWithin25.length === 1 ? '' : 's'} totalling ~${formatCurrency(replacementCostTotal)}`
                  : ''
              } from your cumulative savings.${
                tariffEscalationRate > 0
                  ? ` Projection also applies ${(tariffEscalationRate * 100).toFixed(1)}%/yr tariff escalation.`
                  : ''
              }`
            : tariffEscalationRate > 0
              ? `Projection applies ${(tariffEscalationRate * 100).toFixed(1)}%/yr tariff escalation. Switch Financial Mode to Lifecycle to also factor in maintenance and inverter replacements.`
              : 'Switch Financial Mode to Lifecycle to factor in yearly maintenance and inverter replacements.'}
        </p>
      </CardContent>
    </Card>
  )
}
