/**
 * Nested route layout for dashboard pages.
 * Places dashboard child routes inside the shared application shell.
 */

import { Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'

/**
 * Renders dashboard child routes through React Router's Outlet inside AppLayout.
 * Used as the parent layout for project lists, summaries, and support pages.
 */
export function DashboardLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
