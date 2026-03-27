import { useState, useMemo, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { listProjects, deleteProject } from '@/api/projects'
import type { ProjectResponse } from '@/api/projects'
import { AppLayout } from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { writeNewProjectDraft } from '@/lib/projectDraftStorage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  Clock,
  Sun,
  FolderOpen,
  ArrowRight,
  Map,
  Wrench,
  BarChart3,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Leaf,
  Zap,
  Receipt,
  MapPin,
  SlidersHorizontal,
  FileBarChart,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'

/* ─── Helpers ─── */

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ReactNode; color: string }
> = {
  draft: { label: 'Draft', variant: 'outline', icon: <Map className="h-3 w-3" />, color: 'text-muted-foreground' },
  layout_saved: {
    label: 'Layout Saved',
    variant: 'secondary',
    icon: <Wrench className="h-3 w-3" />,
    color: 'text-amber-600 dark:text-amber-400'
  },
  analysis_saved: {
    label: 'Analysis Complete',
    variant: 'default',
    icon: <BarChart3 className="h-3 w-3" />,
    color: 'text-green-600 dark:text-green-400'
  }
}

function projectRoute(p: ProjectResponse): string {
  switch (p.status) {
    case 'analysis_saved':
      return `/project/${p.id}/analysis`
    case 'layout_saved':
      return `/project/${p.id}/workbench`
    default:
      return `/project/${p.id}/map`
  }
}

function formatRelativeDate(dateString: string): string {
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

type AggregatedStats = {
  totalSavingsRm: number
  totalCarbonKg: number
  totalEnergyKwh: number
  totalPanels: number
}

function aggregateStats(projects: ProjectResponse[]): AggregatedStats {
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
    title: 'Adjust Layout',
    desc: 'Drag, rotate, add or remove panels'
  },
  {
    step: 3,
    icon: <FileBarChart className="h-4 w-4" />,
    title: 'Analyse Savings',
    desc: 'View projections and export PDF'
  }
]

/* ─── Component ─── */

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
      toast.success(`"${deleteTarget.name}" has been deleted.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project.')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* ════════════════════ Sidebar ════════════════════ */}
          <aside className="lg:w-72 lg:shrink-0">
            <div className="sticky top-20 space-y-6">
              {/* User card */}
              <div className="glass-card p-5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                    {user?.email?.charAt(0).toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user?.email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-heading text-lg font-bold">{totalProjects}</p>
                    <p className="text-[10px] text-muted-foreground">Projects</p>
                  </div>
                  <div>
                    <p className="font-heading text-lg font-bold text-green-600 dark:text-green-400">
                      {completedProjects}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Complete</p>
                  </div>
                  <div>
                    <p className="font-heading text-lg font-bold text-amber-600 dark:text-amber-400">{inProgress}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="glass-card space-y-2 p-4 animate-fade-in">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</p>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full justify-start gap-2" size="sm">
                      <Plus className="h-4 w-4" />
                      New Project
                    </Button>
                  </DialogTrigger>
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
                {projects && projects.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    size="sm"
                    onClick={() => {
                      const latest = projects[0]
                      if (latest) navigate(projectRoute(latest))
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Latest Project
                  </Button>
                )}
              </div>

              {/* How it works */}
              <div className="glass-card p-4 animate-fade-in">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How It Works</p>
                <div className="mt-3 space-y-3">
                  {WORKFLOW_STEPS.map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {s.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">
                          {s.step}. {s.title}
                        </p>
                        <p className="text-[11px] leading-snug text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solar fact */}
              <div className="glass-card flex items-start gap-3 p-4 animate-fade-in">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Malaysia receives an average of 4-5 peak sun hours daily, making it one of the best regions in
                  Southeast Asia for rooftop solar.
                </p>
              </div>
            </div>
          </aside>

          {/* ════════════════════ Main Content ════════════════════ */}
          <div className="min-w-0 flex-1">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-solar-100/50 to-solar-200/30 p-8 dark:from-primary/5 dark:via-solar-950/30 dark:to-solar-900/20 animate-fade-in">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solar-400/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">Dashboard</span>
                </div>
                <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">
                  Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                </h1>
                <p className="mt-1 max-w-lg text-muted-foreground">
                  Track your solar assessment projects and explore your rooftop potential.
                </p>
              </div>
            </div>

            {/* Aggregated Solar Stats (only if there are completed analyses) */}
            {completedProjects > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 animate-fade-in-up">
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
            )}

            {/* Section Header */}
            <div className="mt-8 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">
                Your Projects
                {totalProjects > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({totalProjects})</span>
                )}
              </h2>
              {totalProjects > 2 && (
                <div className="flex gap-1 text-xs text-muted-foreground">
                  <span className="cursor-pointer rounded-md bg-muted px-2 py-1 font-medium text-foreground">All</span>
                  <span className="cursor-default rounded-md px-2 py-1">Completed</span>
                  <span className="cursor-default rounded-md px-2 py-1">In Progress</span>
                </div>
              )}
            </div>

            {/* Project List */}
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
              ) : !projects?.length ? (
                <div className="glass-card flex flex-col items-center py-20 text-center animate-fade-in-up">
                  <div className="relative">
                    <div className="absolute inset-0 animate-glow-pulse rounded-full bg-primary/20 blur-xl" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                      <Sun className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <h2 className="mt-8 font-heading text-2xl font-bold">Start your solar journey</h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Create your first project to assess your rooftop solar potential. Search for your address, customize
                    your panel layout, and discover how much you could save.
                  </p>
                  <Button className="mt-8 gap-2 px-6 shadow-md" size="lg" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create Your First Project
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={() => navigate(projectRoute(project))}
                      onDelete={() => setDeleteTarget(project)}
                    />
                  ))}

                  {/* New project card */}
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

            {/* Getting Started Tips (show for users with few projects) */}
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {s.step}
                      </div>
                      <p className="mt-3 text-sm font-semibold">{s.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
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

/* ─── Sub-components ─── */

function StatCard({
  icon,
  label,
  value,
  accent,
  bg
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  bg: string
}) {
  return (
    <div className="glass-card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`font-heading text-lg font-bold ${accent}`}>{value}</p>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  onOpen,
  onDelete
}: {
  project: ProjectResponse
  onOpen: () => void
  onDelete: () => void
}) {
  const config = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft
  const analysis = project.status === 'analysis_saved' ? (project.analysisResults as Record<string, number>) : null

  return (
    <div
      className="glass-card group cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-heading font-semibold">{project.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeDate(project.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={config.variant} className="gap-1">
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Quick metrics for completed projects */}
      {analysis && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Savings/mo</p>
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
              RM {(analysis.averageMonthlySavingsRm ?? 0).toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Payback</p>
            <p className="text-xs font-semibold">
              {analysis.paybackYears != null ? `${(analysis.paybackYears as number).toFixed(1)} yr` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Panels</p>
            <p className="text-xs font-semibold">{analysis.activePanelCount ?? '—'}</p>
          </div>
        </div>
      )}

      {/* Progress indicator for in-progress projects */}
      {project.status !== 'analysis_saved' && (
        <div className="mt-3">
          <div className="flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-primary" />
            <div
              className={`h-1 flex-1 rounded-full ${project.status === 'layout_saved' ? 'bg-primary' : 'bg-muted'}`}
            />
            <div className="h-1 flex-1 rounded-full bg-muted" />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {project.status === 'draft' ? 'Next: Adjust your panel layout' : 'Next: View your savings analysis'}
          </p>
        </div>
      )}

      {/* Hover CTA */}
      <div className="mt-2 flex items-center justify-end">
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open project
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}
