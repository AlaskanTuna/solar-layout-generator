import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import i18n, {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_STORAGE_KEY,
  type SupportedLocale
} from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/lib/supabase'

type LocaleContextValue = {
  locale: SupportedLocale
  setLocale: (next: SupportedLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

function readInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get('locale')
  if (isSupportedLocale(fromQuery)) return fromQuery
  const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isSupportedLocale(fromStorage)) return fromStorage
  return DEFAULT_LOCALE
}

/**
 * Provides the active UI locale
 * @param {Object} props - Props for the component
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<SupportedLocale>(() => readInitialLocale())
  const lastSyncedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', locale)
    }
  }, [locale])

  useEffect(() => {
    if (!user) {
      lastSyncedUserId.current = null
      return
    }
    if (lastSyncedUserId.current === user.id) return
    lastSyncedUserId.current = user.id
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const remote = meta.locale as string | null | undefined
    if (isSupportedLocale(remote) && remote !== locale) {
      setLocaleState(remote)
      window.localStorage.setItem(LOCALE_STORAGE_KEY, remote)
    }
  }, [user, locale])

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      setLocaleState(next)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
      }
      if (user) {
        getSupabase()
          .auth.updateUser({ data: { locale: next } })
          .catch(() => {
            /* non-fatal */
          })
      }
    },
    [user]
  )

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}

/**
 * Provides the locale hook
 * @returns {LocaleContextValue} Hook state for locale
 */
export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
