/**
 * Renders the catch-all 404 fallback route.
 * It is reached when React Router cannot match the current URL to any public or protected page.
 * This page serves the recovery step that sends users back to the landing page or dashboard.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Sun, ArrowLeft } from 'lucide-react'

/** Renders the 404 fallback page with navigation recovery actions. */
export function NotFoundPage() {
  const { t } = useTranslation('nav')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      {/* Error content */}
      <div className="relative animate-fade-in-up">
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Sun className="h-10 w-10 text-primary" />
          </div>
        </div>

        <h1 className="font-heading text-7xl font-bold tracking-tight text-foreground sm:text-8xl">404</h1>
        <p className="mt-4 text-xl font-medium text-foreground">{t('notFound.title')}</p>
        <p className="mt-2 max-w-md text-muted-foreground">{t('notFound.subtitle')}</p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/">
            <Button size="lg" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('notFound.backHome')}
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg">
              {t('notFound.goToDashboard')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
