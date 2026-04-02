import { LayoutDashboard, FolderKanban, PieChart } from 'lucide-react'

export type DashboardTab = 'summary' | 'projects' | 'analytics'

const TAB_ITEMS: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Summary', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban className="h-5 w-5" /> },
  { id: 'analytics', label: 'Analytics', icon: <PieChart className="h-5 w-5" /> }
]

export function DashboardTabNav({
  activeTab,
  onTabChange
}: {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
}) {
  return (
    <>
      <div className="mx-3 my-2 border-t border-sidebar-border" />
      {TAB_ITEMS.map((item) => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            }`}
          >
            <div className={`shrink-0 ${isActive ? 'text-primary' : ''}`}>{item.icon}</div>
            {/* Uses group-data on the parent sidebar aside[data-expanded] for opacity */}
            <span className="truncate whitespace-nowrap opacity-0 transition-opacity duration-200 group-data-[expanded]/sidebar:opacity-100">
              {item.label}
            </span>
          </button>
        )
      })}
    </>
  )
}
