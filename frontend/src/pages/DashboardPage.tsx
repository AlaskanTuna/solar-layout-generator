import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
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
import { Plus, Sun, FolderOpen, Clock, BarChart3, Lightbulb, MapPin, SlidersHorizontal, FileBarChart } from 'lucide-react'
import { notify } from '@/components/ui/toastConfig'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { projectRoute } from '@/components/dashboard/helpers'

/* CONSTANTS */

const WORKFLOW_STEPS = [
  { step: 1, icon: <MapPin className="h-4 w-4" />, title: 'Search Location', desc: 'Find your building on the satellite map' },
  { step: 2, icon: <SlidersHorizontal className="h-4 w-4" />, title: 'Generate & Adjust Layout', desc: 'Drag, rotate, add or remove panels' },
  { step: 3, icon: <FileBarChart className="h-4 w-4" />, title: 'Analyze Savings', desc: 'View projections and export PDF' }
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/* DASHBOARD PAGE */

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [greeting, setGreeting] = useState('Welcome back')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects
  })

  const totalProjects = projects?.length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'analysis_saved').length ?? 0
  const inProgress = totalProjects - completedProjects

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

  const userName = user?.email?.split('@')[0] ?? ''

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Greeting Block */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-solar-100/50 to-solar-200/30 p-8 dark:from-primary/5 dark:via-solar-950/30 dark:to-solar-900/20 animate-fade-in">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solar-400/10 blur-3xl" />
          <div className="relative">
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              {greeting}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="mt-1 max-w-lg text-muted-foreground">
              Track your solar assessment projects and explore your rooftop potential.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
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
            ) : !projects?.length ? (
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
                    onOpen={() => navigate(projectRoute(project))}
                    onDelete={() => setDeleteTarget(project)}
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
      </div>

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Give your solar assessment project a name, then search for your building.</DialogDescription>
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
              <Button type="submit" disabled={!projectName.trim()}>Continue</Button>
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
