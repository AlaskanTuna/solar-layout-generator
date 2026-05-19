/**
 * Auth guard for private React Router branches.
 * Used around dashboard and project workflow routes before rendering nested page content.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Renders child routes only after auth loading completes and a session exists.
 * Redirects unauthenticated visitors to sign-in while preserving a full-screen loading state.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
}
