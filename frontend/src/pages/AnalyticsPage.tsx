import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listProjects } from '@/api/projects'
import { StatCard } from '@/components/dashboard/StatCard'
import { aggregateStats } from '@/components/dashboard/helpers'
import { Receipt, Zap, Leaf, Sun, PieChart } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeaderCard } from '@/components/layout/PageHeaderCard'

export function AnalyticsPage() {
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  const totalProjects = projects?.length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'analysis_saved').length ?? 0
  const stats = useMemo(() => aggregateStats(projects ?? []), [projects])

  if (completedProjects === 0) {
    return (
      <PageContainer>
        <PageHeaderCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="mt-1 max-w-lg text-muted-foreground">Performance insights across all your projects</p>
            </div>
          </div>
        </PageHeaderCard>
        <div className="mt-6 glass-card flex flex-col items-center py-16 text-center">
          <PieChart className="h-12 w-12 text-muted-foreground/30" />
          <h2 className="mt-4 font-heading text-lg font-semibold">No data yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Complete at least one solar analysis to see aggregated performance metrics here.
          </p>
        </div>
      </PageContainer>
    )
  }

  const avgSavings = completedProjects > 0 ? stats.totalSavingsRm / completedProjects : 0
  const avgPanels = completedProjects > 0 ? stats.totalPanels / completedProjects : 0

  const paybackData = (projects ?? [])
    .filter((p) => p.status === 'analysis_saved' && p.analysisResults)
    .map((p) => {
      const r = p.analysisResults!
      return { name: p.name, payback: r.paybackYears ?? null, savings: r.averageMonthlySavingsRm ?? 0 }
    })

  return (
    <PageContainer>
      <PageHeaderCard>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="mt-1 max-w-lg text-muted-foreground">
              Aggregated performance across {completedProjects} completed project{completedProjects !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </PageHeaderCard>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label="Total Monthly Savings"
          value={`RM ${stats.totalSavingsRm.toFixed(0)}`}
          accent="text-green-600 dark:text-green-400"
          bg="bg-green-500/10 dark:bg-green-500/20"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Total Annual Energy"
          value={`${(stats.totalEnergyKwh / 1000).toFixed(1)} MWh`}
          accent="text-primary"
          bg="bg-primary/10"
        />
        <StatCard
          icon={<Leaf className="h-5 w-5" />}
          label="Total CO2 Offset"
          value={`${(stats.totalCarbonKg / 1000).toFixed(1)} t/yr`}
          accent="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10 dark:bg-emerald-500/20"
        />
        <StatCard
          icon={<Sun className="h-5 w-5" />}
          label="Total Panels"
          value={`${stats.totalPanels}`}
          accent="text-amber-600 dark:text-amber-400"
          bg="bg-amber-500/10 dark:bg-amber-500/20"
        />
      </div>

      <h2 className="mt-8 font-heading text-lg font-semibold">Averages per Project</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground">Avg. Monthly Savings</p>
          <p className="mt-1 font-heading text-xl font-bold text-green-600 dark:text-green-400">
            RM {avgSavings.toFixed(0)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground">Avg. Panels per Project</p>
          <p className="mt-1 font-heading text-xl font-bold">{avgPanels.toFixed(0)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground">Completion Rate</p>
          <p className="mt-1 font-heading text-xl font-bold text-primary">
            {totalProjects > 0 ? ((completedProjects / totalProjects) * 100).toFixed(0) : 0}%
          </p>
        </div>
      </div>

      <h2 className="mt-8 font-heading text-lg font-semibold">Project Breakdown</h2>
      <div className="mt-4 glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Project</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Savings/mo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Payback</th>
              </tr>
            </thead>
            <tbody>
              {paybackData.map((p, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-green-600 dark:text-green-400">RM {p.savings.toFixed(0)}</td>
                  <td className="px-4 py-3">{p.payback != null ? `${p.payback.toFixed(1)} yr` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  )
}
