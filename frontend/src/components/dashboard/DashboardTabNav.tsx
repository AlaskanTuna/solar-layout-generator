import { useLocation } from 'react-router-dom'
import { Gauge, FolderKanban, PieChart } from 'lucide-react'
import { SectionHeading, SidebarNavLink } from '@/components/layout/AppSidebar'

const NAV_ITEMS = [
  { to: '/dashboard/summary', label: 'Summary', icon: Gauge },
  { to: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { to: '/dashboard/analytics', label: 'Analytics', icon: PieChart },
]

export function DashboardTabNav() {
  const { pathname } = useLocation()

  return (
    <>
      <SectionHeading title="Insights" />
      {NAV_ITEMS.map((item) => (
        <SidebarNavLink
          key={item.to}
          to={item.to}
          icon={item.icon}
          label={item.label}
          active={pathname === item.to}
        />
      ))}
    </>
  )
}
