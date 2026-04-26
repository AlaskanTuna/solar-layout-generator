import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Loader2, Mail } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export function SignUpPage() {
  const { session, loading, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-solar-600 to-solar-800 p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary-foreground/10 blur-[100px]" />
          <div className="absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-solar-400/20 blur-[80px]" />
        </div>

        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-heading text-lg font-semibold text-primary-foreground">SolarSim</span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="font-heading text-3xl font-bold leading-tight text-primary-foreground">
            Start your solar assessment today
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-primary-foreground/70">
            Join homeowners across Malaysia who are making data-driven decisions about rooftop solar.
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/40">2026 SolarSim</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <Logo className="h-7 w-7" />
            <span className="font-heading text-base font-semibold">SolarSim</span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm animate-fade-in">
            {success ? (
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h1 className="font-heading text-2xl font-bold tracking-tight">Check your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We&apos;ve sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click the
                  link to activate your account.
                </p>
                <Link to="/sign-in" className="mt-6 block">
                  <Button variant="outline" className="w-full">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="font-heading text-2xl font-bold tracking-tight">Create an account</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Get started with your free solar assessment</p>
                </div>

                <GoogleSignInButton label="Sign up with Google" onError={setError} />

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Or continue with email</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Sign Up'
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/sign-in" className="font-medium text-primary transition-colors hover:text-primary/80">
                    Sign In
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
