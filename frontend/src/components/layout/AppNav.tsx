import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useQuota } from '@/hooks/useQuota'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { NotificationPopover } from '@/components/ui/NotificationPopover'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, ChevronRight, Home, Settings } from 'lucide-react'

type Crumb = { label: string; to?: string; icon?: React.ReactNode }

function useBreadcrumbs(): Crumb[] {
  const { t } = useTranslation('nav')
  const { pathname } = useLocation()
  const { projectId } = useParams()

  const crumbs: Crumb[] = [
    { label: t('items.home'), to: '/', icon: <Home className="h-3.5 w-3.5" /> },
    { label: t('items.dashboard'), to: '/dashboard' }
  ]

  if (pathname === '/settings') {
    return [{ label: t('items.home'), to: '/', icon: <Home className="h-3.5 w-3.5" /> }, { label: t('items.settings') }]
  }

  // Dashboard sub-pages
  if (pathname.startsWith('/dashboard/')) {
    const sub = pathname.split('/')[2]
    if (sub === 'summary') crumbs.push({ label: t('items.summary') })
    else if (sub === 'projects') crumbs.push({ label: t('items.projects') })
    else if (sub === 'analytics') crumbs.push({ label: t('items.analytics') })
    else if (sub === 'faq') crumbs.push({ label: t('items.faq') })
    return crumbs
  }

  if (!projectId) return crumbs

  // Determine which MVP page is active
  const onMap = pathname.includes('/map')
  const onWorkbench = pathname.includes('/workbench')
  const onAnalysis = pathname.includes('/analysis')

  // Map — always shown when inside a project
  if (onMap) {
    crumbs.push({ label: t('items.map') })
  } else {
    crumbs.push({ label: t('items.map'), to: `/project/${projectId}/map?view=readonly` })
  }

  // Workbench — shown when on workbench or analysis
  if (onWorkbench || onAnalysis) {
    if (onWorkbench) {
      crumbs.push({ label: t('items.workbench') })
    } else {
      crumbs.push({ label: t('items.workbench'), to: `/project/${projectId}/workbench` })
    }
  }

  // Analysis — shown when on analysis
  if (onAnalysis) {
    crumbs.push({ label: t('items.analysis') })
  }

  return crumbs
}

/**
 * Renders the AppNav component
 * @param {Object} props - Props for the component
 */
export function AppNav({ minimal }: { minimal?: boolean } = {}) {
  const { t } = useTranslation('nav')
  const { user, signOut } = useAuth()
  const crumbs = useBreadcrumbs()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const quotaQuery = useQuota()
  const tier = quotaQuery.data?.tier
  const planLabel = tier ? t('menu.planLabel', { tier: tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase() }) : t('menu.loadingPlan')

  useEffect(() => {
    if (!userMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [userMenuOpen])

  return (
    <nav className="glass-nav fixed inset-x-0 top-0 z-50">
      <div className="flex h-14 items-center justify-between px-6" style={{ marginLeft: 64 }}>
        {/* Left — Breadcrumbs */}
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

        {/* Right — Theme + Notifications + User */}
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <NotificationPopover />

          {/* User menu (custom popover — same pattern as notification modal) */}
          <div ref={userMenuRef} className="relative">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setUserMenuOpen(!userMenuOpen)}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
            </Button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="text-sm font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">{planLabel}</p>
                  </div>
                  <div className="p-1">
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <Settings className="h-4 w-4" />
                      {t('menu.settingsLink')}
                    </Link>
                  </div>
                  <div className="border-t border-border p-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        signOut()
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      {t('items.signOut')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  )
}
