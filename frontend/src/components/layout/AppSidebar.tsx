import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, ChevronLeft, LayoutDashboard } from 'lucide-react'

export function AppSidebar({ children }: { children?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {/* Backdrop blur overlay */}
      <div
        className={`fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${expanded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setExpanded(false)}
      />

      {/* Sidebar */}
      <aside
        data-expanded={expanded || undefined}
        className="group/sidebar fixed left-0 top-0 z-[60] flex h-screen flex-col overflow-hidden border-r border-border bg-sidebar"
        style={{
          width: expanded ? 240 : 64,
          transition: 'width 300ms cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 300ms ease',
          boxShadow: expanded ? '0 8px 40px rgba(0, 0, 0, 0.16)' : 'none'
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-3 px-[18px]">
          <Link to="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Sun className="h-3.5 w-3.5 text-white" />
            </div>
          </Link>
          <span
            className="whitespace-nowrap font-heading text-sm font-semibold tracking-tight transition-opacity duration-200"
            style={{ opacity: expanded ? 1 : 0 }}
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
              className="truncate whitespace-nowrap transition-opacity duration-200"
              style={{ opacity: expanded ? 1 : 0 }}
            >
              Dashboard
            </span>
          </Link>

          {/* Page-specific items injected as children (e.g. Dashboard tabs) */}
          {children}
        </nav>

        {/* Collapse indicator */}
        <div className="w-16 shrink-0 py-3">
          <div className="flex items-center justify-center text-muted-foreground">
            <ChevronLeft
              className="h-4 w-4 transition-transform duration-300 ease-in-out"
              style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)' }}
            />
          </div>
        </div>
      </aside>
    </>
  )
}
