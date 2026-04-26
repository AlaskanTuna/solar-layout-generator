import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, CircleHelp, Search } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeaderCard } from '@/components/layout/PageHeaderCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/DropdownMenu'

type FaqCategory = 'using-app' | 'solar-basics' | 'savings-payback' | 'nem-billing' | 'reports'

type FaqItem = {
  id: string
  category: FaqCategory
  question: string
  answer: string
}

const CATEGORY_LABELS: Record<FaqCategory | 'all', string> = {
  all: 'All',
  'using-app': 'Using the App',
  'solar-basics': 'Solar Basics',
  'savings-payback': 'Savings & Payback',
  'nem-billing': 'NEM & Billing',
  reports: 'Reports'
}

const LONG_ANSWER_WORD_LIMIT = 44
const ITEMS_PER_PAGE = 10

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'start-project',
    category: 'using-app',
    question: 'How do I start a solar assessment?',
    answer:
      'Create a new project from the dashboard, search for the home location, confirm the building on the map, then continue to the Workbench. The app uses rooftop data to generate an initial panel layout that you can adjust before running savings analysis.'
  },
  {
    id: 'monthly-kwh',
    category: 'using-app',
    question: 'Why does the app ask for monthly electricity consumption in kWh?',
    answer:
      'Solar savings depend on energy usage, not just the RM amount on the bill. Entering monthly kWh lets the app compare your normal TNB bill against the bill after solar generation and NEM credits are applied.'
  },
  {
    id: 'workbench-purpose',
    category: 'using-app',
    question: 'What is the Workbench for?',
    answer:
      'The Workbench is where you review and edit the proposed rooftop layout. You can keep, remove, move, or rotate panels so the final layout better matches the roof space before the app estimates generation and savings.'
  },
  {
    id: 'layout-edits',
    category: 'using-app',
    question: 'Why do moving or rotating panels affect the result?',
    answer:
      'Panel position and rotation affect how much sunlight the panel receives. When a panel is moved or rotated, the app can recompute monthly generation from the irradiance data so the analysis reflects the edited layout instead of the original suggestion.'
  },
  {
    id: 'save-export',
    category: 'using-app',
    question: 'Why should I save the analysis before exporting the PDF?',
    answer:
      'The PDF export reads the saved project data. Saving first ensures the report uses the latest consumption assumptions, selected panel model, system cost, layout edits, and analysis results.'
  },
  {
    id: 'change-assumptions',
    category: 'using-app',
    question: 'Can I change tariff or financial assumptions?',
    answer:
      'Yes. Advanced analysis controls let you adjust selected assumptions such as AFA, tariff parameters, degradation, and system inputs. These controls are useful when you want the estimate to match a specific bill, installer quote, or research scenario.'
  },
  {
    id: 'missing-energy',
    category: 'using-app',
    question: 'What does it mean if panels are missing monthly energy data?',
    answer:
      'It means the app does not yet have full month-by-month generation values for those edited panels. Save the layout again from the Workbench so the app can recompute energy for moved or rotated panels before final analysis.'
  },
  {
    id: 'compare-projects',
    category: 'using-app',
    question: 'Can I compare different layouts or assumptions?',
    answer:
      'You can create multiple projects or save alternative layouts as separate project versions. This is the safest way to compare panel counts, roof choices, monthly consumption assumptions, and financial outcomes without overwriting a previous scenario.'
  },
  {
    id: 'why-login',
    category: 'using-app',
    question: 'Why do I need an account?',
    answer:
      'An account lets the app save projects, layouts, analysis settings, and PDF-ready results. It also keeps project history available across sessions so you can return to a layout after adjusting assumptions or discussing it with an installer.'
  },
  {
    id: 'kwp',
    category: 'solar-basics',
    question: 'What does kWp mean?',
    answer:
      'kWp means kilowatt-peak. It is the rated maximum DC power of the solar array under standard test conditions. A 4.4 kWp system can theoretically produce 4.4 kW at peak conditions, but real output varies with weather, roof orientation, heat, losses, and time of day.'
  },
  {
    id: 'panel-count',
    category: 'solar-basics',
    question: 'Does more panels always mean a better solar system?',
    answer:
      'Not always. More panels increase generation, but they also increase installation cost. The best financial result usually comes from a layout that offsets your own electricity usage without creating too much surplus credit that gives little extra payback.'
  },
  {
    id: 'performance-ratio',
    category: 'solar-basics',
    question: 'What is performance ratio?',
    answer:
      'Performance ratio is a practical derating factor for real-world losses such as inverter conversion, wiring, heat, dirt, and mismatch between panels. A higher performance ratio means more of the theoretical solar energy becomes usable electricity.'
  },
  {
    id: 'degradation',
    category: 'solar-basics',
    question: 'Why does panel degradation matter?',
    answer:
      'Solar panels slowly lose output over time. A 0.5% annual degradation rate means the system produces slightly less each year, which lowers long-term savings and can stretch payback compared with assuming year-one output forever.'
  },
  {
    id: 'roof-azimuth-pitch',
    category: 'solar-basics',
    question: 'What are roof azimuth and pitch?',
    answer:
      'Azimuth is the compass direction the roof faces, while pitch is the roof slope. These affect sunlight exposure. In this app, roof azimuth and pitch are based on Solar API roof segment data, while edited panel rotation in the Workbench may differ.'
  },
  {
    id: 'dc-ac-ratio',
    category: 'solar-basics',
    question: 'What is DC/AC ratio?',
    answer:
      'DC/AC ratio compares the solar panel capacity to inverter capacity. A ratio above 1 means the panels are rated higher than the inverter, which is common because panels rarely produce peak output all day. Reasonable oversizing can improve daily energy yield without needing a larger inverter.'
  },
  {
    id: 'payback',
    category: 'savings-payback',
    question: 'What does simple payback mean?',
    answer:
      'Simple payback estimates how many years of electricity bill savings are needed to recover the upfront solar installation cost. For example, a RM 20,000 system saving RM 4,000 per year has a simple payback of about five years before maintenance or replacement costs.'
  },
  {
    id: 'net-benefit',
    category: 'savings-payback',
    question: 'What is net benefit?',
    answer:
      'Net benefit is cumulative solar savings minus the system cost. If a system costs RM 20,000 and produces RM 60,000 of cumulative bill savings over its lifetime, the net benefit is RM 40,000 before any extra lifecycle costs.'
  },
  {
    id: 'higher-usage',
    category: 'savings-payback',
    question: 'Why do higher-usage homes often get better payback?',
    answer:
      'Higher-usage homes have larger bills, so the same solar layout can offset more valuable grid electricity. Under tariff structures with thresholds, solar can also move billable usage below certain charge points, increasing RM savings beyond the panel energy alone.'
  },
  {
    id: 'right-sizing',
    category: 'savings-payback',
    question: 'What does right-sizing a solar layout mean?',
    answer:
      'Right-sizing means choosing enough panels to create meaningful savings without overbuilding the system. A layout that is too small saves too little, while a layout that is too large can cost more without producing enough additional usable bill savings.'
  },
  {
    id: 'star-rating',
    category: 'savings-payback',
    question: 'What does the star rating in Your Solar Verdict mean?',
    answer:
      'The star rating is mainly a payback signal. Faster payback receives a stronger rating because the installation cost is recovered sooner. A lower rating does not always mean the roof is bad; it may mean the layout is oversized, usage is low, or savings are modest compared with cost.'
  },
  {
    id: 'maintenance-costs',
    category: 'savings-payback',
    question: 'Do maintenance and inverter replacement affect ROI?',
    answer:
      'Yes. Cleaning, inspections, repairs, and eventual inverter replacement can reduce lifetime net benefit. The app separates simple payback from deeper lifecycle costs so users can understand the base economics before adding long-term maintenance assumptions.'
  },
  {
    id: 'nem',
    category: 'nem-billing',
    question: 'What is NEM?',
    answer:
      'NEM stands for Net Energy Metering. In this app, solar generation offsets household electricity use, and excess generation can become credits that reduce later bills. The app uses NEM Rakyat 3.0 as the project baseline.'
  },
  {
    id: 'self-consumption',
    category: 'nem-billing',
    question: 'Why does self-consumption matter?',
    answer:
      'Self-consumption means your solar generation is useful against your own electricity bill. A good layout is not just one that produces a lot of kWh; it is one where the generated energy offsets billable usage efficiently and avoids too much low-value surplus.'
  },
  {
    id: 'credits-forfeited',
    category: 'nem-billing',
    question: 'What are credit balance and credits forfeited?',
    answer:
      'Credit balance is unused solar credit carried forward to future months. Credits forfeited are unused credits that expire at year-end. Forfeited credits matter because they represent solar generation that did not become cash or future bill savings.'
  },
  {
    id: 'tariff-thresholds',
    category: 'nem-billing',
    question: 'Why do tariff thresholds affect savings?',
    answer:
      'Some bill components depend on monthly billable kWh. If solar reduces billable usage below a threshold, certain charges may reduce or disappear. This is why two homes with the same panels can see different RM savings.'
  },
  {
    id: 'nem-fit',
    category: 'nem-billing',
    question: 'What is NEM fit?',
    answer:
      'NEM fit describes whether the solar layout is well matched to the home usage. A good fit offsets the household bill efficiently. An oversized fit may create excess credits that do not become cash and may not improve payback enough to justify extra panels.'
  },
  {
    id: 'why-same-layout-different-savings',
    category: 'nem-billing',
    question: 'Why can the same layout save different amounts for different homes?',
    answer:
      'The same panels can have different financial value because each home has different monthly consumption, tariff thresholds, and credit usage. A high-usage home may use more of the solar generation against expensive billable kWh, while a low-usage home may create weaker surplus value.'
  },
  {
    id: 'estimate-vs-quote',
    category: 'reports',
    question: 'Why might the estimated system cost differ from an installer quote?',
    answer:
      'The app uses a bottom-up estimate for panels, inverter, mounting, electrical components, scaffolding, permits, labour, and installer margin. Real quotes can differ because of roof access, installer tier, equipment brand, warranty terms, site constraints, and market pricing.'
  },
  {
    id: 'pdf-meaning',
    category: 'reports',
    question: 'What should I use the PDF report for?',
    answer:
      'Use the PDF as a planning and comparison document. It summarizes the layout, estimated generation, bill savings, payback, net benefit, costs, and assumptions. It is not a final installer quotation or engineering certification.'
  },
  {
    id: 'estimate-accuracy',
    category: 'reports',
    question: 'How accurate are the savings estimates?',
    answer:
      'The estimates are useful for early decision-making, but actual savings can vary with weather, shading, roof condition, tariff changes, maintenance, inverter performance, billing cycle dates, and final installer design. Treat the report as a structured estimate rather than a guarantee.'
  },
  {
    id: 'installer-check',
    category: 'reports',
    question: 'What should an installer still verify?',
    answer:
      'An installer should verify roof structure, waterproofing, electrical protection, inverter placement, cable routing, meter requirements, authority paperwork, safety compliance, and final equipment availability. The app helps with early layout and financial reasoning, not final engineering approval.'
  }
]

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function FaqCard({ item }: { item: FaqItem }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = countWords(item.answer) > LONG_ANSWER_WORD_LIMIT

  return (
    <article className="glass-card relative overflow-hidden p-5 transition-all duration-200 hover:border-primary/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="max-w-3xl font-heading text-base font-semibold tracking-tight text-foreground">{item.question}</h2>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {CATEGORY_LABELS[item.category]}
        </span>
      </div>

      <div className="relative mt-3">
        <p
          className={`text-sm leading-6 text-muted-foreground transition-[max-height] duration-200 ${
            isLong && !expanded ? 'max-h-24 overflow-hidden' : 'max-h-80'
          }`}
        >
          {item.answer}
        </p>
        {isLong && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          className="mt-3 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </article>
  )
}

export function FAQPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FaqCategory | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category
      const matchesSearch =
        normalized.length === 0 ||
        item.question.toLowerCase().includes(normalized) ||
        item.answer.toLowerCase().includes(normalized) ||
        CATEGORY_LABELS[item.category].toLowerCase().includes(normalized)
      return matchesCategory && matchesSearch
    })
  }, [category, query])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredItems.slice(start, start + ITEMS_PER_PAGE)
  }, [currentPage, filteredItems])

  useEffect(() => {
    setCurrentPage(1)
  }, [category, query])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount))
  }, [pageCount])

  function handlePageChange(page: number) {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <PageContainer>
      <PageHeaderCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CircleHelp className="h-5 w-5" />
              </div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">FAQ</h1>
            </div>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Plain-language answers for homeowners, with enough technical context to support deeper solar decisions.
            </p>
          </div>
        </div>
      </PageHeaderCard>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What do you want to know?"
            className="h-11 pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 min-w-[180px] justify-between gap-3 px-3 font-normal">
              {CATEGORY_LABELS[category]}
              <ChevronDown className="h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuRadioGroup
              value={category}
              onValueChange={(value) => setCategory(value as FaqCategory | 'all')}
            >
              {(Object.keys(CATEGORY_LABELS) as Array<FaqCategory | 'all'>).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 grid gap-4 animate-fade-in">
        {filteredItems.length > 0 ? (
          paginatedItems.map((item) => <FaqCard key={item.id} item={item} />)
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="font-heading text-lg font-semibold">No matching answers</p>
            <p className="mt-2 text-sm text-muted-foreground">Try a different search term or switch the filter to All.</p>
          </div>
        )}
      </div>

      {filteredItems.length > ITEMS_PER_PAGE && (
        <div className="mt-6 flex justify-end">
          <nav className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm" aria-label="FAQ pagination">
            {Array.from({ length: pageCount }, (_, index) => {
              const page = index + 1
              const active = currentPage === page
              return (
                <button
                  key={page}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  className={`h-9 min-w-9 rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </PageContainer>
  )
}
