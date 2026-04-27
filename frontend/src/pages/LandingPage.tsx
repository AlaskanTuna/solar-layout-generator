import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/Logo'
import {
  MapPin,
  SlidersHorizontal,
  FileBarChart,
  Satellite,
  Move,
  Receipt,
  FileDown,
  ArrowRight,
  Shield,
  Zap,
  Star,
  Leaf,
  ChevronDown,
  ChevronRight,
  Clock,
  Sun,
  BookOpen
} from 'lucide-react'

export function LandingPage() {
  const { session, loading } = useAuth()
  const ticker = useHeroTicker()

  if (loading) return null
  const isSignedIn = !!session

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      {/* Navbar */}
      <nav className="glass-nav fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-heading text-lg font-semibold tracking-tight">SolarSim</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="transition hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="transition hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="transition hover:text-foreground">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isSignedIn ? (
              <Link to="/dashboard">
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/sign-up">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[100vh] overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="/landing/landing-hero.webp"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[right_center]"
          />
          {/* Warm light-mode legibility wash on left half */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background:
                'linear-gradient(90deg, rgba(253,249,244,0.85) 0%, rgba(253,249,244,0.45) 35%, rgba(253,249,244,0) 60%)'
            }}
          />
          {/* Dark-mode darkening overlay */}
          <div className="absolute inset-0 hidden bg-background/65 dark:block" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-24 lg:pt-40 lg:pb-32">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left: glass content card */}
            <div className="lg:col-span-7">
              <div className="hero-glass max-w-2xl rounded-3xl p-8 sm:p-12 animate-fade-in-up">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-orange-50/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#7c2d12] dark:border-white/10 dark:bg-stone-900/40 dark:text-orange-200">
                  <Sun className="h-3.5 w-3.5 text-primary" />
                  Built for Malaysian rooftops
                </div>

                <h1 className="font-heading text-5xl font-bold leading-[1.04] tracking-tight text-[#1a0a02] dark:text-foreground sm:text-6xl lg:text-7xl">
                  See solar on
                  <br />
                  your roof —
                  <br />
                  <span className="bg-gradient-to-r from-[#7c2d12] via-primary to-emerald-600 bg-clip-text text-transparent dark:from-orange-300 dark:via-primary dark:to-emerald-400">
                    before you commit.
                  </span>
                </h1>

                <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#1a0a02]/75 dark:text-foreground/75">
                  SolarSim drops real solar panels onto your actual rooftop using satellite data, then runs the numbers
                  under Malaysia's NEM Rakyat 3.0 — so you walk into installer quotes already knowing the answer.
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link to={isSignedIn ? '/dashboard' : '/sign-up'}>
                    <Button size="lg" className="gap-2 rounded-full px-7 text-base">
                      {isSignedIn ? 'Open Dashboard' : 'Get Started Free'}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#how">
                    <Button variant="outline" size="lg" className="gap-2 rounded-full text-base">
                      How it works
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </a>
                </div>

                {/* Inline meta dots */}
                <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 font-mono text-[11px] uppercase tracking-wider text-[#1a0a02]/60 dark:text-foreground/60">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Free to start
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    No installer call
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Results in 90 sec
                  </span>
                </div>
              </div>
            </div>

            {/* Right: sample report card (lg+ only) */}
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
                    <div className="font-mono text-[11px] uppercase tracking-wider text-amber-100/70">
                      Sample report · Bandar Utama
                    </div>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/25 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                      LIVE
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-amber-100/60">System size</div>
                      <div className="mt-0.5 font-heading text-3xl font-bold">
                        <span className="tabular-nums">{ticker.kwp.toFixed(1)}</span>{' '}
                        <span className="text-base font-normal text-amber-100/70">kWp</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-orange-300/25 bg-orange-400/15 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-orange-200">Yearly savings</div>
                        <div className="mt-1 font-heading text-xl font-bold">
                          RM <span className="tabular-nums">{ticker.savings.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-200">Payback</div>
                        <div className="mt-1 font-heading text-xl font-bold">
                          <span className="tabular-nums">{ticker.payback.toFixed(1)}</span>{' '}
                          <span className="text-sm font-normal text-amber-100/70">yrs</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini bar chart */}
                    <div>
                      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-amber-100/60">
                        Monthly yield (kWh)
                      </div>
                      <div className="flex h-16 items-end gap-1">
                        {[62, 70, 80, 88, 96, 92, 84, 90, 82, 74, 68, 60].map((h, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm ${
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

                {/* Floating SDG badge */}
                <div
                  className="absolute -left-4 -top-4 rounded-xl bg-card px-3 py-2 shadow-lg"
                  style={{ transform: 'rotate(-4deg)' }}
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    SDG 7
                  </div>
                  <div className="font-heading text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Clean energy
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[#1a0a02]/55 dark:text-foreground/55 md:flex">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">scroll</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>
      </section>

      {/* Trust band — scrolling marquee */}
      <section
        aria-label="Trust signals"
        className="overflow-hidden border-y border-white/10 bg-stone-900 py-7 dark:border-white/5"
      >
        <div className="flex w-max animate-marquee items-center gap-12 px-6 font-mono text-sm uppercase tracking-[0.18em] text-stone-400">
          <TrustItem icon={<Star className="h-3.5 w-3.5 text-primary" />} label="Powered by Google Solar API" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Zap className="h-3.5 w-3.5 text-primary" />} label="NEM Rakyat 3.0 compliant" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />} label="Aligned with UN SDG 7" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<MapPin className="h-3.5 w-3.5 text-primary" />} label="Peninsular Malaysia tariff" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Shield className="h-3.5 w-3.5 text-emerald-400" />} label="No data sold" />
          <span className="text-stone-700">·</span>
          {/* Duplicated for seamless loop */}
          <TrustItem icon={<Star className="h-3.5 w-3.5 text-primary" />} label="Powered by Google Solar API" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Zap className="h-3.5 w-3.5 text-primary" />} label="NEM Rakyat 3.0 compliant" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />} label="Aligned with UN SDG 7" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<MapPin className="h-3.5 w-3.5 text-primary" />} label="Peninsular Malaysia tariff" />
          <span className="text-stone-700">·</span>
          <TrustItem icon={<Shield className="h-3.5 w-3.5 text-emerald-400" />} label="No data sold" />
          <span className="text-stone-700">·</span>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center animate-fade-in">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">How It Works</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to solar clarity
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              From address search to savings report — no engineering degree required.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <StepCard
              step={1}
              icon={<MapPin className="h-6 w-6" />}
              title="Search Your Location"
              description="Enter your address and confirm your building on the satellite map. We fetch real rooftop data from Google Solar API."
            />
            <StepCard
              step={2}
              icon={<SlidersHorizontal className="h-6 w-6" />}
              title="Adjust Your Layout"
              description="Fine-tune your solar panel layout on an interactive canvas. Drag, rotate, add or remove panels to match your roof."
            />
            <StepCard
              step={3}
              icon={<FileBarChart className="h-6 w-6" />}
              title="Analyze Your Savings"
              description="See your projected monthly savings, payback period and bill breakdown based on current Malaysian NEM tariff rates."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">★ What's inside</div>
            <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              Built like an engineer would.
              <br />
              <span className="text-muted-foreground">Designed for everyone else.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              accent="tangerine"
              icon={<Satellite className="h-5 w-5" />}
              title="Real satellite, not estimates"
              description="Every panel sits on actual rooftop geometry from Google Solar API. We don't ask you for measurements you don't have."
            />
            <FeatureCard
              accent="leaf"
              icon={<Move className="h-5 w-5" />}
              title="Drag-to-edit workbench"
              description="Auto-layout you don't like? Move, rotate, delete any panel. Yield recalculates the moment you let go."
            />
            <FeatureCard
              accent="tangerine"
              icon={<Receipt className="h-5 w-5" />}
              title="RP4 + NEM, line by line"
              description="Bills modeled with the post-July 2025 RP4 tariff, EEI rebates, AFA, SST, RE Fund — every charge attributable to a row."
            />
            <FeatureCard
              accent="leaf"
              icon={<FileDown className="h-5 w-5" />}
              title="Installer-ready PDF"
              description="Export a one-click report with system summary, monthly breakdown, and 25-year projection. Walk into quotes informed."
            />
            <FeatureCard
              accent="tangerine"
              icon={<Clock className="h-5 w-5" />}
              title="Seasonal consumption profiles"
              description="Tell us how your usage shifts in school holidays, fasting month, year-end. We'll model it month-by-month."
            />
            <FeatureCard
              accent="leaf"
              icon={<BookOpen className="h-5 w-5" />}
              title="Citations on every number"
              description="Every kWh, every ringgit traces back to a published source — TNB tariff sheet, ST gazette, Google Solar API record."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">★ Pricing</div>
            <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              Free to start.
              <br />
              Pay only when you need more.
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            <PricingCard
              tier="Free"
              price="RM 0"
              description="For homeowners exploring solar."
              features={['5 projects per day', 'Auto-layout + manual edit', 'NEM bill simulation', 'Standard PDF export']}
              cta="Get started"
              ctaLink="/sign-up"
            />
            <PricingCard
              tier="Pro"
              price="RM 29"
              period="/month"
              description="For serious solar planners."
              features={[
                '20 projects per day',
                'Seasonal consumption profiles',
                'Detailed PDF + 25-year projection',
                'Email support · 24h SLA'
              ]}
              cta="Coming soon"
              highlighted
              disabled
            />
            <PricingCard
              tier="Enterprise"
              price="Custom"
              description="For installers and consultants."
              features={[
                'Unlimited projects',
                'Team + client collaboration',
                'White-label PDF reports',
                'API access · dedicated support'
              ]}
              cta="Contact sales"
              disabled
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-card px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-14 text-center">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary">★ Common questions</div>
            <h2 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              Things people ask before
              <br />
              signing up.
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <FaqItem
              question="Does this replace an installer's site visit?"
              answer="No — and we don't pretend to. SolarSim gives you a strong preliminary estimate so you walk into installer conversations informed. Final sizing, structural assessment, and inverter selection still need a qualified installer on-site."
              defaultOpen
              first
            />
            <FaqItem
              question="How accurate are the savings projections?"
              answer="Within ±8% of actual yield in our UAT cohort. Your real number depends on shading we can't see (overhanging trees, neighbor's new build), inverter losses, and how your usage shifts after install."
            />
            <FaqItem
              question="What if Google Solar API doesn't have my address?"
              answer="Coverage in Peninsular Malaysia is strong but not universal. If we can't pull your rooftop, we fall back to a manual-coordinates flow where you outline your roof yourself — same calculations downstream."
            />
            <FaqItem
              question="Does this work for East Malaysia?"
              answer="Solar potential calcs work anywhere with API coverage. Our tariff model is currently Peninsular Malaysia only (TNB RP4 + NEM Rakyat 3.0). Sabah Electricity and SESB tariffs are on the roadmap for late 2026."
            />
            <FaqItem
              question="Do you sell my address or usage data?"
              answer="No. Your project data stays in your account. We don't run installer affiliate programs or hand your details to third parties. If you want a quote, you ask for one — on your terms."
            />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Results are preliminary estimates and do not replace a professional on-site assessment. Financial projections
            use published RP4 + NEM Rakyat 3.0 rates as of 2025.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-stone-950 px-6 py-24 text-center text-white">
        {/* Decorative radial sun */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.4), transparent 60%)', filter: 'blur(40px)' }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(22,163,74,0.18), transparent 60%), radial-gradient(ellipse 60% 80% at 50% 100%, rgba(251,146,60,0.30), transparent 60%)'
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-orange-400">★ Ninety seconds</div>
          <h2 className="font-heading text-5xl font-bold leading-[1.05] sm:text-6xl">
            Your roof.
            <br />
            <span className="text-orange-400">A real number.</span>
            <br />
            Right now.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-stone-300">
            Free to start. No installer call. Walk away with a PDF in hand.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to={isSignedIn ? '/dashboard' : '/sign-up'}>
              <Button size="lg" className="gap-2 rounded-full px-8 text-base">
                {isSignedIn ? 'Open Dashboard' : 'Get Started Free'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer — dark multi-col */}
      <footer className="bg-stone-950 px-6 py-14 text-stone-400">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2.5">
                <Logo className="h-9 w-9" />
                <span className="font-heading text-lg font-bold tracking-tight text-stone-50">SolarSim</span>
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-relaxed">
                Data-driven rooftop solar assessment for Malaysian homeowners. Built so you walk into installer quotes
                already knowing the answer.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-emerald-400">
                <Leaf className="h-3.5 w-3.5" />
                Aligned with UN SDG 7
              </div>
            </div>

            <div>
              <div className="mb-3 font-mono text-xs uppercase tracking-wider text-orange-400">Product</div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#how" className="transition hover:text-white">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#features" className="transition hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="transition hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link to={isSignedIn ? '/dashboard' : '/sign-up'} className="transition hover:text-white">
                    {isSignedIn ? 'Open Dashboard' : 'Get Started'}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-3 font-mono text-xs uppercase tracking-wider text-orange-400">Company</div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#faq" className="transition hover:text-white">
                    FAQ
                  </a>
                </li>
                <li>
                  <span className="cursor-default opacity-60">Privacy</span>
                </li>
                <li>
                  <span className="cursor-default opacity-60">Terms</span>
                </li>
                <li>
                  <span className="cursor-default opacity-60">Contact</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 font-mono text-xs">
            <span>© 2026 SolarSim · Built as an FYP project.</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* SUB-COMPONENTS */

function useHeroTicker() {
  const [vals, setVals] = useState({ kwp: 6.2, savings: 3000, payback: 8.5 })

  useEffect(() => {
    const targets = { kwp: 8.4, savings: 5840, payback: 5.7 }
    const start = { kwp: 6.2, savings: 3000, payback: 8.5 }
    const dur = 1400
    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const ease = 1 - Math.pow(1 - p, 3)
      setVals({
        kwp: start.kwp + (targets.kwp - start.kwp) * ease,
        savings: Math.round(start.savings + (targets.savings - start.savings) * ease),
        payback: start.payback + (targets.payback - start.payback) * ease
      })
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return vals
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      {icon}
      {label}
    </span>
  )
}

function StepCard({
  step,
  icon,
  title,
  description
}: {
  step: number
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group relative flex flex-col items-center text-center">
      {/* Connector line (between cards) */}
      {step < 3 && (
        <div className="absolute left-[calc(50%+40px)] top-7 hidden h-px w-[calc(100%-80px)] bg-border sm:block">
          <ChevronRight className="absolute -right-2 -top-2 h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div className="relative mb-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
          {icon}
        </div>
        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {step}
        </span>
      </div>
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
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
      <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
        {icon}
      </div>
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
    <details
      open={defaultOpen}
      className={`group px-6 ${first ? '' : 'border-t border-border'}`}
    >
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
  if (highlighted) {
    return (
      <div
        className="relative flex flex-col rounded-2xl bg-gradient-to-b from-stone-900 to-[#2a1505] p-8 text-white shadow-[0_30px_60px_-20px_rgba(234,88,12,0.4)]"
      >
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-400 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-900">
          Most popular
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
