import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { writeNewProjectDraft } from '@/lib/projectDraftStorage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Plus, Gauge, FolderKanban, PieChart, MapPin } from 'lucide-react'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const QUICK_ACTIONS = [
  { to: '/dashboard/summary', icon: Gauge, label: 'Summary', desc: 'Portfolio overview and stats' },
  { to: '/dashboard/projects', icon: FolderKanban, label: 'Projects', desc: 'Manage your solar projects' },
  { to: '/dashboard/analytics', icon: PieChart, label: 'Analytics', desc: 'Performance insights' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [greeting, setGreeting] = useState('Welcome back')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  function handleCreateProject(e: FormEvent) {
    e.preventDefault()
    const name = projectName.trim()
    if (!name) return
    writeNewProjectDraft({ projectName: name, phase: 'search' })
    setDialogOpen(false)
    setProjectName('')
    navigate('/project/new/map', { state: { projectName: name } })
  }

  const userName = user?.email?.split('@')[0] ?? ''

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Greeting */}
        <div className="animate-fade-in">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {greeting}{userName ? `, ${userName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Here's your workspace at a glance.</p>
        </div>

        {/* Quick Action Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 animate-fade-in-up">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="glass-card flex flex-col items-center justify-center gap-3 rounded-xl p-12 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-foreground hover:shadow-lg"
            >
              <action.icon className="h-8 w-8" />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}

          <button
            onClick={() => setDialogOpen(true)}
            className="glass-card flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-12 text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary hover:shadow-lg"
          >
            <MapPin className="h-8 w-8" />
            <span className="text-sm font-medium">New Project</span>
          </button>
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
    </>
  )
}
