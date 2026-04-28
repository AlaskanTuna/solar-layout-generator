import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Leaf } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export function AppFooter() {
  const { t } = useTranslation('nav')

  const NAV_LINKS: { label: string; href: string }[] = [
    { label: t('items.howItWorks'), href: '/#how' },
    { label: t('items.features'), href: '/#features' },
    { label: t('items.pricing'), href: '/#pricing' },
    { label: t('items.faq'), href: '/#faq' }
  ]

  return (
    <footer className="border-t border-border bg-muted/30 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Leaf className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
            {t('footer.sdg')}
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <Logo className="h-6 w-6" />
              <span className="font-heading text-xs font-semibold tracking-tight">SolarSim</span>
            </Link>
            <span className="text-xs text-muted-foreground">&middot; {t('footer.year')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
