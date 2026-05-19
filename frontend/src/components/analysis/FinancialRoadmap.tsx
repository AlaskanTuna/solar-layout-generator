/**
 * Financial milestone card for the analysis results page.
 * Summarizes system cost recovery, first-year savings, and lifecycle cash events for Malaysian solar projects.
 */

import { useTranslation } from 'react-i18next'
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
  /** Compounding tariff escalation rate, e.g. 0.04 = 4%/year */
  tariffEscalationRate?: number
  /** Active financial mode */
  analysisMode?: 'simple' | 'lifecycle'
  /** Each entry is one planned inverter swap rendered in Lifecycle mode */
  inverterReplacements?: InverterReplacement[]
  /** @deprecated Pass `inverterReplacements` instead */
  inverterReplacementCostRm?: number
  /** @deprecated Pass `inverterReplacements` instead */
  inverterReplacementYear?: number
  annualMaintenanceRm?: number
}

type Milestone = {
  label: string
  description: string
  accent: string
}

/**
 * Renders payback and lifecycle milestones from the current analysis assumptions.
 * Expects RM system cost, savings, kWp size, degradation, and optional maintenance or inverter events.
 */
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
  const { t } = useTranslation('analysis')
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
      label: t('financialRoadmap.milestones.year0.label'),
      description: t('financialRoadmap.milestones.year0.description', {
        cost: formatCurrency(systemCostRm),
        kwp: systemKwp
      }),
      accent: 'bg-primary/20 border-primary/40'
    },
    {
      label: t('financialRoadmap.milestones.year1.label'),
      description: t('financialRoadmap.milestones.year1.description', { savings: formatCurrency(year1Savings) }),
      accent: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
    }
  ]

  if (paybackYears !== null && paybackYears <= 25) {
    milestones.push({
      label: t('financialRoadmap.milestones.breakEven.label', { years: paybackYears.toFixed(1) }),
      description: t('financialRoadmap.milestones.breakEven.description'),
      accent: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
    })
  }

  if (lifecycleActive && replacementsWithin25.length > 0) {
    replacementsWithin25.forEach((r, idx) => {
      const replacementLabel =
        replacementsWithin25.length === 1
          ? t('financialRoadmap.milestones.inverterReplacement.single')
          : t('financialRoadmap.milestones.inverterReplacement.numbered', { index: idx + 1 })
      milestones.push({
        label: `Year ${r.year}`,
        description: t('financialRoadmap.milestones.inverterReplacement.description', {
          label: replacementLabel,
          cost: formatCurrency(r.costRm)
        }),
        accent: 'bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-800'
      })
    })
  }

  milestones.push({
    label: t('financialRoadmap.milestones.year25.label'),
    description: t('financialRoadmap.milestones.year25.description', {
      rate: degradationRate * 100,
      output: outputAtYear25
    }),
    accent: 'bg-muted border-border'
  })

  let footerText: string
  if (lifecycleActive) {
    const replacementsSuffix =
      replacementsWithin25.length > 0
        ? t('financialRoadmap.footer.replacementsSuffix', {
            count: replacementsWithin25.length,
            plural: replacementsWithin25.length === 1 ? '' : 's',
            total: formatCurrency(replacementCostTotal)
          })
        : ''
    footerText =
      t('financialRoadmap.footer.lifecycle', {
        maintenance: formatCurrency(maintenancePerYear),
        replacements: replacementsSuffix
      }) +
      (tariffEscalationRate > 0
        ? t('financialRoadmap.footer.escalationSuffix', { rate: (tariffEscalationRate * 100).toFixed(1) })
        : '')
  } else if (tariffEscalationRate > 0) {
    footerText = t('financialRoadmap.footer.simpleWithEscalation', { rate: (tariffEscalationRate * 100).toFixed(1) })
  } else {
    footerText = t('financialRoadmap.footer.simpleNoEscalation')
  }

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          {t('financialRoadmap.title')}
          <InfoTooltip text={t('financialRoadmap.titleTooltip')} />
        </CardTitle>
        <CardDescription>{t('financialRoadmap.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {milestones.map((milestone) => (
          <div key={milestone.label} className={`rounded-lg border p-3 ${milestone.accent}`}>
            <p className="text-sm font-semibold">{milestone.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{milestone.description}</p>
          </div>
        ))}

        <p className="mt-4 text-xs text-muted-foreground">{footerText}</p>
      </CardContent>
    </Card>
  )
}
