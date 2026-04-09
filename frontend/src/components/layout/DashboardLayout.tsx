import { Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'

/** Shared layout for all /dashboard/* routes */
export function DashboardLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
