import { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sun, ChevronLeft, LayoutDashboard } from 'lucide-react'

const SIDEBAR_EXPANDED = 200
const SIDEBAR_COLLAPSED = 64

/** Crossfade section heading: divider when collapsed, title text when expanded */
export function SectionHeading({ title, first }: { title: string; first?: boolean }) {
  return (
    <div className={`relative mb-1 flex h-5 items-center ${first ? '' : 'mt-4'}`}>
      {/* Divider — visible when collapsed */}
      <div className="absolute inset-x-0 h-px bg-sidebar-border transition-opacity duration-150 group-hover/sidebar:opacity-0" />
      {/* Title — visible when expanded */}
      <p className="whitespace-nowrap px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
        {title}
      </p>
    </div>
  )
}

/** Standard sidebar nav link with icon + label */
export function SidebarNavLink({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={`group flex aspect-square w-full items-center gap-2.5 rounded-lg px-2 text-sm transition-colors group-hover/sidebar:aspect-auto group-hover/sidebar:py-1.5 ${
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
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
      <span className="flex-1 truncate whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
        {label}
      </span>
    </Link>
  )
}

export function AppSidebar({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)
  const { pathname } = useLocation()

  const handleMouseEnter = useCallback(() => setCollapsed(false), [])
  const handleMouseLeave = useCallback(() => setCollapsed(true), [])

  const isDashboardActive = pathname === '/dashboard'

  return (
    <>
      {/* Sidebar — transition defined in CSS [data-sidebar], width via inline style */}
      <aside
        data-sidebar
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
          boxShadow: collapsed ? 'none' : '0 8px 40px rgba(0, 0, 0, 0.16)',
        }}
        className="group/sidebar fixed inset-y-0 left-0 z-[60] flex flex-col overflow-hidden border-r border-border bg-sidebar"
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-3 px-[18px]">
          <Link to="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Sun className="h-3.5 w-3.5 text-white" />
            </div>
          </Link>
          <span className="whitespace-nowrap font-heading text-sm font-semibold tracking-tight opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
            SolarSim
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          {/* Section: Overview */}
          <SectionHeading title="Overview" first />
          <SidebarNavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={isDashboardActive} />

          {/* Injected sections (e.g. Dashboard tabs under INSIGHTS heading) */}
          {children}
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

      {/* Desktop backdrop blur when expanded */}
      <div
        className={`sidebar-expanded-backdrop fixed inset-0 z-[55] ${collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        onClick={() => setCollapsed(true)}
        aria-hidden="true"
      />
    </>
  )
}
