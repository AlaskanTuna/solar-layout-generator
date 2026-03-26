import { forwardRef } from 'react'
import type { AnalysisResultsRecord } from '@/lib/analysis'
import type { runAnnualSimulation } from '@/lib/billingEngine'
import { formatCurrency, formatNumber } from './formatters'

type SimplePdfReportProps = {
  projectName: string
  analysisResults: AnalysisResultsRecord
  simulation: ReturnType<typeof runAnnualSimulation>
  activePanelCount: number
  systemKwp: number
  systemCostRm: number
}

const SimplePdfReport = forwardRef<HTMLDivElement, SimplePdfReportProps>(
  ({ projectName, analysisResults, simulation, activePanelCount, systemKwp, systemCostRm }, ref) => {
    return (
      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <div
          ref={ref}
          className="w-[210mm] bg-white p-8 text-stone-900"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <h1 className="text-2xl font-bold">Solar Savings Report</h1>
          <p className="mt-1 text-sm text-stone-500">
            {projectName} &middot; Generated {new Date().toLocaleDateString('en-MY')}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm text-stone-600">Monthly Savings</p>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(analysisResults.averageMonthlySavingsRm)}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-sm text-stone-600">Payback Period</p>
              <p className="text-xl font-bold text-amber-700">{formatNumber(analysisResults.paybackYears, 'years')}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-sm text-stone-600">CO&#8322; Offset</p>
              <p className="text-xl font-bold text-blue-700">{formatNumber(analysisResults.carbonOffsetKg, 'kg/yr')}</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-stone-200 p-4">
            <p className="text-sm leading-relaxed">
              By installing <strong>{activePanelCount} solar panels</strong> ({formatNumber(systemKwp, 'kWp')} system),
              you could save approximately <strong>{formatCurrency(analysisResults.averageMonthlySavingsRm)}</strong>{' '}
              per month on your electricity bill. The system would pay for itself in approximately{' '}
              <strong>{formatNumber(analysisResults.paybackYears, 'years')}</strong>, after which all savings go
              directly to you. Over 10 years, you could save a total of{' '}
              <strong>{formatCurrency(analysisResults.tenYearNetBenefitRm + systemCostRm)}</strong>.
            </p>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">Monthly Bill Comparison</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-300">
                  <th className="py-2 text-left">Month</th>
                  <th className="py-2 text-right">Without Solar</th>
                  <th className="py-2 text-right">With Solar</th>
                  <th className="py-2 text-right">Savings</th>
                </tr>
              </thead>
              <tbody>
                {simulation.months.map((m, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-1.5">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
                    </td>
                    <td className="py-1.5 text-right">{formatCurrency(m.baselineBill.total)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.nemBill.total)}</td>
                    <td className="py-1.5 text-right text-green-700">{formatCurrency(m.savingsRm)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300 font-semibold">
                  <td className="py-2">Annual Total</td>
                  <td className="py-2 text-right">{formatCurrency(analysisResults.annualTotals.totalBaselineRm)}</td>
                  <td className="py-2 text-right">{formatCurrency(analysisResults.annualTotals.totalNemRm)}</td>
                  <td className="py-2 text-right text-green-700">
                    {formatCurrency(analysisResults.annualTotals.totalSavingsRm)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-6 text-[10px] text-stone-400">
            This is a preliminary estimate based on Google Solar API data and Malaysian NEM Rakyat 3.0 tariff rates.
            Actual savings depend on real electricity usage, installation quality, and tariff changes. Consult a
            licensed solar installer for an accurate quotation.
          </p>
        </div>
      </div>
    )
  }
)

SimplePdfReport.displayName = 'SimplePdfReport'

export default SimplePdfReport
