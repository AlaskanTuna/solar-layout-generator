import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Sun,
  MapPin,
  SlidersHorizontal,
  FileBarChart,
  Satellite,
  Move,
  Receipt,
  FileDown,
  AlertTriangle,
  Leaf
} from 'lucide-react'

export function LandingPage() {
  const { session, loading } = useAuth()

  if (loading) return null

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
          <Sun className="h-4 w-4 text-amber-500" />
          Powered by Google Solar API
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          See what solar can do for your rooftop
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Get a data-driven preliminary assessment of your rooftop solar potential using real satellite imagery and
          Malaysian NEM Rakyat 3.0 tariff rates — in minutes, not days.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
          {session ? (
            <Link to="/dashboard">
              <Button size="lg" className="w-full sm:w-auto">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/sign-up">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/sign-in">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      <Separator />

      {/* How It Works */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How It Works</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            Three simple steps from address search to savings report.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
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
              title="Analyse Your Savings"
              description="See your projected monthly savings, payback period and bill breakdown based on current Malaysian NEM tariff rates."
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Key Features */}
      <section className="bg-muted/50 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Key Features</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            Built specifically for the Malaysian solar market.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <FeatureCard
              icon={<Satellite className="h-5 w-5" />}
              title="Real Satellite Data"
              description="Uses Google Solar API imagery and solar flux data — no guesswork or manual measurements."
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

      <Separator />

      {/* Disclaimers */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-900">Important Disclaimers</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
                <li>Results are preliminary estimates only and do not replace a professional on-site assessment.</li>
                <li>Financial projections are based on published tariff rates and NEM Rakyat 3.0 rules as of 2025.</li>
                <li>Solar potential data depends on Google Solar API imagery quality, which varies by location.</li>
                <li>Currently designed for the Malaysian market (Peninsular Malaysia tariff structure).</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/50 px-4 py-16 text-center sm:py-20">
        <h2 className="text-2xl font-bold sm:text-3xl">Ready to explore your solar potential?</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Create a free account and get your rooftop analysis in minutes.
        </p>
        <div className="mt-8">
          <Link to="/sign-up">
            <Button size="lg">Get Started Free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Leaf className="h-4 w-4 text-green-600" />
            <span>Aligned with UN Sustainable Development Goal 7: Affordable and Clean Energy</span>
          </div>
        </div>
      </footer>
    </div>
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
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {icon}
        </div>
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
          {step}
        </span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
