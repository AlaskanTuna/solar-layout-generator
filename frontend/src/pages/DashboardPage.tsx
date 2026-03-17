import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { listProjects, deleteProject } from '@/api/projects'
import type { ProjectResponse } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, LogOut, Trash2, Clock, Home } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  layout_saved: 'Layout Saved',
  analysis_saved: 'Analysis Complete'
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  layout_saved: 'secondary',
  analysis_saved: 'default'
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
  const { user, signOut } = useAuth()
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
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
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !projects?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No projects yet. Create your first solar assessment project.</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="group cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(projectRoute(project))}
              >
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={STATUS_VARIANTS[project.status] ?? 'secondary'}>
                      {STATUS_LABELS[project.status] ?? project.status}
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
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated {formatRelativeDate(project.updatedAt)}</span>
                    <span className="mx-1">·</span>
                    <span>
                      Created{' '}
                      {new Date(project.createdAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
    </div>
  )
}
