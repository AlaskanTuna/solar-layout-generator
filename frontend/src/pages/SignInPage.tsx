import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Leaf, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const REMEMBER_EMAIL_KEY = 'slg-remember-email'

/**
 * Renders the sign-in flow
 */
export function SignInPage() {
  const { t } = useTranslation('auth')
  const { t: tNav } = useTranslation('nav')
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const rememberedEmail = typeof window !== 'undefined' ? (window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? '') : ''
  const [email, setEmail] = useState(rememberedEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rememberMe, setRememberMe] = useState(rememberedEmail.length > 0)

  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setSubmitting(false)
    } else {
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email)
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-solar-600 to-solar-800 p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary-foreground/10 blur-[100px]" />
          <div className="absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-solar-400/20 blur-[80px]" />
        </div>

        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-heading text-lg font-semibold text-[#1a0a02] dark:text-primary-foreground">
              SolarSim
            </span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="font-heading text-3xl font-bold leading-tight text-[#1a0a02] dark:text-primary-foreground">
            {t('signIn.panelHeading')}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#1a0a02]/75 dark:text-primary-foreground/70">
            {t('signIn.panelSubtitle')}
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#1a0a02]/55 dark:text-primary-foreground/40">
          <span>{t('branding.tagline2026')}</span>
          <span className="h-3 w-px bg-[#1a0a02]/25 dark:bg-primary-foreground/25" />
          <span className="flex items-center gap-1.5">
            <Leaf className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
            {tNav('footer.sdg')}
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col">
        {/* Mobile logo + theme/language toggles */}
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <Logo className="h-7 w-7" />
            <span className="font-heading text-base font-semibold">SolarSim</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm animate-fade-in">
            {/* Heading */}
            <div className="mb-8">
              <h1 className="font-heading text-2xl font-bold tracking-tight">{t('signIn.title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('signIn.subtitle')}</p>
            </div>

            {/* Google OAuth */}
            <GoogleSignInButton label={t('signIn.googleButton')} onError={setError} />

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('signIn.orDivider')}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Email/password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('signIn.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('signIn.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('signIn.passwordLabel')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <label className="group flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded border border-input bg-background shadow-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background group-hover:border-foreground/40"
                >
                  <svg
                    className="h-3 w-3 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: rememberMe ? 1 : 0 }}
                  >
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                </span>
                {t('signIn.rememberEmail')}
              </label>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('signIn.submitting')}
                  </>
                ) : (
                  t('signIn.submitButton')
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t('signIn.noAccount')}{' '}
              <Link to="/sign-up" className="font-medium text-primary transition-colors hover:text-primary/80">
                {t('signIn.signUpLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
