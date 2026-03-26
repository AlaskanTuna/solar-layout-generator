import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MONTH_LABELS } from '@/lib/analysis'
import { formatCurrency, formatNumber } from './formatters'
import type { runAnnualSimulation } from '@/lib/billingEngine'

type MonthTableProps = {
  simulation: ReturnType<typeof runAnnualSimulation>
  isOpen: boolean
  onToggle: () => void
}

export function MonthTable({ simulation, isOpen, onToggle }: MonthTableProps) {
  return (
    <Card className="border-stone-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Month-by-Month Breakdown</CardTitle>
        <CardDescription>Detailed billing inputs, credits, and savings for every month.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-stone-900"
          onClick={onToggle}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {isOpen ? 'Collapse' : 'Expand'} the full billing table
        </button>
        {isOpen && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Consumption</th>
                  <th className="px-3 py-2 font-medium">Generation</th>
                  <th className="px-3 py-2 font-medium">Net Import</th>
                  <th className="px-3 py-2 font-medium">Credit Used</th>
                  <th className="px-3 py-2 font-medium">Credit Balance</th>
                  <th className="px-3 py-2 font-medium">Baseline Bill</th>
                  <th className="px-3 py-2 font-medium">NEM Savings</th>
                  <th className="px-3 py-2 font-medium">Total Bill</th>
                </tr>
              </thead>
              <tbody>
                {simulation.months.map((month, index) => (
                  <tr key={MONTH_LABELS[index]} className="border-b border-stone-100">
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
