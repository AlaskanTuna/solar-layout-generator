/**
 * Locale switcher for the SolarSim interface.
 * Used in the app nav to swap supported languages for Malaysian homeowner workflows.
 */

import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useLocale } from '@/hooks/useLocale'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n'

/**
 * Renders a dropdown of supported locales and updates the global locale context.
 * Highlights the active language while keeping the trigger compact for nav placement.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale()
  const { t } = useTranslation('common')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('language.toggleAria')}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLocale(code as SupportedLocale)}
            className={locale === code ? 'font-semibold text-foreground' : 'text-muted-foreground'}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span>{LOCALE_LABELS[code]}</span>
              {locale === code && <span className="text-primary">●</span>}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
