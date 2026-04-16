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
import { PageContainer } from '@/components/layout/PageContainer'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const QUICK_ACTIONS = [
  { to: '/dashboard/summary', icon: Gauge, label: 'Summary', desc: 'Portfolio overview and stats' },
  { to: '/dashboard/projects', icon: FolderKanban, label: 'Projects', desc: 'Manage your solar projects' },
  { to: '/dashboard/analytics', icon: PieChart, label: 'Analytics', desc: 'Performance insights' }
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
      <PageContainer flex>
        {/* Greeting Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-solar-100/50 to-solar-200/30 p-8 dark:from-primary/5 dark:via-solar-950/30 dark:to-solar-900/20 animate-fade-in">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solar-400/10 blur-3xl" />
          <div className="relative">
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              {greeting}
              {userName ? `, ${userName}` : ''}
            </h1>
            <p className="mt-1 max-w-lg text-muted-foreground">Here's your workspace at a glance.</p>
          </div>
        </div>

        {/* Quick Action Cards — flex-1 fills remaining viewport height */}
        <div className="mt-6 grid flex-1 gap-4 sm:grid-cols-2 animate-fade-in-up">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="glass-card flex flex-col items-center justify-center gap-3 rounded-xl text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-foreground hover:shadow-lg"
            >
              <action.icon className="h-8 w-8" />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}

          <button
            onClick={() => setDialogOpen(true)}
            className="glass-card flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary hover:shadow-lg"
          >
            <MapPin className="h-8 w-8" />
            <span className="text-sm font-medium">New Project</span>
          </button>
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
    </>
  )
}
