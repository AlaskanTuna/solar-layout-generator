import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
}
