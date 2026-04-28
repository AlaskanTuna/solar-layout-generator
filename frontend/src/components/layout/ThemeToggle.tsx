import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'

/**
 * Renders the ThemeToggle component
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
