/**
 * Navigation theme switch for the app shell.
 * Lets users flip between resolved light and dark modes from compact header controls.
 */

import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'

/**
 * Renders an icon-only button that switches between resolved light and dark themes.
 * Uses localized accessible labels from the common namespace.
 */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const { t } = useTranslation('common')

  return (
    <Button variant="ghost" size="icon" onClick={toggle} className="h-9 w-9" aria-label={t('theme.toggleAria')}>
      {resolved === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  )
}
