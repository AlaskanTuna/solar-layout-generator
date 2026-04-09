import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listProjects } from '@/api/projects'
import { StatCard } from '@/components/dashboard/StatCard'
import { aggregateStats } from '@/components/dashboard/helpers'
import { Receipt, Zap, Leaf, Sun } from 'lucide-react'

export function SummaryPage() {
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  const totalProjects = projects?.length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'analysis_saved').length ?? 0
  const inProgress = totalProjects - completedProjects
  const stats = useMemo(() => aggregateStats(projects ?? []), [projects])

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold tracking-tight">Summary</h1>
      <p className="mt-1 text-sm text-muted-foreground">Overview of your solar portfolio performance</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label="Monthly Savings"
          value={`RM ${stats.totalSavingsRm.toFixed(0)}`}
          accent="text-green-600 dark:text-green-400"
          bg="bg-green-500/10 dark:bg-green-500/20"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Annual Energy"
          value={`${(stats.totalEnergyKwh / 1000).toFixed(1)} MWh`}
          accent="text-primary"
          bg="bg-primary/10"
        />
        <StatCard
          icon={<Leaf className="h-5 w-5" />}
          label="CO2 Offset"
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

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground">Total Projects</p>
          <p className="mt-1 font-heading text-xl font-bold">{totalProjects}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="mt-1 font-heading text-xl font-bold text-green-600 dark:text-green-400">{completedProjects}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground">In Progress</p>
          <p className="mt-1 font-heading text-xl font-bold text-amber-600 dark:text-amber-400">{inProgress}</p>
        </div>
      </div>
    </div>
  )
}
