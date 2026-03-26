import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { listProjects, deleteProject } from '@/api/projects'
import type { ProjectResponse } from '@/api/projects'
import { AppNav } from '@/components/AppNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, Trash2, Clock, Sun, FolderOpen, ArrowRight, Map, Wrench, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ReactNode }
> = {
  draft: { label: 'Draft', variant: 'outline', icon: <Map className="h-3 w-3" /> },
  layout_saved: { label: 'Layout Saved', variant: 'secondary', icon: <Wrench className="h-3 w-3" /> },
  analysis_saved: { label: 'Analysis Complete', variant: 'default', icon: <BarChart3 className="h-3 w-3" /> }
}

function projectRoute(project: ProjectResponse): string {
  switch (project.status) {
    case 'analysis_saved':
      return `/project/${project.id}/analysis`
    case 'layout_saved':
      return `/project/${project.id}/workbench`
    default:
      return `/project/${project.id}/map`
  }
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

  const totalProjects = projects?.length ?? 0
  const completedProjects = projects?.filter((p) => p.status === 'analysis_saved').length ?? 0

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <main className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="animate-fade-in">
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
            </h1>
            <p className="mt-1 text-muted-foreground">Manage your solar assessment projects</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
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
        </div>

        {/* Quick Stats */}
        {!isLoading && totalProjects > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 animate-fade-in">
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="mt-1 font-heading text-2xl font-bold">{totalProjects}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Analyses Complete</p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">{completedProjects}</p>
            </div>
            <div className="glass-card hidden p-4 sm:block">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="mt-1 font-heading text-2xl font-bold">{totalProjects - completedProjects}</p>
            </div>
          </div>
        )}

        {/* Project List */}
        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="glass-card space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : !projects?.length ? (
            /* Empty State */
            <div className="glass-card flex flex-col items-center py-16 text-center animate-fade-in-up">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sun className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mt-6 font-heading text-xl font-semibold">No projects yet</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Create your first solar assessment project to discover your rooftop solar potential.
              </p>
              <Button className="mt-6 gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
              {projects.map((project) => {
                const config = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft
                return (
                  <div
                    key={project.id}
                    className="glass-card group cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                    onClick={() => navigate(projectRoute(project))}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <h3 className="font-heading font-semibold">{project.name}</h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={config.variant} className="gap-1">
                          {config.icon}
                          {config.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(project)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Updated {formatRelativeDate(project.updatedAt)}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

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
    </div>
  )
}
