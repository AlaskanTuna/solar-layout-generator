import { useState, useMemo, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { listProjects, deleteProject } from '@/api/projects'
import type { ProjectResponse } from '@/api/projects'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { writeNewProjectDraft } from '@/lib/projectDraftStorage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Plus,
  Sun,
  FolderOpen,
  Clock,
  BarChart3,
  Sparkles,
  Lightbulb,
  Leaf,
  Zap,
  Receipt,
  MapPin,
  SlidersHorizontal,
  FileBarChart,
  PieChart
} from 'lucide-react'
import { notify } from '@/components/ui/toastConfig'
import { DashboardTabNav, type DashboardTab } from '@/components/dashboard/DashboardTabNav'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { StatCard } from '@/components/dashboard/StatCard'
import { aggregateStats, projectRoute } from '@/components/dashboard/helpers'

/* CONSTANTS */

const WORKFLOW_STEPS = [
  {
    step: 1,
    icon: <MapPin className="h-4 w-4" />,
    title: 'Search Location',
    desc: 'Find your building on the satellite map'
  },
  {
    step: 2,
    icon: <SlidersHorizontal className="h-4 w-4" />,
    title: 'Generate & Adjust Layout',
    desc: 'Drag, rotate, add or remove panels'
  },
  {
    step: 3,
    icon: <FileBarChart className="h-4 w-4" />,
    title: 'Analyze Savings',
    desc: 'View projections and export PDF'
  }
]

/* DASHBOARD PAGE */

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('summary')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects
  })

  const totalProjects = projects?.length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'analysis_saved').length ?? 0
  const inProgress = totalProjects - completedProjects
  const stats = useMemo(() => aggregateStats(projects ?? []), [projects])

  function handleCreateProject(e: FormEvent) {
    e.preventDefault()
    const name = projectName.trim()
    if (!name) return
    writeNewProjectDraft({ projectName: name, phase: 'search' })
    setDialogOpen(false)
    setProjectName('')
    navigate('/project/new/map', { state: { projectName: name } })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteProject(deleteTarget.id)
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      notify.success(`"${deleteTarget.name}" has been deleted.`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to delete project.')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <AppLayout sidebarChildren={<DashboardTabNav activeTab={activeTab} onTabChange={setActiveTab} />}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === 'summary' && (
          <SummaryTab
            user={user}
            projects={projects ?? []}
            isLoading={isLoading}
            totalProjects={totalProjects}
            completedProjects={completedProjects}
            inProgress={inProgress}
            setDialogOpen={setDialogOpen}
            onNavigate={navigate}
            onDeleteTarget={setDeleteTarget}
          />
        )}
        {activeTab === 'projects' && (
          <ProjectsTab
            projects={projects ?? []}
            isLoading={isLoading}
            setDialogOpen={setDialogOpen}
            onNavigate={navigate}
            onDeleteTarget={setDeleteTarget}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            projects={projects ?? []}
            stats={stats}
            completedProjects={completedProjects}
            totalProjects={totalProjects}
          />
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Give your solar assessment project a name, then search for your building.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="e.g. My Home Solar"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={!projectName.trim()}>
                Continue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

/* SUMMARY TAB */

function SummaryTab({
  user,
  projects,
  isLoading,
  totalProjects,
  completedProjects,
  inProgress,
  setDialogOpen,
  onNavigate,
  onDeleteTarget
}: {
  user: { email?: string } | null
  projects: ProjectResponse[]
  isLoading: boolean
  totalProjects: number
  completedProjects: number
  inProgress: number
  setDialogOpen: (v: boolean) => void
  onNavigate: (path: string) => void
  onDeleteTarget: (p: ProjectResponse) => void
}) {
  return (
    <>
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-solar-100/50 to-solar-200/30 p-8 dark:from-primary/5 dark:via-solar-950/30 dark:to-solar-900/20 animate-fade-in">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solar-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Summary</span>
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </h1>
          <p className="mt-1 max-w-lg text-muted-foreground">
            Track your solar assessment projects and explore your rooftop potential.
          </p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="mt-6 grid grid-cols-3 gap-4 animate-fade-in-up">
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total Projects</p>
            <p className="font-heading text-lg font-bold">{totalProjects}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Completed</p>
            <p className="font-heading text-lg font-bold text-green-600 dark:text-green-400">{completedProjects}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">In Progress</p>
            <p className="font-heading text-lg font-bold text-amber-600 dark:text-amber-400">{inProgress}</p>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Recent Projects
            {totalProjects > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({totalProjects})</span>
            )}
          </h2>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="glass-card space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : !projects.length ? (
            <div className="glass-card flex flex-col items-center py-16 text-center animate-fade-in-up">
              <div className="relative">
                <div className="absolute inset-0 animate-glow-pulse rounded-full bg-primary/20 blur-xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Sun className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="mt-6 font-heading text-xl font-bold">Start your solar journey</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Create your first project to assess your rooftop solar potential.
              </p>
              <Button className="mt-6 gap-2 shadow-md" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
              {projects.slice(0, 4).map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => onNavigate(projectRoute(project))}
                  onDelete={() => onDeleteTarget(project)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Getting Started Tips */}
      {!isLoading && totalProjects > 0 && totalProjects <= 2 && completedProjects === 0 && (
        <div className="mt-8 glass-card overflow-hidden animate-fade-in">
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h3 className="font-heading text-sm font-semibold">Complete your first analysis</h3>
            </div>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-3">
            {WORKFLOW_STEPS.map((s) => (
              <div key={s.step} className="bg-card p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {s.icon}
                </div>
                <p className="mt-3 text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* PROJECTS TAB */

function ProjectsTab({
  projects,
  isLoading,
  setDialogOpen,
  onNavigate,
  onDeleteTarget
}: {
  projects: ProjectResponse[]
  isLoading: boolean
  setDialogOpen: (v: boolean) => void
  onNavigate: (path: string) => void
  onDeleteTarget: (p: ProjectResponse) => void
}) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress'>('all')

  const filtered = useMemo(() => {
    if (filter === 'completed') return projects.filter((p) => p.status === 'analysis_saved')
    if (filter === 'in-progress') return projects.filter((p) => p.status !== 'analysis_saved')
    return projects
  }, [projects, filter])

  return (
    <>
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all your solar assessment projects</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="mt-6 flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {(['all', 'completed', 'in-progress'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? `All (${projects.length})` : f === 'completed' ? 'Completed' : 'In Progress'}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass-card space-y-3 p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="glass-card flex flex-col items-center py-16 text-center animate-fade-in-up">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              {filter === 'all' ? 'No projects yet. Create one to get started.' : `No ${filter} projects.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onNavigate(projectRoute(project))}
                onDelete={() => onDeleteTarget(project)}
              />
            ))}

            <button
              onClick={() => setDialogOpen(true)}
              className="glass-card flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border p-8 text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:text-primary hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">New Project</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/* ANALYTICS TAB */

function AnalyticsTab({
  projects,
  stats,
  completedProjects,
  totalProjects
}: {
  projects: ProjectResponse[]
  stats: ReturnType<typeof aggregateStats>
  completedProjects: number
  totalProjects: number
}) {
  if (completedProjects === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Performance insights across all your projects</p>
        <div className="mt-12 glass-card flex flex-col items-center py-16 text-center">
          <PieChart className="h-12 w-12 text-muted-foreground/30" />
          <h2 className="mt-4 font-heading text-lg font-semibold">No data yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Complete at least one solar analysis to see aggregated performance metrics here.
          </p>
        </div>
      </div>
    )
  }

  const avgSavings = completedProjects > 0 ? stats.totalSavingsRm / completedProjects : 0
  const avgPanels = completedProjects > 0 ? stats.totalPanels / completedProjects : 0

  const paybackData = projects
    .filter((p) => p.status === 'analysis_saved' && p.analysisResults)
    .map((p) => {
      const r = p.analysisResults!
      return { name: p.name, payback: r.paybackYears ?? null, savings: r.averageMonthlySavingsRm }
    })

  return (
    <div className="animate-fade-in">
      <h1 className="font-heading text-2xl font-bold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Aggregated performance across {completedProjects} completed project{completedProjects !== 1 ? 's' : ''}
      </p>

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
    </div>
  )
}
