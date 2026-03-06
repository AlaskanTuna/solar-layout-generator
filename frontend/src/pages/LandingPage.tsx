import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export function LandingPage() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Solar Layout Generator</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        Assess your rooftop solar potential using real satellite data and Malaysian NEM tariff rates.
      </p>
      <div className="mt-8 flex gap-4">
        <Link to="/sign-in">
          <Button size="lg">Get Started</Button>
        </Link>
        <Link to="/sign-up">
          <Button variant="outline" size="lg">
            Create Account
          </Button>
        </Link>
      </div>
    </div>
  )
}
