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
import { User, LogOut, LayoutDashboard, ChevronRight, Home } from 'lucide-react'

type Crumb = { label: string; to?: string; icon?: React.ReactNode }

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const { projectId } = useParams()

  const crumbs: Crumb[] = [
    { label: 'Home', to: '/', icon: <Home className="h-3.5 w-3.5" /> },
    { label: 'Dashboard', to: '/dashboard' }
  ]

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
      <div className="flex h-14 items-center justify-between px-6" style={{ marginLeft: 64 }}>
        {/* Left — Breadcrumbs (Home > Dashboard > ...) */}
        <div className="flex items-center">
          {!minimal && (
            <div className="flex items-center gap-1 text-sm">
              {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.icon}
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {crumb.icon}
                      {crumb.label}
                    </span>
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
