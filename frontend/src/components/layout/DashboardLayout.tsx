import { Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'

/**
 * Renders the DashboardLayout component
 */
export function DashboardLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
