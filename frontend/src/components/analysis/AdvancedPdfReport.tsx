import { forwardRef } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { COLORS } from '@/lib/constants'
import { ANALYSIS_DISCLAIMERS, MONTH_LABELS, type AnalysisResultsRecord } from '@/lib/analysis'
import type { runAnnualSimulation } from '@/lib/billingEngine'
import type { PanelModel } from '@shared/types'
import { formatCurrency, formatNumber } from './formatters'

type AdvancedPdfReportProps = {
  projectName: string
  analysisResults: AnalysisResultsRecord
  simulation: ReturnType<typeof runAnnualSimulation>
  chartData: { month: string; baselineBill: number; nemBill: number }[]
  activePanelCount: number
  systemKwp: number
  selectedPanelModel: PanelModel | undefined
  formState: {
    monthlyConsumptionKwh: number
    connectionPhase: string
    systemCostRm: number
    afaRateSenPerKwh: number
    degradationRate: number
    consumptionProfile: string
  }
  location: { lat: number; lng: number } | null | undefined
}

const AdvancedPdfReport = forwardRef<HTMLDivElement, AdvancedPdfReportProps>(
  (
    {
      projectName,
      analysisResults,
      simulation,
      chartData,
      activePanelCount,
      systemKwp,
      selectedPanelModel,
      formState,
      location
    },
    ref
  ) => {
    return (
      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <div ref={ref} className="w-[794px] bg-white px-10 py-10 text-stone-900">
          <div className="space-y-8">
            <div className="flex items-start justify-between border-b border-stone-200 pb-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ea580c]">
                  <span className="text-xl font-bold text-white">S</span>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-stone-500">SolarSim</p>
                  <h1 className="mt-1 text-3xl font-semibold">{projectName}</h1>
                  <p className="mt-2 text-sm text-stone-500">
                    Generated on {new Date().toLocaleDateString('en-MY')} for rooftop solar financial analysis.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-stone-200 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Project Status</p>
                <p className="mt-1 text-lg font-semibold">Analysis Computed</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-stone-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">System Summary</p>
                <p className="mt-3 text-lg font-semibold">{formatNumber(systemKwp, 'kWp')}</p>
                <p className="text-sm text-stone-500">{activePanelCount} active panels</p>
                {selectedPanelModel && (
                  <p className="text-sm text-stone-500">
                    {selectedPanelModel.name} ({selectedPanelModel.capacityWp}Wp)
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-stone-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Financial Highlights</p>
                <p className="mt-3 text-lg font-semibold">
                  {formatCurrency(analysisResults.annualTotals.totalSavingsRm)}
                </p>
                <p className="text-sm text-stone-500">Annual savings</p>
              </div>
              <div className="rounded-2xl bg-stone-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Environmental Impact</p>
                <p className="mt-3 text-lg font-semibold">{formatNumber(analysisResults.carbonOffsetKg, 'kg')}</p>
                <p className="text-sm text-stone-500">Estimated CO2 offset per year</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-2xl border border-stone-200 p-4">
                <h2 className="text-lg font-semibold">Assumptions Used</h2>
                <div className="mt-4 space-y-2 text-sm">
                  {selectedPanelModel && (
                    <p>
                      Panel model: {selectedPanelModel.name} ({selectedPanelModel.capacityWp}Wp,{' '}
                      {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m)
                    </p>
                  )}
                  <p>
                    Monthly consumption: {formatNumber(formState.monthlyConsumptionKwh, 'kWh')} (
                    {formState.consumptionProfile === 'seasonal' ? 'seasonal profile' : 'flat'})
                  </p>
                  <p>Connection phase: {formState.connectionPhase === 'single' ? 'Single phase' : 'Three phase'}</p>
                  <p>System cost: {formatCurrency(formState.systemCostRm)}</p>
                  <p>AFA rate: {formatNumber(formState.afaRateSenPerKwh, 'sen/kWh')}</p>
                  <p>Degradation rate: {(formState.degradationRate * 100).toFixed(1)}%/year</p>
                  <p>Location: {location ? `${location.lat}, ${location.lng}` : 'N/A'}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-stone-200 p-4">
                <h2 className="text-lg font-semibold">Return Snapshot</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <p>Average monthly savings: {formatCurrency(analysisResults.averageMonthlySavingsRm)}</p>
                  <p>Simple payback: {formatNumber(analysisResults.paybackYears, 'years')}</p>
                  <p>10-year net benefit: {formatCurrency(analysisResults.tenYearNetBenefitRm)}</p>
                  <p>10-year ROI: {formatNumber(analysisResults.tenYearRoiPercent, '%')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4">
              <h2 className="text-lg font-semibold">Bill Comparison</h2>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Bar dataKey="baselineBill" fill={COLORS.pdfBaselineFill} />
                    <Bar dataKey="nemBill" fill={COLORS.pdfSolarFill} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4">
              <h2 className="text-lg font-semibold">Month-by-Month Breakdown</h2>
              <table className="mt-4 min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="px-2 py-2 font-medium">Month</th>
                    <th className="px-2 py-2 font-medium">Consumption</th>
                    <th className="px-2 py-2 font-medium">Generation</th>
                    <th className="px-2 py-2 font-medium">Baseline</th>
                    <th className="px-2 py-2 font-medium">NEM</th>
                    <th className="px-2 py-2 font-medium">Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.months.map((month, index) => (
                    <tr key={`report-${MONTH_LABELS[index]}`} className="border-b border-stone-100">
                      <td className="px-2 py-2">{MONTH_LABELS[index]}</td>
                      <td className="px-2 py-2">{formatNumber(month.consumptionKwh, 'kWh')}</td>
                      <td className="px-2 py-2">{formatNumber(month.generationKwh, 'kWh')}</td>
                      <td className="px-2 py-2">{formatCurrency(month.baselineBill.total)}</td>
                      <td className="px-2 py-2">{formatCurrency(month.nemBill.total)}</td>
                      <td className="px-2 py-2">{formatCurrency(month.savingsRm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4 text-sm text-stone-500">
              <h2 className="text-lg font-semibold text-stone-900">Disclaimer</h2>
              <div className="mt-3 space-y-2">
                {ANALYSIS_DISCLAIMERS.map((disclaimer) => (
                  <p key={`report-${disclaimer}`}>{disclaimer}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

AdvancedPdfReport.displayName = 'AdvancedPdfReport'

export default AdvancedPdfReport
