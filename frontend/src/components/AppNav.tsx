import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationPopover, type Notification } from '@/components/ui/notification-popover'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Sun, User, LogOut, LayoutDashboard, ChevronRight, Home } from 'lucide-react'

type Crumb = { label: string; to?: string }

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const { projectId } = useParams()

  const crumbs: Crumb[] = [{ label: 'Dashboard', to: '/dashboard' }]

  if (!projectId) return crumbs

  if (pathname.includes('/map')) {
    crumbs.push({ label: 'Map' })
  } else if (pathname.includes('/workbench')) {
    crumbs.push({ label: 'Map', to: `/project/${projectId}/map?view=readonly` })
    crumbs.push({ label: 'Workbench' })
  } else if (pathname.includes('/analysis')) {
    crumbs.push({ label: 'Workbench', to: `/project/${projectId}/workbench` })
    crumbs.push({ label: 'Analysis' })
  }

  return crumbs
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Welcome to SolarSim!',
    description: 'Get started by creating your first solar project.',
    timestamp: new Date(),
    read: false
  },
  {
    id: '2',
    title: 'Solar Tip',
    description: 'Malaysia receives 4-5 peak sun hours daily — ideal for rooftop solar.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    read: true
  }
]

export function AppNav({ minimal }: { minimal?: boolean } = {}) {
  const { user, signOut } = useAuth()
  const crumbs = useBreadcrumbs()

  return (
    <nav className="glass-nav fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Left — Logo + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Sun className="h-3.5 w-3.5 text-white" />
            </div>
            {!minimal && <span className="font-heading text-sm font-semibold tracking-tight">SolarSim</span>}
          </Link>

          {!minimal && (
            <div className="hidden items-center gap-1 text-sm sm:flex">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                  {crumb.to ? (
                    <Link to={crumb.to} className="text-muted-foreground transition-colors hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right — Notifications + Theme + User */}
        <div className="flex items-center gap-1">
          <NotificationPopover notifications={SAMPLE_NOTIFICATIONS} />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {user?.email?.charAt(0).toUpperCase() ?? 'U'}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Free plan</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/" className="cursor-pointer">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="cursor-default">
                <User className="mr-2 h-4 w-4" />
                Settings
                <span className="ml-auto text-xs text-muted-foreground">Soon</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
