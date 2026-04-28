import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { MONTH_LABELS } from '@/lib/analysis'
import { formatCurrency, formatNumber, BILL_TOOLTIPS, NEM_TOOLTIPS } from './formatters'
import type { runAnnualSimulation } from '@/lib/billingEngine'

type SimulationMonth = ReturnType<typeof runAnnualSimulation>['months'][number]

type BillBreakdownProps = {
  selectedMonthIndex: number
  onMonthSelect: (index: number) => void
  selectedMonth: SimulationMonth
  thresholdWarnings: string[]
}

export function BillBreakdown({
  selectedMonthIndex,
  onMonthSelect,
  selectedMonth,
  thresholdWarnings
}: BillBreakdownProps) {
  const { t } = useTranslation('analysis')

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>
              {t('billBreakdown.title')}
              <InfoTooltip>
                <div className="space-y-2">
                  <p>{t('billBreakdown.titleTooltip.intro')}</p>
                  <p>
                    {t('billBreakdown.titleTooltip.threshold', { threshold: 600 })}
                  </p>
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">{t('billBreakdown.titleTooltip.retail')}</span>{' '}
                      {t('billBreakdown.titleTooltip.retailDetail')}
                    </p>
                    <p>
                      <span className="font-semibold">{t('billBreakdown.titleTooltip.afa')}</span>{' '}
                      {t('billBreakdown.titleTooltip.afaDetail')}
                    </p>
                    <p>
                      <span className="font-semibold">{t('billBreakdown.titleTooltip.sst')}</span>{' '}
                      {t('billBreakdown.titleTooltip.sstDetail')}
                    </p>
                  </div>
                  <p className="text-primary-foreground/80">{t('billBreakdown.titleTooltip.tierNote')}</p>
                </div>
              </InfoTooltip>
            </CardTitle>
            <CardDescription>{t('billBreakdown.description')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {MONTH_LABELS.map((label, index) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={selectedMonthIndex === index ? 'default' : 'outline'}
                onClick={() => onMonthSelect(index)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {thresholdWarnings.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">{t('billBreakdown.thresholdWarning.title')}</p>
            {thresholdWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {/* "Without Solar" column */}
        <div className="rounded-xl border border-border bg-muted/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t('billBreakdown.withoutSolar.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('billBreakdown.withoutSolar.subtitle')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.energy')} <InfoTooltip text={BILL_TOOLTIPS.energy} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.energy)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.capacity')} <InfoTooltip text={BILL_TOOLTIPS.capacity} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.capacity)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.network')} <InfoTooltip text={BILL_TOOLTIPS.network} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.network)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.retail')} <InfoTooltip text={BILL_TOOLTIPS.retail} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.retail)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.afa')} <InfoTooltip text={BILL_TOOLTIPS.afa} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.afa)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.eeiRebate')} <InfoTooltip text={BILL_TOOLTIPS.eeiRebate} />
              </p>
              <p className="font-semibold">-{formatCurrency(selectedMonth.baselineBill.eeiRebate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.reFund')} <InfoTooltip text={BILL_TOOLTIPS.reFund} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.reFund)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {t('billBreakdown.fields.sst')} <InfoTooltip text={BILL_TOOLTIPS.sst} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.sst)}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              {t('billBreakdown.fields.total')}
              <InfoTooltip text={t('billBreakdown.fields.totalTooltipFormula')} />
            </p>
            <p className="text-xl font-semibold">{formatCurrency(selectedMonth.baselineBill.total)}</p>
          </div>
        </div>

        {/* "With Solar" column */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/35">
          <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">{t('billBreakdown.withSolar.title')}</h3>
          <p className="text-xs text-emerald-800/70 dark:text-emerald-200/75">{t('billBreakdown.withSolar.subtitle')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.billableKwh')} <InfoTooltip text={NEM_TOOLTIPS.billableKwh} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.billableKwh, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.creditUsed')} <InfoTooltip text={NEM_TOOLTIPS.creditUsed} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.creditUsed, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.creditBalance')} <InfoTooltip text={NEM_TOOLTIPS.creditBalance} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.creditBalance, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.creditForfeited')} <InfoTooltip text={NEM_TOOLTIPS.creditForfeited} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.creditForfeited, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.energy')} <InfoTooltip text={BILL_TOOLTIPS.energy} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.energy)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.retail')} <InfoTooltip text={BILL_TOOLTIPS.retail} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.retail)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.capacity')} <InfoTooltip text={BILL_TOOLTIPS.capacity} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.capacity)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.afa')} <InfoTooltip text={BILL_TOOLTIPS.afa} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.afa)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.network')} <InfoTooltip text={BILL_TOOLTIPS.network} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.network)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.eeiRebate')} <InfoTooltip text={BILL_TOOLTIPS.eeiRebate} />
              </p>
              <p className="font-semibold">-{formatCurrency(selectedMonth.nemBill.eeiRebate)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.reFund')} <InfoTooltip text={BILL_TOOLTIPS.reFund} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.reFund)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70 dark:text-emerald-100/70">
                {t('billBreakdown.fields.sst')} <InfoTooltip text={BILL_TOOLTIPS.sst} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.sst)}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-emerald-200 pt-3 dark:border-emerald-900/60">
            <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70">
              {t('billBreakdown.fields.total')}
              <InfoTooltip
                text={t('billBreakdown.fields.totalTooltipTemplate', {
                  baseline: formatCurrency(selectedMonth.baselineBill.total),
                  savings: formatCurrency(selectedMonth.savingsRm),
                  total: formatCurrency(selectedMonth.nemBill.total)
                })}
              />
            </p>
            <p className="text-xl font-semibold text-emerald-950 dark:text-emerald-50">
              {formatCurrency(selectedMonth.nemBill.total)}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-200">
              {t('billBreakdown.fields.youSave', { amount: formatCurrency(selectedMonth.savingsRm) })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
