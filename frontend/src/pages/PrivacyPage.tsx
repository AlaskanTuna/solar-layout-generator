import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { AppFooter } from '@/components/layout/AppFooter'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Logo } from '@/components/ui/Logo'

const SECTION_ORDER = [
  'intro',
  'dataCollected',
  'purpose',
  'lawfulBasis',
  'retention',
  'sharing',
  'rights',
  'cookies',
  'security',
  'transfer',
  'updates',
  'contact'
] as const

type SectionKey = (typeof SECTION_ORDER)[number]
type Section = { title: string; body: string[] }

/** Public PDPA-compliant privacy & data security disclosure. */
export function PrivacyPage() {
  const { t } = useTranslation('privacy')

  const sections = t('sections', { returnObjects: true }) as Record<SectionKey, Section>

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80">
          <Logo className="h-7 w-7" />
          <span className="font-heading text-base font-semibold tracking-tight">SolarSim</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{t('header.title')}</h1>
          <p className="mt-3 text-base text-muted-foreground">{t('header.subtitle')}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t('header.lastUpdated')}</p>
        </div>

        {/* Table of contents (desktop only) */}
        <nav
          className="mb-10 hidden rounded-xl border border-border bg-card/60 p-4 sm:block"
          aria-label={t('tableOfContents')}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('tableOfContents')}
          </p>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {SECTION_ORDER.map((key, i) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {i + 1}. {sections[key]?.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-10">
          {SECTION_ORDER.map((key, i) => {
            const section = sections[key]
            if (!section) return null
            return (
              <section key={key} id={key} className="scroll-mt-20">
                <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                  {i + 1}. {section.title}
                </h2>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {section.body.map((paragraph, j) => (
                    <p key={j}>{paragraph}</p>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
