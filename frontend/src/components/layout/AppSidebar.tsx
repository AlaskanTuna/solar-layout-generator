import { useState, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, LayoutDashboard, FolderKanban, PieChart, CircleHelp, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

const SIDEBAR_EXPANDED = 200
const SIDEBAR_COLLAPSED = 64

/** Crossfade section heading: divider when collapsed, title text when expanded */
function SectionHeading({ title, first, alwaysExpanded }: { title: string; first?: boolean; alwaysExpanded?: boolean }) {
  return (
    <div className={`relative mb-1 flex h-5 items-center ${first ? '' : 'mt-4'}`}>
      <div
        className={`absolute inset-x-0 h-px bg-sidebar-border transition-opacity duration-150 ${
          alwaysExpanded ? 'opacity-0' : 'group-hover/sidebar:opacity-0'
        }`}
      />
      <p
        className={`whitespace-nowrap px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 transition-opacity duration-150 ${
          alwaysExpanded ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'
        }`}
      >
        {title}
      </p>
    </div>
  )
}

/** Sidebar nav link — icon always at fixed w-8 center, label fades in on expand */
function NavLink({
  to,
  icon: Icon,
  label,
  active,
  alwaysExpanded,
  onClick
}: {
  to: string
  icon: LucideIcon
  label: string
  active: boolean
  alwaysExpanded?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group relative flex h-12 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors ${
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-primary'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      }`}
    >
      <span className="flex w-8 shrink-0 items-center justify-center">
        <Icon
          className={`h-4 w-4 shrink-0 ${
            active
              ? 'text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground'
          }`}
        />
      </span>
      <span
        className={`flex-1 truncate whitespace-nowrap transition-opacity duration-150 ${
          alwaysExpanded ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'
        }`}
      >
        {label}
      </span>
    </Link>
  )
}

type NavSectionDef = {
  titleKey: string
  items: { to: string; labelKey: string; icon: LucideIcon; exact?: boolean }[]
}

const NAV_SECTIONS: NavSectionDef[] = [
  {
    titleKey: 'sections.overview',
    items: [{ to: '/dashboard', labelKey: 'items.dashboard', icon: LayoutDashboard, exact: true }]
  },
  {
    titleKey: 'sections.insights',
    items: [
      { to: '/dashboard/projects', labelKey: 'items.projects', icon: FolderKanban },
      { to: '/dashboard/analytics', labelKey: 'items.analytics', icon: PieChart }
    ]
  },
  {
    titleKey: 'sections.help',
    items: [{ to: '/dashboard/faq', labelKey: 'items.faq', icon: CircleHelp }]
  }
]

type AppSidebarProps = {
  /** Whether the mobile drawer is open (only relevant below lg breakpoint) */
  mobileOpen?: boolean
  /** Callback to close the mobile drawer */
  onMobileClose?: () => void
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(true)
  const { pathname } = useLocation()
  const { t } = useTranslation('nav')

  const handleMouseEnter = useCallback(() => setCollapsed(false), [])
  const handleMouseLeave = useCallback(() => setCollapsed(true), [])

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  // Close mobile drawer on route change
  useEffect(() => {
    if (mobileOpen && onMobileClose) onMobileClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <>
      {/* Desktop sidebar (hover-collapse, lg+ only) */}
      <aside
        data-sidebar
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
          boxShadow: collapsed ? 'none' : '0 8px 40px rgba(0, 0, 0, 0.16)'
        }}
        className="group/sidebar fixed inset-y-0 left-0 z-[60] hidden flex-col overflow-hidden border-r border-border bg-sidebar lg:flex"
      >
        {/* Logo */}
        <div className="sidebar-logo-divider flex h-14 shrink-0 items-center gap-3 px-[18px]">
          <Link to="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
            <Logo className="h-7 w-7" />
          </Link>
          <span className="whitespace-nowrap font-heading text-sm font-semibold tracking-tight opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
            SolarSim
          </span>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto px-2 py-3">
          {NAV_SECTIONS.map((section, i) => (
            <div key={section.titleKey}>
              <SectionHeading title={t(section.titleKey)} first={i === 0} />
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  active={item.exact ? pathname === item.to : pathname.startsWith(item.to)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Collapse indicator */}
        <div className="w-16 shrink-0 py-3">
          <div className="flex items-center justify-center text-muted-foreground">
            <ChevronLeft
              className="h-4 w-4 transition-transform duration-150 ease-in-out"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>
        </div>
      </aside>

      {/* Desktop backdrop blur when expanded (lg+ only) */}
      <div
        className={`sidebar-expanded-backdrop fixed inset-0 z-[55] hidden lg:block ${collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        onClick={() => setCollapsed(true)}
        aria-hidden="true"
      />

      {/* Mobile drawer (slide-in from left, always expanded labels) */}
      <div
        className={`fixed inset-0 z-[70] lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          onClick={onMobileClose}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Drawer panel */}
        <aside
          className={`relative flex h-full w-64 max-w-[80vw] flex-col overflow-hidden border-r border-border bg-sidebar shadow-2xl transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Logo + close */}
          <div className="sidebar-logo-divider flex h-14 shrink-0 items-center justify-between gap-3 px-[18px]">
            <Link
              to="/"
              onClick={onMobileClose}
              className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Logo className="h-7 w-7" />
              <span className="whitespace-nowrap font-heading text-sm font-semibold tracking-tight">SolarSim</span>
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={onMobileClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav sections */}
          <nav className="flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto px-2 py-3">
            {NAV_SECTIONS.map((section, i) => (
              <div key={section.titleKey}>
                <SectionHeading title={t(section.titleKey)} first={i === 0} alwaysExpanded />
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    active={item.exact ? pathname === item.to : pathname.startsWith(item.to)}
                    alwaysExpanded
                    onClick={onMobileClose}
                  />
                ))}
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </>
  )
}
