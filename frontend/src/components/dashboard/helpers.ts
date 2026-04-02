import type { ProjectResponse } from '@/api/projects'

export type AggregatedStats = {
  totalSavingsRm: number
  totalCarbonKg: number
  totalEnergyKwh: number
  totalPanels: number
}

export function aggregateStats(projects: ProjectResponse[]): AggregatedStats {
  const stats: AggregatedStats = { totalSavingsRm: 0, totalCarbonKg: 0, totalEnergyKwh: 0, totalPanels: 0 }
  for (const p of projects) {
    if (p.status !== 'analysis_saved' || !p.analysisResults) continue
    const r = p.analysisResults as Record<string, number>
    stats.totalSavingsRm += r.averageMonthlySavingsRm ?? 0
    stats.totalCarbonKg += r.carbonOffsetKg ?? 0
    stats.totalPanels += r.activePanelCount ?? 0
    const totals = (p.analysisResults as Record<string, Record<string, number>>).annualTotals
    if (totals) stats.totalEnergyKwh += totals.totalGenerationKwh ?? 0
  }
  return stats
}

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
