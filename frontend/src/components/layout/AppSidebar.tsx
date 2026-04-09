import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Sun, ChevronLeft, LayoutDashboard } from 'lucide-react'

const SIDEBAR_EXPANDED = 200
const SIDEBAR_COLLAPSED = 64

export function AppSidebar({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)

  const handleMouseEnter = useCallback(() => setCollapsed(false), [])
  const handleMouseLeave = useCallback(() => setCollapsed(true), [])

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
          <span
            className={`whitespace-nowrap font-heading text-sm font-semibold tracking-tight transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}
          >
            SolarSim
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-hidden px-2 py-3">
          <Link
            to="/dashboard"
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span
              className={`truncate whitespace-nowrap transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}
            >
              Dashboard
            </span>
          </Link>

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
