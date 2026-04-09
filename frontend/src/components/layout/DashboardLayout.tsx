import { Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { DashboardTabNav } from '@/components/dashboard/DashboardTabNav'

/** Shared layout for all /dashboard/* routes — injects INSIGHTS nav into the sidebar */
export function DashboardLayout() {
  return (
    <AppLayout sidebarChildren={<DashboardTabNav />}>
      <Outlet />
    </AppLayout>
  )
}
