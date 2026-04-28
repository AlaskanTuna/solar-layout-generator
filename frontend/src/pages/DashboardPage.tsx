import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listProjects } from '@/api/projects'
import { useAuth } from '@/hooks/useAuth'
import { useQuota } from '@/hooks/useQuota'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { writeNewProjectDraft } from '@/lib/projectDraftStorage'
import { getProjectLastVisitedAt } from '@/lib/recentProjectActivity'
import { formatRelativeDate, projectRoute } from '@/components/dashboard/helpers'
import { getProjectStatusConfig } from '@/lib/projectStatus'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Activity, ArrowRight, CircleHelp, Clock, FolderKanban, PieChart, MapPin, LayoutDashboard } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeaderCard } from '@/components/layout/PageHeaderCard'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatResetTime(resetsAt: string): string {
  const d = new Date(resetsAt)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
}

const QUICK_ACTIONS = [
  {
    to: '/dashboard/projects',
    icon: FolderKanban,
    label: 'Projects',
    desc: 'Open saved layouts, continue drafts, and manage project history.',
    art: '/dashboard/projects.webp'
  },
  {
    to: '/dashboard/analytics',
    icon: PieChart,
    label: 'Analytics',
    desc: 'Compare performance signals and savings across your solar work.',
    art: '/dashboard/analytics.webp'
  },
  {
    to: '/dashboard/faq',
    icon: CircleHelp,
    label: 'FAQ',
    desc: 'Find answers about Solar API data, NEM tariffs, and how to use the workbench.',
    art: '/dashboard/faq.webp'
  }
]

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const quotaQuery = useQuota()
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [greeting, setGreeting] = useState('Welcome back')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  const quota = quotaQuery.data
  const quotaReached = !!quota && quota.limit !== null && quota.used >= quota.limit

  function handleCreateProject(e: FormEvent) {
    e.preventDefault()
    const name = projectName.trim()
    if (!name || quotaReached) return
    writeNewProjectDraft({ projectName: name, phase: 'search' })
    setDialogOpen(false)
    setProjectName('')
    navigate('/project/new/map', { state: { projectName: name } })
  }

  const userName = user?.email?.split('@')[0] ?? ''
  const recentProjects = [...(projectsQuery.data ?? [])]
    .sort((a, b) => {
      const aVisited = getProjectLastVisitedAt(a.id)
      const bVisited = getProjectLastVisitedAt(b.id)
      const aTime = new Date(aVisited ?? a.updatedAt).getTime()
      const bTime = new Date(bVisited ?? b.updatedAt).getTime()
      return bTime - aTime
    })
    .slice(0, 3)

  const actionCardClass =
    'glass-card group relative flex min-h-[168px] w-full flex-col items-start justify-between overflow-hidden p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-[176px]'

  const cardArtFrameClass =
    'pointer-events-none absolute -right-2 top-1/2 h-[118%] max-h-60 w-[58%] -translate-y-1/2 overflow-hidden opacity-80 transition-all duration-300 [mask-image:linear-gradient(to_bottom,black_0%,black_46%,rgba(0,0,0,0.5)_68%,transparent_100%)] group-hover:scale-105 group-hover:opacity-95 dark:opacity-70'

  const cardArtImageClass =
    'h-full w-full object-contain object-right [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.14)_24%,black_58%)]'

  const newProjectTile = (
    <button
      type="button"
      onClick={() => !quotaReached && setDialogOpen(true)}
      disabled={quotaReached}
      aria-disabled={quotaReached}
      className={`${actionCardClass} ${
        quotaReached ? 'cursor-not-allowed opacity-60' : 'text-foreground hover:text-foreground'
      }`}
    >
      <div aria-hidden="true" className={cardArtFrameClass}>
        <img src="/dashboard/new-project.webp" alt="" className={cardArtImageClass} />
      </div>
      <div className="relative z-10 flex w-full items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <div className="relative z-10">
        <h2 className="font-heading text-xl font-semibold tracking-tight">New Project</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Search for a building, generate a rooftop layout, and start a new solar assessment.
        </p>
      </div>
    </button>
  )

  return (
    <>
      <PageContainer flex>
        <PageHeaderCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">
                {greeting}
                {userName ? `, ${userName}` : ''}
              </h1>
              <p className="mt-1 max-w-lg text-muted-foreground">Here's your workspace at a glance.</p>
            </div>
          </div>
        </PageHeaderCard>

        <div className="mt-6 grid flex-1 gap-4 animate-fade-in-up xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {quotaReached && quota ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">{newProjectTile}</span>
                  </TooltipTrigger>
                  <TooltipContent>Daily limit reached - resets at {formatResetTime(quota.resetsAt)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              newProjectTile
            )}

            {QUICK_ACTIONS.map((action) => (
              <Link key={action.to} to={action.to} className={actionCardClass}>
                <div aria-hidden="true" className={cardArtFrameClass}>
                  <img src={action.art} alt="" className={cardArtImageClass} />
                </div>
                <div className="relative z-10 flex w-full items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <div className="relative z-10">
                  <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">{action.label}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <aside className="glass-card group relative flex min-h-[168px] flex-col overflow-hidden p-5 sm:min-h-[176px] xl:min-h-0">
            <img
              src="/dashboard/recents.webp"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -right-3 h-48 w-auto object-contain opacity-75 transition-all duration-300 [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.16)_22%,black_60%)] group-hover:scale-105 group-hover:opacity-90 dark:opacity-65 xl:h-56"
            />
            <div className="relative z-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <h2 className="mt-5 font-heading text-lg font-semibold tracking-tight">Continue Where You Left Off</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">Resume your latest saved project.</p>
            </div>

            <div className="flex flex-1 flex-col">
              {projectsQuery.isLoading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading...</div>
              ) : recentProjects.length > 0 ? (
                <div className="relative z-10 mt-5 space-y-2">
                  {recentProjects.map((project) => {
                    const visitedAt = getProjectLastVisitedAt(project.id)
                    const status = getProjectStatusConfig(project.status)
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => navigate(projectRoute(project))}
                        className="glass group w-full rounded-xl p-3 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-heading text-sm font-semibold">{project.name}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatRelativeDate(visitedAt ?? project.updatedAt)}
                            </p>
                          </div>
                          <status.icon className="h-4 w-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium">
                          <span className="truncate text-muted-foreground">{status.label}</span>
                          <span className="flex shrink-0 items-center gap-1 text-primary">
                            Continue
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="relative z-10 flex flex-1 items-center justify-center text-sm font-medium text-muted-foreground">
                  None
                </div>
              )}
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
              <Button type="submit" disabled={!projectName.trim() || quotaReached}>
                Continue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
