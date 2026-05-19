/**
 * Renders the searchable solar and app FAQ page.
 * It is reached from /dashboard/faq and gives users self-serve support while using the authenticated dashboard.
 * This page serves the learning and troubleshooting step for terminology, NEM billing, reports, and app usage.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

const LONG_ANSWER_WORD_LIMIT = 44
const ITEMS_PER_PAGE = 10

const FAQ_IDS: { id: string; category: FaqCategory }[] = [
  { id: 'start-project', category: 'using-app' },
  { id: 'monthly-kwh', category: 'using-app' },
  { id: 'workbench-purpose', category: 'using-app' },
  { id: 'layout-edits', category: 'using-app' },
  { id: 'save-export', category: 'using-app' },
  { id: 'change-assumptions', category: 'using-app' },
  { id: 'missing-energy', category: 'using-app' },
  { id: 'compare-projects', category: 'using-app' },
  { id: 'why-login', category: 'using-app' },
  { id: 'kwp', category: 'solar-basics' },
  { id: 'panel-count', category: 'solar-basics' },
  { id: 'performance-ratio', category: 'solar-basics' },
  { id: 'degradation', category: 'solar-basics' },
  { id: 'roof-azimuth-pitch', category: 'solar-basics' },
  { id: 'dc-ac-ratio', category: 'solar-basics' },
  { id: 'payback', category: 'savings-payback' },
  { id: 'net-benefit', category: 'savings-payback' },
  { id: 'higher-usage', category: 'savings-payback' },
  { id: 'right-sizing', category: 'savings-payback' },
  { id: 'star-rating', category: 'savings-payback' },
  { id: 'maintenance-costs', category: 'savings-payback' },
  { id: 'nem', category: 'nem-billing' },
  { id: 'self-consumption', category: 'nem-billing' },
  { id: 'credits-forfeited', category: 'nem-billing' },
  { id: 'tariff-thresholds', category: 'nem-billing' },
  { id: 'nem-fit', category: 'nem-billing' },
  { id: 'why-same-layout-different-savings', category: 'nem-billing' },
  { id: 'estimate-vs-quote', category: 'reports' },
  { id: 'pdf-meaning', category: 'reports' },
  { id: 'estimate-accuracy', category: 'reports' },
  { id: 'installer-check', category: 'reports' }
]

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function FaqCard({ item }: { item: FaqItem }) {
  const { t } = useTranslation('faq')
  const [expanded, setExpanded] = useState(false)
  const isLong = countWords(item.answer) > LONG_ANSWER_WORD_LIMIT

  return (
    <article className="glass-card relative overflow-hidden p-5 transition-all duration-200 hover:border-primary/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="max-w-3xl font-heading text-base font-semibold tracking-tight text-foreground">
          {item.question}
        </h2>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {t(`categories.${item.category}`)}
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
          {expanded ? t('card.showLess') : t('card.showMore')}
        </button>
      )}
    </article>
  )
}

/** Renders the searchable, categorized FAQ list with pagination. */
export function FAQPage() {
  const { t } = useTranslation('faq')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FaqCategory | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const FAQ_ITEMS: FaqItem[] = useMemo(
    () =>
      FAQ_IDS.map(({ id, category: cat }) => ({
        id,
        category: cat,
        question: t(`items.${id}.question`),
        answer: t(`items.${id}.answer`)
      })),
    [t]
  )

  const CATEGORY_LABELS: Record<FaqCategory | 'all', string> = {
    all: t('categories.all'),
    'using-app': t('categories.using-app'),
    'solar-basics': t('categories.solar-basics'),
    'savings-payback': t('categories.savings-payback'),
    'nem-billing': t('categories.nem-billing'),
    reports: t('categories.reports')
  }

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
  }, [category, query, FAQ_ITEMS, CATEGORY_LABELS])

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
      {/* Header */}
      <PageHeaderCard artSrc="/dashboard/faq.webp">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CircleHelp className="h-5 w-5" />
              </div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{t('header.title')}</h1>
            </div>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t('header.subtitle')}</p>
          </div>
        </div>
      </PageHeaderCard>

      {/* Search and filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
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

      {/* Question results */}
      <div className="mt-6 grid gap-4 animate-fade-in">
        {filteredItems.length > 0 ? (
          paginatedItems.map((item) => <FaqCard key={item.id} item={item} />)
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="font-heading text-lg font-semibold">{t('empty.title')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('empty.subtitle')}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredItems.length > ITEMS_PER_PAGE && (
        <div className="mt-6 flex justify-end">
          <nav
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm"
            aria-label={t('pagination.ariaLabel')}
          >
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
