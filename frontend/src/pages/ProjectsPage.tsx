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
import { Plus, FolderOpen } from 'lucide-react'
import { notify } from '@/components/ui/toastConfig'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { projectRoute } from '@/components/dashboard/helpers'

export function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress'>('all')

  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  const filtered = useMemo(() => {
    const list = projects ?? []
    if (filter === 'completed') return list.filter((p) => p.status === 'analysis_saved')
    if (filter === 'in-progress') return list.filter((p) => p.status !== 'analysis_saved')
    return list
  }, [projects, filter])

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
      <div className="min-h-[calc(100vh-3.5rem)] px-8 py-10 animate-fade-in">
        <div className="flex items-center justify-between">
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
              {f === 'all' ? `All (${(projects ?? []).length})` : f === 'completed' ? 'Completed' : 'In Progress'}
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
                  onOpen={() => navigate(projectRoute(project))}
                  onDelete={() => setDeleteTarget(project)}
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
