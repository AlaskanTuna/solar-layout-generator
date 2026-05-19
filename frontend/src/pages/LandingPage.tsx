/**
 * Renders the public SolarSim landing page.
 * It is reached at / before authentication and introduces the FYP solar layout workflow.
 * This page serves the entry step that routes visitors into sign-up, sign-in, or the dashboard if already signed in.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { AppFooter } from '@/components/layout/AppFooter'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/Logo'
import {
  MapPin,
  Satellite,
  Move,
  Receipt,
  FileDown,
  ArrowRight,
  Shield,
  Zap,
  Star,
  Leaf,
  ChevronUp,
  Clock,
  Sun,
  Bot
} from 'lucide-react'

/** Renders the public marketing and product walkthrough page. */
export function LandingPage() {
  const { t } = useTranslation('landing')
  const { session, loading } = useAuth()
  const ticker = useHeroTicker()
  const heroImageRef = useRef<HTMLImageElement>(null)
  const scrollY = useScrollY()
  const navScrolled = scrollY > 24

  useEffect(() => {
    document.documentElement.classList.add('landing-snap')
    return () => document.documentElement.classList.remove('landing-snap')
  }, [])

  useEffect(() => {
    let raf = 0
    let lastBlur = -1

    const updateHeroBlur = () => {
      raf = 0
      const image = heroImageRef.current
      if (!image) return

      const nextBlur = Math.min(14, window.scrollY / 40)
      if (Math.abs(nextBlur - lastBlur) < 0.1) return

      lastBlur = nextBlur
      image.style.filter = `blur(${nextBlur.toFixed(1)}px)`
      image.style.transform = nextBlur > 0 ? 'scale(1.04)' : 'scale(1)'
    }

    const requestHeroBlur = () => {
      if (raf) return
      raf = window.requestAnimationFrame(updateHeroBlur)
    }

    updateHeroBlur()
    window.addEventListener('scroll', requestHeroBlur, { passive: true })

    return () => {
      window.removeEventListener('scroll', requestHeroBlur)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  if (loading) return null
  const isSignedIn = !!session

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      {/* Top navigation */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300 ${
          navScrolled ? 'glass-nav' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5">
            <Logo className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="font-heading text-base font-semibold tracking-tight sm:text-lg">SolarSim</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {isSignedIn ? (
              <Link to="/dashboard">
                <Button size="sm">{t('nav.goToDashboard')}</Button>
              </Link>
            ) : (
              <Link to="/sign-up">
                <Button size="sm">{t('nav.getStarted')}</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-screen snap-start overflow-hidden">
        <div className="absolute inset-0">
          <img
            ref={heroImageRef}
            src="/landing/landing-hero.webp"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[right_center] will-change-[filter]"
            style={{ filter: 'blur(0px)', transform: 'scale(1)' }}
          />
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background:
                'linear-gradient(90deg, rgba(253,249,244,0.85) 0%, rgba(253,249,244,0.45) 35%, rgba(253,249,244,0) 60%)'
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0) 60%)'
            }}
          />
        </div>

        <div className="relative mx-auto flex h-full max-w-7xl items-center px-6 pt-16">
          <div className="grid w-full items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="hero-glass max-w-2xl rounded-3xl p-6 sm:p-8 lg:p-12 animate-fade-in-up">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-orange-50/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#7c2d12] dark:border-white/10 dark:bg-stone-900/40 dark:text-orange-200 sm:mb-6">
                  <Sun className="h-3.5 w-3.5 text-primary" />
                  {t('hero.badge')}
                </div>

                <h1 className="font-heading text-4xl font-bold leading-[1.04] tracking-tight text-[#1a0a02] dark:text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                  {t('hero.title1')}
                  <br />
                  {t('hero.title2')}
                  <br />
                  <span className="bg-gradient-to-r from-[#7c2d12] via-primary to-emerald-600 bg-clip-text text-transparent dark:from-orange-300 dark:via-primary dark:to-emerald-400">
                    {t('hero.titleHighlight')}
                  </span>
                </h1>

                <p className="mt-5 max-w-lg text-base leading-relaxed text-[#1a0a02]/75 dark:text-foreground/75 sm:mt-6 sm:text-lg">
                  <HeroSubtitle text={t('hero.subtitle')} />
                </p>

                <div className="mt-8 flex flex-wrap gap-x-4 gap-y-3 font-mono text-[11px] uppercase tracking-wider text-[#1a0a02]/60 dark:text-foreground/60 sm:mt-10 sm:gap-x-7">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t('hero.metaFreeToStart')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t('hero.metaNoCall')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t('hero.metaResults')}
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:col-span-5 lg:block">
              <div className="relative ml-auto max-w-md animate-fade-in-up [animation-delay:120ms]">
                <div
                  className="rounded-2xl p-6 text-white"
                  style={{
                    background: 'rgba(28,10,2,0.62)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)'
                  }}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-amber-100/70 transition-opacity duration-300">
                      {t('hero.card.sampleReport', { location: ticker.location })}
                    </div>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/25 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                      {t('hero.card.live')}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-amber-100/60">
                        {t('hero.card.systemSize')}
                      </div>
                      <div className="mt-0.5 font-heading text-3xl font-bold">
                        <span className="tabular-nums">{ticker.kwp.toFixed(1)}</span>{' '}
                        <span className="text-base font-normal text-amber-100/70">kWp</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-orange-300/25 bg-orange-400/15 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-orange-200">
                          {t('hero.card.yearlySavings')}
                        </div>
                        <div className="mt-1 font-heading text-xl font-bold">
                          RM <span className="tabular-nums">{ticker.savings.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-200">
                          {t('hero.card.payback')}
                        </div>
                        <div className="mt-1 font-heading text-xl font-bold">
                          <span className="tabular-nums">{ticker.payback.toFixed(1)}</span>{' '}
                          <span className="text-sm font-normal text-amber-100/70">yrs</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-amber-100/60">
                        {t('hero.card.monthlyYield')}
                      </div>
                      <div className="flex h-16 items-end gap-1">
                        {ticker.monthly.map((h, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm transition-all duration-700 ease-out ${
                              h > 86
                                ? 'bg-gradient-to-b from-amber-300 to-orange-500'
                                : 'bg-gradient-to-b from-orange-400 to-orange-600'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-amber-100/50">
                        <span>JAN</span>
                        <span>JUN</span>
                        <span>DEC</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute -left-4 -top-4 rounded-xl bg-card px-3 py-2 shadow-lg"
                  style={{ transform: 'rotate(-4deg)' }}
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {t('hero.card.sdgLabel')}
                  </div>
                  <div className="font-heading text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {t('hero.card.sdgTitle')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section
        aria-label="Trust signals"
        className="snap-start overflow-hidden border-y border-white/10 bg-stone-900 py-7 dark:border-white/5"
      >
        <div className="flex w-max animate-marquee items-center gap-12 px-6 font-mono text-sm uppercase tracking-[0.18em] text-stone-400">
          <TrustItem icon={<Star className="h-3.5 w-3.5 text-primary" />} label={t('trust.googleSolarApi')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Zap className="h-3.5 w-3.5 text-primary" />} label={t('trust.nemSimulation')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />} label={t('trust.sdg7')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<MapPin className="h-3.5 w-3.5 text-primary" />} label={t('trust.dragDrop')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Shield className="h-3.5 w-3.5 text-emerald-400" />} label={t('trust.pdfReports')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Star className="h-3.5 w-3.5 text-primary" />} label={t('trust.googleSolarApi')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Zap className="h-3.5 w-3.5 text-primary" />} label={t('trust.nemSimulation')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />} label={t('trust.sdg7')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<MapPin className="h-3.5 w-3.5 text-primary" />} label={t('trust.rp4Tariff')} />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Shield className="h-3.5 w-3.5 text-emerald-400" />} label={t('trust.pdfReports')} />
          <span className="text-stone-700">·</span>
        </div>
      </section>

      {/* Pipeline section */}
      <PipelineSection />

      {/* Features */}
      <section id="features" className="snap-start px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">
              {t('features.eyebrow')}
            </div>
            <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              {t('features.title')}
              <br />
              <span className="text-muted-foreground">{t('features.titleMuted')}</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              accent="tangerine"
              icon={<Satellite className="h-5 w-5" />}
              title={t('features.cards.satellite.title')}
              description={t('features.cards.satellite.description')}
            />
            <FeatureCard
              accent="leaf"
              icon={<Move className="h-5 w-5" />}
              title={t('features.cards.workbench.title')}
              description={t('features.cards.workbench.description')}
            />
            <FeatureCard
              accent="tangerine"
              icon={<Receipt className="h-5 w-5" />}
              title={t('features.cards.billing.title')}
              description={t('features.cards.billing.description')}
            />
            <FeatureCard
              accent="leaf"
              icon={<FileDown className="h-5 w-5" />}
              title={t('features.cards.pdf.title')}
              description={t('features.cards.pdf.description')}
            />
            <FeatureCard
              accent="tangerine"
              icon={<Clock className="h-5 w-5" />}
              title={t('features.cards.seasonal.title')}
              description={t('features.cards.seasonal.description')}
            />
            <FeatureCard
              accent="leaf"
              icon={<Bot className="h-5 w-5" />}
              title={t('features.cards.assistant.title')}
              description={t('features.cards.assistant.description')}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="snap-start px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">{t('pricing.eyebrow')}</div>
            <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              {t('pricing.title')}
              <br />
              {t('pricing.titleMuted')}
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            <PricingCard
              tier={t('pricing.tiers.free.name')}
              price={t('pricing.tiers.free.price')}
              description={t('pricing.tiers.free.description')}
              features={t('pricing.tiers.free.features', { returnObjects: true }) as string[]}
              cta={t('pricing.tiers.free.cta')}
              ctaLink="/sign-up"
            />
            <PricingCard
              tier={t('pricing.tiers.pro.name')}
              price={t('pricing.tiers.pro.price')}
              period={t('pricing.tiers.pro.period')}
              description={t('pricing.tiers.pro.description')}
              features={t('pricing.tiers.pro.features', { returnObjects: true }) as string[]}
              cta={t('pricing.tiers.pro.cta')}
              highlighted
              disabled
            />
            <PricingCard
              tier={t('pricing.tiers.enterprise.name')}
              price={t('pricing.tiers.enterprise.price')}
              description={t('pricing.tiers.enterprise.description')}
              features={t('pricing.tiers.enterprise.features', { returnObjects: true }) as string[]}
              cta={t('pricing.tiers.enterprise.cta')}
              disabled
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="snap-start bg-card px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-14 text-center">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">{t('faq.eyebrow')}</div>
            <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              {t('faq.title')}
              <br />
              <span className="text-muted-foreground">{t('faq.titleMuted')}</span>
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <FaqItem
              question={t('faq.questions.replaceInstaller.question')}
              answer={t('faq.questions.replaceInstaller.answer')}
              defaultOpen
              first
            />
            <FaqItem question={t('faq.questions.accuracy.question')} answer={t('faq.questions.accuracy.answer')} />
            <FaqItem
              question={t('faq.questions.addressNotFound.question')}
              answer={t('faq.questions.addressNotFound.answer')}
            />
            <FaqItem
              question={t('faq.questions.eastMalaysia.question')}
              answer={t('faq.questions.eastMalaysia.answer')}
            />
            <FaqItem
              question={t('faq.questions.dataPrivacy.question')}
              answer={t('faq.questions.dataPrivacy.answer')}
            />
          </div>

          <p
            id="asterisk-note"
            className="mx-auto mt-3 max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground/80 scroll-mt-24"
          >
            {t('faq.asteriskNote')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <div className="snap-end">
        <AppFooter />
      </div>

      <button
        type="button"
        aria-label={t('scrollToTop')}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-8 left-1/2 z-40 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/60 bg-white/40 text-foreground shadow-[0_8px_24px_rgba(234,88,12,0.18)] backdrop-blur-xl transition-all duration-300 hover:bg-white/60 dark:border-white/10 dark:bg-stone-900/55 dark:text-foreground dark:hover:bg-stone-900/75 ${
          scrollY > 400 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </div>
  )
}

function useScrollY() {
  const [y, setY] = useState(0)
  const yRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const shouldPublish = (previous: number, next: number) =>
      previous === 0 || previous <= 24 !== next <= 24 || previous <= 400 !== next <= 400

    const update = () => {
      raf = 0
      const next = window.scrollY
      const previous = yRef.current
      yRef.current = next
      if (shouldPublish(previous, next)) setY(next)
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(update)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])
  return y
}

type HeroProfile = {
  location: string
  kwp: number
  savings: number
  payback: number
  monthly: number[]
}

const HERO_PROFILES: HeroProfile[] = [
  {
    location: 'Bandar Utama · PJ',
    kwp: 8.4,
    savings: 5840,
    payback: 5.7,
    monthly: [62, 70, 80, 88, 96, 92, 84, 90, 82, 74, 68, 60]
  },
  {
    location: 'George Town · Penang',
    kwp: 5.6,
    savings: 4120,
    payback: 6.2,
    monthly: [58, 66, 76, 84, 90, 86, 78, 82, 80, 72, 64, 56]
  },
  {
    location: 'Mount Austin · JB',
    kwp: 11.2,
    savings: 7950,
    payback: 5.2,
    monthly: [70, 76, 84, 92, 98, 94, 88, 92, 86, 78, 72, 64]
  },
  {
    location: 'Section 7 · Shah Alam',
    kwp: 7.8,
    savings: 5240,
    payback: 5.9,
    monthly: [60, 68, 78, 86, 94, 90, 82, 88, 80, 72, 66, 58]
  },
  {
    location: 'PJU 5 · Kota Damansara',
    kwp: 9.2,
    savings: 6480,
    payback: 5.5,
    monthly: [64, 72, 82, 90, 96, 92, 86, 90, 84, 76, 70, 62]
  }
]

function useHeroTicker() {
  const [profileIdx, setProfileIdx] = useState(0)
  const [vals, setVals] = useState({ kwp: 6.2, savings: 3000, payback: 8.5 })
  const valsRef = useRef(vals)
  valsRef.current = vals

  useEffect(() => {
    const id = setInterval(() => setProfileIdx((i) => (i + 1) % HERO_PROFILES.length), 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const target = HERO_PROFILES[profileIdx]
    const start = { ...valsRef.current }
    const dur = 1100
    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const ease = 1 - Math.pow(1 - p, 3)
      setVals({
        kwp: start.kwp + (target.kwp - start.kwp) * ease,
        savings: Math.round(start.savings + (target.savings - start.savings) * ease),
        payback: start.payback + (target.payback - start.payback) * ease
      })
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [profileIdx])

  const profile = useMemo(() => HERO_PROFILES[profileIdx], [profileIdx])
  return { ...vals, location: profile.location, monthly: profile.monthly }
}

function HeroSubtitle({ text }: { text: string }) {
  const idx = text.indexOf('*')
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <a
        href="#asterisk-note"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('asterisk-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
        className="cursor-pointer text-inherit no-underline hover:text-primary"
      >
        *
      </a>
      {text.slice(idx + 1)}
    </>
  )
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      {icon}
      {label}
    </span>
  )
}

type PipelineStep = {
  num: string
  label: string
  title: string
  body: string
  tags: { label: string; tone: 'tangerine' | 'leaf' }[]
  mockSrc: string
  mockHost: string
  mockHeadline: string
  mockSub: string
  mockBg: string
}

function PipelineSection() {
  const { t } = useTranslation('landing')
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLElement | null)[]>([])

  const PIPELINE_STEPS: PipelineStep[] = [
    {
      num: t('pipeline.steps.step1.num'),
      label: t('pipeline.steps.step1.label'),
      title: t('pipeline.steps.step1.title'),
      body: t('pipeline.steps.step1.body'),
      tags: [
        { label: t('pipeline.steps.step1.tagGoogleMaps'), tone: 'tangerine' },
        { label: t('pipeline.steps.step1.tagSolarApi'), tone: 'tangerine' }
      ],
      mockSrc: '/screenshots/map.webp',
      mockHost: t('pipeline.steps.step1.mockHost'),
      mockHeadline: t('pipeline.steps.step1.mockHeadline'),
      mockSub: t('pipeline.steps.step1.mockSub'),
      mockBg: 'linear-gradient(135deg, #1a1f1a, #23291f 40%, #3a4233 100%)'
    },
    {
      num: t('pipeline.steps.step2.num'),
      label: t('pipeline.steps.step2.label'),
      title: t('pipeline.steps.step2.title'),
      body: t('pipeline.steps.step2.body'),
      tags: [
        { label: t('pipeline.steps.step2.tagCanvas'), tone: 'leaf' },
        { label: t('pipeline.steps.step2.tagLiveYield'), tone: 'leaf' }
      ],
      mockSrc: '/screenshots/workbench.webp',
      mockHost: t('pipeline.steps.step2.mockHost'),
      mockHeadline: t('pipeline.steps.step2.mockHeadline'),
      mockSub: t('pipeline.steps.step2.mockSub'),
      mockBg: 'linear-gradient(135deg, #221a13, #3a2a1c 60%, #2a3525 100%)'
    },
    {
      num: t('pipeline.steps.step3.num'),
      label: t('pipeline.steps.step3.label'),
      title: t('pipeline.steps.step3.title'),
      body: t('pipeline.steps.step3.body'),
      tags: [
        { label: t('pipeline.steps.step3.tagRp4'), tone: 'tangerine' },
        { label: t('pipeline.steps.step3.tagPdf'), tone: 'tangerine' }
      ],
      mockSrc: '/screenshots/analysis.webp',
      mockHost: t('pipeline.steps.step3.mockHost'),
      mockHeadline: t('pipeline.steps.step3.mockHeadline'),
      mockSub: t('pipeline.steps.step3.mockSub'),
      mockBg: 'linear-gradient(135deg, #1a140e, #2a1f15)'
    }
  ]

  useEffect(() => {
    function update() {
      const trigger = window.innerHeight * 0.5
      let idx = 0
      stepRefs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= trigger) idx = i
      })
      setActive(idx)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <section id="how" className="relative snap-start bg-card px-6 text-foreground">
      <div className="mx-auto max-w-7xl pb-12 pt-16 lg:pb-16 lg:pt-24">
        <div className="max-w-2xl">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">{t('pipeline.eyebrow')}</div>
          <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t('pipeline.title')}
            <br />
            <span className="text-muted-foreground">{t('pipeline.titleMuted')}</span>
          </h2>
        </div>
      </div>

      <div className="mx-auto max-w-7xl pb-20 lg:pb-32">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-2 lg:col-span-6">
            {PIPELINE_STEPS.map((step, i) => {
              const isActive = i === active
              return (
                <article
                  key={step.num}
                  ref={(el) => {
                    stepRefs.current[i] = el
                  }}
                  className={`snap-start border-t py-10 transition-colors duration-300 ${
                    isActive ? 'border-primary/45' : 'border-border'
                  }`}
                >
                  <div
                    className={`mb-3 font-mono text-xs uppercase tracking-[0.18em] transition-colors duration-300 ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {step.num} ({step.label})
                  </div>
                  <h3
                    className={`mb-4 font-heading text-2xl font-bold leading-tight transition-colors duration-300 sm:text-3xl md:text-4xl ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="max-w-md text-base leading-relaxed text-muted-foreground">{step.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {step.tags.map((tag) => (
                      <span
                        key={tag.label}
                        className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${
                          tag.tone === 'leaf'
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300'
                            : 'border-primary/25 bg-primary/10 text-primary dark:text-orange-300'
                        }`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="lg:col-span-6">
            <div className="sticky top-28">
              <div className="relative h-[280px] sm:h-[360px] lg:h-[460px]">
                {PIPELINE_STEPS.map((step, i) => (
                  <PipelineMock key={step.num} step={step} visible={i === active} />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-center gap-2">
                {PIPELINE_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === active ? 'w-8 bg-primary' : 'w-5 bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PipelineMock({ step, visible }: { step: PipelineStep; visible: boolean }) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-[20px] border border-white/10 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ background: '#161310' }}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-3.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-stone-500">{step.mockHost}</span>
      </div>

      <div className="relative h-[calc(100%-2.25rem)]">
        <img
          src={step.mockSrc}
          alt=""
          aria-hidden="true"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={`absolute inset-0 flex flex-col justify-between p-7 transition-opacity duration-300 ${
            imgLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ background: step.mockBg }}
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-orange-400">{step.label}</div>
          <div>
            <div className="font-heading text-4xl font-bold text-white sm:text-5xl">{step.mockHeadline}</div>
            <div className="mt-2 font-mono text-xs uppercase tracking-wider text-stone-400">{step.mockSub}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  accent = 'tangerine'
}: {
  icon: React.ReactNode
  title: string
  description: string
  accent?: 'tangerine' | 'leaf'
}) {
  const iconClass =
    accent === 'leaf'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200'
  return (
    <div className="group rounded-3xl border border-border bg-gradient-to-b from-card to-orange-50/40 p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_20px_40px_-20px_rgba(234,88,12,0.25)] dark:from-card dark:to-stone-900/50">
      <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      <h3 className="font-heading text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function FaqItem({
  question,
  answer,
  defaultOpen,
  first
}: {
  question: string
  answer: string
  defaultOpen?: boolean
  first?: boolean
}) {
  return (
    <details open={defaultOpen} className={`group px-6 ${first ? '' : 'border-t border-border'}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-heading text-lg font-semibold marker:hidden">
        {question}
        <span className="text-2xl font-light text-primary transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="-mt-1 pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
    </details>
  )
}

function PricingCard({
  tier,
  price,
  period,
  description,
  features,
  cta,
  ctaLink,
  highlighted,
  disabled
}: {
  tier: string
  price: string
  period?: string
  description: string
  features: string[]
  cta: string
  ctaLink?: string
  highlighted?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation('landing')

  if (highlighted) {
    return (
      <div className="relative flex flex-col rounded-2xl bg-gradient-to-b from-stone-900 to-[#2a1505] p-8 text-white shadow-[0_30px_60px_-20px_rgba(234,88,12,0.4)]">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-400 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-900">
          {t('pricing.mostPopular')}
        </span>
        <div className="font-heading text-xl font-bold">{tier}</div>
        <p className="mt-1 text-sm text-stone-300">{description}</p>
        <div className="mb-1 mt-6">
          <span className="font-heading text-5xl font-bold">{price}</span>
          {period && <span className="text-sm text-stone-300">{period}</span>}
        </div>
        <ul className="mt-6 flex-1 space-y-3 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-300">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-7 w-full justify-center gap-2 rounded-full" disabled={disabled}>
          {cta}
          {!disabled && <ArrowRight className="h-3.5 w-3.5" />}
        </Button>
      </div>
    )
  }

  const inner = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-8">
      <div className="font-heading text-xl font-bold">{tier}</div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mb-1 mt-6">
        <span className="font-heading text-5xl font-bold">{price}</span>
        {period && <span className="text-sm text-muted-foreground">{period}</span>}
      </div>
      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7 inline-flex items-center justify-center rounded-full border-2 border-foreground/80 px-5 py-3 font-heading text-sm font-medium transition hover:bg-foreground hover:text-background">
        {cta}
      </div>
    </div>
  )

  if (ctaLink && !disabled) {
    return <Link to={ctaLink}>{inner}</Link>
  }
  return inner
}
