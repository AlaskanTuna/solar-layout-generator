import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/InfoTooltip'
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
  return (
    <Card className="border-stone-200 bg-white/90 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Bill Component Breakdown</CardTitle>
            <CardDescription>
              See how your TNB bill is calculated — select a month to compare charges with and without solar.
            </CardDescription>
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
            {thresholdWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {/* "Without Solar" column */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
          <h3 className="text-sm font-semibold text-stone-900">Without Solar</h3>
          <p className="text-xs text-stone-400">What you'd pay at full consumption</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-stone-500">
                Energy <InfoTooltip text={BILL_TOOLTIPS.energy} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.energy)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                Capacity <InfoTooltip text={BILL_TOOLTIPS.capacity} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.capacity)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                Network <InfoTooltip text={BILL_TOOLTIPS.network} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.network)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                Retail <InfoTooltip text={BILL_TOOLTIPS.retail} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.retail)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                AFA <InfoTooltip text={BILL_TOOLTIPS.afa} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.afa)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                EEI Rebate <InfoTooltip text={BILL_TOOLTIPS.eeiRebate} />
              </p>
              <p className="font-semibold">-{formatCurrency(selectedMonth.baselineBill.eeiRebate)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                RE Fund <InfoTooltip text={BILL_TOOLTIPS.reFund} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.reFund)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                SST <InfoTooltip text={BILL_TOOLTIPS.sst} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.baselineBill.sst)}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-stone-200 pt-3">
            <p className="text-sm text-stone-500">
              Total
              <InfoTooltip text="Energy + Capacity + Network + Retail + AFA − EEI Rebate + RE Fund + SST" />
            </p>
            <p className="text-xl font-semibold">{formatCurrency(selectedMonth.baselineBill.total)}</p>
          </div>
        </div>

        {/* "With Solar" column */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <h3 className="text-sm font-semibold text-emerald-950">With Solar</h3>
          <p className="text-xs text-emerald-800/50">Your bill after solar offsets your usage under NEM</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-emerald-900/70">
                Billable kWh <InfoTooltip text={NEM_TOOLTIPS.billableKwh} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.billableKwh, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Credit Used <InfoTooltip text={NEM_TOOLTIPS.creditUsed} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.creditUsed, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Credit Balance <InfoTooltip text={NEM_TOOLTIPS.creditBalance} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.creditBalance, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Credit Forfeited <InfoTooltip text={NEM_TOOLTIPS.creditForfeited} />
              </p>
              <p className="font-semibold">{formatNumber(selectedMonth.creditForfeited, 'kWh')}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Energy <InfoTooltip text={BILL_TOOLTIPS.energy} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.energy)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Retail <InfoTooltip text={BILL_TOOLTIPS.retail} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.retail)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Capacity <InfoTooltip text={BILL_TOOLTIPS.capacity} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.capacity)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                AFA <InfoTooltip text={BILL_TOOLTIPS.afa} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.afa)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                Network <InfoTooltip text={BILL_TOOLTIPS.network} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.network)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                EEI Rebate <InfoTooltip text={BILL_TOOLTIPS.eeiRebate} />
              </p>
              <p className="font-semibold">-{formatCurrency(selectedMonth.nemBill.eeiRebate)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                RE Fund <InfoTooltip text={BILL_TOOLTIPS.reFund} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.reFund)}</p>
            </div>
            <div>
              <p className="text-emerald-900/70">
                SST <InfoTooltip text={BILL_TOOLTIPS.sst} />
              </p>
              <p className="font-semibold">{formatCurrency(selectedMonth.nemBill.sst)}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-emerald-200 pt-3">
            <p className="text-sm text-emerald-900/70">
              Total
              <InfoTooltip
                text={`${formatCurrency(selectedMonth.baselineBill.total)} (without solar) − ${formatCurrency(selectedMonth.savingsRm)} (savings) = ${formatCurrency(selectedMonth.nemBill.total)}`}
              />
            </p>
            <p className="text-xl font-semibold text-emerald-950">{formatCurrency(selectedMonth.nemBill.total)}</p>
            <p className="text-xs text-emerald-700">You save {formatCurrency(selectedMonth.savingsRm)} this month</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
