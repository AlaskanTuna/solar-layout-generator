import type { ProjectResponse } from '@/api/projects'

/** Portfolio stats aggregated across the user's completed projects. */
export type PortfolioStats = {
  /** Sum of average monthly savings (RM) across completed projects. */
  totalMonthlySavingsRm: number
  /** Sum of annual generation (kWh) across completed projects. */
  totalAnnualGenerationKwh: number
  /** Sum of 25-year net benefit (RM) across completed projects. */
  total25YrNetBenefitRm: number
  /** Sum of CO2 offset (kg/yr) across completed projects. */
  totalCarbonKg: number
  /** Sum of active panels across completed projects. */
  totalPanels: number
  /** Mean payback (yr) across projects with a finite payback; null if none. */
  avgPaybackYears: number | null
  /** Mean 10-year ROI (%); null if no project reports one. */
  avg10YrRoiPercent: number | null
  /** Mean monthly bill reduction (%); null if no project reports one. */
  avgBillReductionPct: number | null
  /** Best (lowest) finite payback across projects (yr). */
  bestPaybackYears: number | null
  /** Worst (highest) finite payback across projects (yr). */
  worstPaybackYears: number | null
  /** Project name with the best payback. */
  bestProjectName: string | null
  /** Number of completed projects considered. */
  completedCount: number
}

/** Aggregates portfolio-level KPIs across all completed projects. */
export function aggregatePortfolio(projects: ProjectResponse[]): PortfolioStats {
  const completed = projects.filter((p) => p.status === 'analysis_saved' && p.analysisResults)
  const stats: PortfolioStats = {
    totalMonthlySavingsRm: 0,
    totalAnnualGenerationKwh: 0,
    total25YrNetBenefitRm: 0,
    totalCarbonKg: 0,
    totalPanels: 0,
    avgPaybackYears: null,
    avg10YrRoiPercent: null,
    avgBillReductionPct: null,
    bestPaybackYears: null,
    worstPaybackYears: null,
    bestProjectName: null,
    completedCount: completed.length
  }

  let paybackSum = 0
  let paybackCount = 0
  let roiSum = 0
  let roiCount = 0
  let pctSum = 0
  let pctCount = 0

  for (const p of completed) {
    const r = p.analysisResults!
    stats.totalMonthlySavingsRm += r.averageMonthlySavingsRm ?? 0
    stats.totalAnnualGenerationKwh += r.annualTotals?.totalGenerationKwh ?? 0
    stats.total25YrNetBenefitRm += r.twentyFiveYearNetBenefitRm ?? 0
    stats.totalCarbonKg += r.carbonOffsetKg ?? 0
    stats.totalPanels += r.activePanelCount ?? 0

    if (r.paybackYears != null && Number.isFinite(r.paybackYears)) {
      paybackSum += r.paybackYears
      paybackCount += 1
      if (stats.bestPaybackYears == null || r.paybackYears < stats.bestPaybackYears) {
        stats.bestPaybackYears = r.paybackYears
        stats.bestProjectName = p.name
      }
      if (stats.worstPaybackYears == null || r.paybackYears > stats.worstPaybackYears) {
        stats.worstPaybackYears = r.paybackYears
      }
    }
    if (r.tenYearRoiPercent != null && Number.isFinite(r.tenYearRoiPercent)) {
      roiSum += r.tenYearRoiPercent
      roiCount += 1
    }
    if (r.averageMonthlySavingsPct != null && Number.isFinite(r.averageMonthlySavingsPct)) {
      pctSum += r.averageMonthlySavingsPct
      pctCount += 1
    }
  }

  if (paybackCount > 0) stats.avgPaybackYears = paybackSum / paybackCount
  if (roiCount > 0) stats.avg10YrRoiPercent = roiSum / roiCount
  if (pctCount > 0) stats.avgBillReductionPct = pctSum / pctCount
  return stats
}

/** Shared helpers export */
export function projectRoute(p: ProjectResponse): string {
  switch (p.status) {
    case 'analysis_saved':
      return `/project/${p.id}/analysis`
    case 'layout_saved':
      return `/project/${p.id}/workbench`
    default:
      return `/project/${p.id}/map`
  }
}

/** Shared helpers export */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}
