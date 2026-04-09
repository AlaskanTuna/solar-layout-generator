import { Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'

/** Shared layout for all /dashboard/* routes — content fills viewport, footer below fold */
export function DashboardLayout() {
  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-3.5rem)]">
        <Outlet />
      </div>
    </AppLayout>
  )
}
