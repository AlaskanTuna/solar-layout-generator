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
  Check,
  Leaf,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'

export function LandingPage() {
  const { session, loading } = useAuth()

  if (loading) return null
  const isSignedIn = !!session

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      {/* Navbar */}
      <nav className="glass-nav fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-heading text-lg font-semibold tracking-tight">SolarSim</span>
          </Link>
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
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 pt-24 text-center">
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[120px] animate-glow-pulse" />
          <div className="absolute -bottom-32 right-1/4 h-[400px] w-[400px] rounded-full bg-solar-400/10 blur-[100px] animate-glow-pulse [animation-delay:1.5s]" />
        </div>

        <div className="relative animate-fade-in-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            <Satellite className="h-3.5 w-3.5 text-primary" />
            Powered by Google Solar API
          </div>

          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            See what solar can do{' '}
            <span className="bg-gradient-to-r from-primary to-solar-400 bg-clip-text text-transparent">
              for your rooftop
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Get a data-driven preliminary assessment of your rooftop solar potential using real satellite imagery and
            Malaysian NEM Rakyat 3.0 tariff rates — in minutes, not days.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link to={isSignedIn ? '/dashboard' : '/sign-up'}>
              <Button size="lg" className="gap-2 px-8 text-base">
                {isSignedIn ? 'Go to Dashboard' : 'Get Started Free'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="text-base">
                See How It Works
              </Button>
            </a>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Free to use
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Results in minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Leaf className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              SDG 7 aligned
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative px-6 py-24">
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
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Features</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the Malaysian solar market
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Everything you need to make an informed decision about going solar.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            <FeatureCard
              icon={<Satellite className="h-5 w-5" />}
              title="Real Satellite Data"
              description="Uses Google Solar API imagery and solar flux data — no guesswork or manual measurements needed."
            />
            <FeatureCard
              icon={<Move className="h-5 w-5" />}
              title="Interactive Workbench"
              description="Drag, rotate and delete panels on your actual rooftop image. Energy output updates in real time."
            />
            <FeatureCard
              icon={<Receipt className="h-5 w-5" />}
              title="NEM Billing Simulation"
              description="Accurate bill projection using post-July 2025 RP4 tariff rates, EEI rebates, AFA, SST and RE Fund charges."
            />
            <FeatureCard
              icon={<FileDown className="h-5 w-5" />}
              title="PDF Export"
              description="Download a complete analysis report with system summary, monthly breakdown and financial projections."
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Testimonials</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by Malaysian homeowners
            </h2>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <TestimonialCard
              quote="The billing breakdown gave me confidence to move forward with my solar installation. I could see exactly how much I would save each month."
              name="Eric T."
              role="Homeowner, Subang Jaya"
              rating={4}
            />
            <TestimonialCard
              quote="As a retired electrical engineer, I appreciate the transparency of the tariff calculations. Every line item checks out."
              name="Poon C.Y."
              role="Retired Engineer, Petaling Jaya"
              rating={5}
            />
            <TestimonialCard
              quote="I use this for preliminary assessments with my clients. The what-if scenario feature saves me hours of manual calculations."
              name="Danny L."
              role="Solar Engineer, Kuala Lumpur"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Pricing</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Start exploring your solar potential for free. Upgrade when you need more.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <PricingCard
              tier="Free"
              price="RM 0"
              description="Perfect for homeowners exploring solar"
              features={['5 projects per day', 'Basic analysis', 'Simple PDF export', 'NEM billing simulation']}
              cta="Get Started"
              ctaLink="/sign-up"
            />
            <PricingCard
              tier="Pro"
              price="RM 29"
              period="/month"
              description="For serious solar planners"
              features={[
                '20 projects per day',
                'Advanced analysis',
                'Detailed PDF reports',
                'Seasonal consumption profiles',
                'Priority support'
              ]}
              cta="Coming Soon"
              highlighted
              disabled
            />
            <PricingCard
              tier="Enterprise"
              price="Custom"
              description="For solar installers and consultants"
              features={[
                'Unlimited projects',
                'Everything in Pro',
                'Team collaboration',
                'White-label reports',
                'API access',
                'Dedicated support'
              ]}
              cta="Contact Us"
              disabled
            />
          </div>
        </div>
      </section>

      {/* Disclaimers */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="glass-card flex items-start gap-4 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-solar-500" />
            <div>
              <h3 className="font-heading font-semibold">Important Disclaimers</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>Results are preliminary estimates only and do not replace a professional on-site assessment.</li>
                <li>Financial projections are based on published tariff rates and NEM Rakyat 3.0 rules as of 2025.</li>
                <li>Solar potential data depends on Google Solar API imagery quality, which varies by location.</li>
                <li>Currently designed for the Malaysian market (Peninsular Malaysia tariff structure).</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[100px]" />
        </div>
        <div className="relative">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to explore your solar potential?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create a free account and get your rooftop analysis in minutes.
          </p>
          <div className="mt-8">
            <Link to="/sign-up">
              <Button size="lg" className="gap-2 px-8 text-base">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <Link to="/" className="flex items-center gap-2.5">
                <Logo className="h-7 w-7" />
                <span className="font-heading text-base font-semibold tracking-tight">SolarSim</span>
              </Link>
              <p className="max-w-xs text-center text-sm text-muted-foreground sm:text-left">
                Data-driven rooftop solar assessment for Malaysian homeowners.
              </p>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="flex flex-col gap-2">
                <span className="font-medium text-foreground">Product</span>
                <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">
                  How It Works
                </a>
                <Link to="/sign-up" className="text-muted-foreground transition-colors hover:text-foreground">
                  Get Started
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium text-foreground">Legal</span>
                <span className="cursor-default text-muted-foreground">Privacy Policy</span>
                <span className="cursor-default text-muted-foreground">Terms of Service</span>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <span>2026 SolarSim. Built as an FYP project.</span>
            <span className="flex items-center gap-1.5">
              <Leaf className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              Aligned with UN SDG 7: Affordable and Clean Energy
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* SUB-COMPONENTS */

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

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-card group cursor-default p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
          {icon}
        </div>
        <div>
          <h3 className="font-heading font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

function TestimonialCard({ quote, name, role, rating }: { quote: string; name: string; role: string; rating: number }) {
  return (
    <div className="glass-card flex flex-col p-6">
      <div className="mb-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < rating ? 'fill-solar-400 text-solar-400' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">&ldquo;{quote}&rdquo;</p>
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
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
  const card = (
    <div
      className={`glass-card relative flex flex-col p-6 transition-all duration-300 ${
        highlighted ? 'ring-2 ring-primary' : ''
      } ${!disabled ? 'hover:shadow-lg hover:-translate-y-0.5' : ''}`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-white">
          Popular
        </span>
      )}
      <h3 className="font-heading text-lg font-semibold">{tier}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">
        <span className="font-heading text-3xl font-bold">{price}</span>
        {period && <span className="text-sm text-muted-foreground">{period}</span>}
      </div>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button variant={highlighted ? 'default' : 'outline'} className="w-full" disabled={disabled}>
          {cta}
        </Button>
      </div>
    </div>
  )

  if (ctaLink && !disabled) {
    return <Link to={ctaLink}>{card}</Link>
  }
  return card
}
