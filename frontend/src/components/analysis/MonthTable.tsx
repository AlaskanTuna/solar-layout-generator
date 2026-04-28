import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { MONTH_LABELS } from '@/lib/analysis'
import { formatCurrency, formatNumber } from './formatters'
import type { runAnnualSimulation } from '@/lib/billingEngine'

type MonthTableProps = {
  simulation: ReturnType<typeof runAnnualSimulation>
  isOpen: boolean
  onToggle: () => void
}

export function MonthTable({ simulation, isOpen, onToggle }: MonthTableProps) {
  const { t } = useTranslation('analysis')

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>
          {t('monthTable.title')}
          <InfoTooltip text={t('monthTable.titleTooltip')} />
        </CardTitle>
        <CardDescription>{t('monthTable.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          className="pdf-hide flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
          onClick={onToggle}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {t('monthTable.toggleLabel', { action: isOpen ? t('monthTable.collapse') : t('monthTable.expand') })}
        </button>
        {isOpen && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.month')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.consumption')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.generation')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.netImport')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.creditUsed')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.creditBalance')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.baselineBill')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.nemSavings')}</th>
                  <th className="px-3 py-2 font-medium">{t('monthTable.columns.totalBill')}</th>
                </tr>
              </thead>
              <tbody>
                {simulation.months.map((month, index) => (
                  <tr key={MONTH_LABELS[index]} className="border-b border-border">
                    <td className="px-3 py-2 font-medium">{MONTH_LABELS[index]}</td>
                    <td className="px-3 py-2">{formatNumber(month.consumptionKwh, 'kWh')}</td>
                    <td className="px-3 py-2">{formatNumber(month.generationKwh, 'kWh')}</td>
                    <td className="px-3 py-2">{formatNumber(month.consumptionKwh - month.generationKwh, 'kWh')}</td>
                    <td className="px-3 py-2">{formatNumber(month.creditUsed, 'kWh')}</td>
                    <td className="px-3 py-2">{formatNumber(month.creditBalance, 'kWh')}</td>
                    <td className="px-3 py-2">{formatCurrency(month.baselineBill.total)}</td>
                    <td className="px-3 py-2 text-emerald-700">{formatCurrency(month.savingsRm)}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-700">{formatCurrency(month.nemBill.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
