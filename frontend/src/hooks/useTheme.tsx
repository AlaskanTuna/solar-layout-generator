/**
 * Theme provider + hook for light / dark / system mode.
 *
 * Persists the user's choice in localStorage and syncs the `dark` class on
 * `<html>`. When the user picks `system`, listens to the OS `prefers-color-scheme`
 * media query and switches with the OS.
 *
 * One non-obvious detail: theme switching disables CSS transitions for one
 * frame to avoid a laggy colour cascade — without this, every component
 * fades through the in-between colour values which looks terrible on
 * complex pages like the analysis dashboard.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

/**
 * Value exposed by `useTheme`. `theme` is the user's choice (may be `system`);
 * `resolved` is the concrete `'light' | 'dark'` actually applied.
 */
type ThemeContextValue = {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/** Reads the OS-level colour scheme preference. */
function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Resolves a `Theme` to a concrete light/dark by consulting the OS for `system`. */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

/**
 * Wraps the React tree with theme context. Mount once near the root.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    return stored ?? 'system'
  })

  const resolved = resolveTheme(theme)

  const applyTheme = useCallback((t: 'light' | 'dark') => {
    const root = document.documentElement
    // Disable all transitions during theme switch to prevent laggy cascade
    root.style.setProperty('--theme-transition', 'none')
    root.classList.toggle('dark', t === 'dark')
    // Double rAF: schedule re-enable after the layout has flushed the class
    // change. A single rAF re-enables transitions mid-paint and the cascade
    // still leaks through.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.style.removeProperty('--theme-transition')
      })
    })
  }, [])

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t)
      localStorage.setItem('theme', t)
      applyTheme(resolveTheme(t))
    },
    [applyTheme]
  )

  const toggle = useCallback(() => {
    setTheme(resolved === 'light' ? 'dark' : 'light')
  }, [resolved, setTheme])

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved, applyTheme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(getSystemTheme())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme, applyTheme])

  return <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</ThemeContext.Provider>
}

/**
 * Hook that returns the current theme context. Must be called inside
 * `ThemeProvider`; throws otherwise.
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
