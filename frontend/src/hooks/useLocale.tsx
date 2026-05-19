/**
 * Locale provider + hook backing the i18next-powered UI translations.
 *
 * Reads the initial locale from (in priority order): the `?locale=` query
 * param, localStorage, then the default. Persists every change to
 * localStorage so the next page load remembers it, and to the Supabase user
 * metadata when signed in so the choice survives across devices.
 *
 * Syncs the locale to i18next and to the `<html lang>` attribute so
 * screen-readers and CSS `:lang(...)` selectors work correctly.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import i18n, { DEFAULT_LOCALE, isSupportedLocale, LOCALE_STORAGE_KEY, type SupportedLocale } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/lib/supabase'

/** Value exposed by `useLocale`. */
type LocaleContextValue = {
  locale: SupportedLocale
  setLocale: (next: SupportedLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

/**
 * Picks the initial locale on first render. Order of precedence:
 *   1. `?locale=` URL query param (for shared links and QA)
 *   2. localStorage (persisted from a previous session)
 *   3. `DEFAULT_LOCALE`
 */
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
 * Provides the active UI locale and keeps it in sync with the Supabase user
 * metadata so the choice survives across devices.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<SupportedLocale>(() => readInitialLocale())
  // Tracks the last user id we synced from, so we only pull remote metadata
  // when the user actually changes (not on every render).
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
 * Hook that returns `{ locale, setLocale }`. Must be called inside
 * `LocaleProvider`; throws otherwise.
 */
export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
