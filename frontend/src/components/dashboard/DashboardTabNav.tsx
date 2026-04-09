import { Gauge, FolderKanban, PieChart } from 'lucide-react'
import { SectionHeading } from '@/components/layout/AppSidebar'

export type DashboardTab = 'summary' | 'projects' | 'analytics'

const TAB_ITEMS: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Summary', icon: Gauge },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
]

export function DashboardTabNav({
  activeTab,
  onTabChange,
}: {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
}) {
  return (
    <>
      <SectionHeading title="Insights" />

      {TAB_ITEMS.map((item) => {
        const isActive = activeTab === item.id
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <span className="flex w-8 shrink-0 items-center justify-center">
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive
                    ? 'text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground'
                }`}
              />
            </span>
            <span className="flex-1 truncate whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150">
              {item.label}
            </span>
          </button>
        )
      })}
    </>
  )
}
