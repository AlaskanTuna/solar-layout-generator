import { useState, useMemo, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listProjects, deleteProject } from '@/api/projects'
import type { ProjectResponse } from '@/api/projects'
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
  FolderOpen,
  FolderKanban,
  BarChart3,
  Clock,
  Lightbulb,
  MapPin,
  SlidersHorizontal,
  FileBarChart
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeaderCard } from '@/components/layout/PageHeaderCard'
import { notify } from '@/components/ui/toastConfig'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { projectRoute } from '@/components/dashboard/helpers'
import { useQuota } from '@/hooks/useQuota'

function formatResetTime(resetsAt: string): string {
  const d = new Date(resetsAt)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress'>('all')

  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const quotaQuery = useQuota()
  const quota = quotaQuery.data
  const isUnlimited = quota?.limit === null
  const quotaLabel = !quota
    ? null
    : isUnlimited
      ? 'Unlimited projects today'
      : `${quota.used} / ${quota.limit} projects today · resets at ${formatResetTime(quota.resetsAt)}`
  const quotaReached = !!quota && quota.limit !== null && quota.used >= quota.limit

  const filtered = useMemo(() => {
    const list = projects ?? []
    if (filter === 'completed') return list.filter((p) => p.status === 'analysis_saved')
    if (filter === 'in-progress') return list.filter((p) => p.status !== 'analysis_saved')
    return list
  }, [projects, filter])

  const totalProjects = projects?.length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'analysis_saved').length ?? 0
  const inProgress = totalProjects - completedProjects

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
    <>
      <PageContainer>
        <PageHeaderCard artSrc="/dashboard/projects.webp">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">Projects</h1>
              <p className="mt-1 max-w-lg text-muted-foreground">Manage all your solar assessment projects</p>
              {quotaLabel && (
                <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{quotaLabel}</p>
              )}
            </div>
          </div>
        </PageHeaderCard>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          {/* Left: stats → filters → project grid */}
          <div className="flex flex-col">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Completed</p>
                  <p className="font-heading text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {completedProjects}
                  </p>
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

            {/* Filter chips */}
            <div className="mt-6 flex w-fit gap-1 rounded-lg bg-muted/50 p-1">
              {(['all', 'completed', 'in-progress'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? `All (${(projects ?? []).length})` : f === 'completed' ? 'Completed' : 'In Progress'}
                </button>
              ))}
            </div>

            {/* Project grid */}
            <div className="mt-6">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
                  {filtered.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={() => navigate(projectRoute(project))}
                      onDelete={() => setDeleteTarget(project)}
                    />
                  ))}
                  <button
                    onClick={() => !quotaReached && setDialogOpen(true)}
                    disabled={quotaReached}
                    className="glass-card flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border p-8 text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:text-primary hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground disabled:hover:shadow-none"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Plus className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">New Project</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: How it works */}
          <aside className="hidden lg:block animate-fade-in">
            <div className="glass-card flex flex-col overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <h3 className="font-heading text-sm font-semibold">How it works</h3>
                </div>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {WORKFLOW_STEPS.map((s) => (
                  <div key={s.step} className="p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {s.icon}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{s.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </PageContainer>

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
    </>
  )
}
