import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

/**
 * Renders the ThemeProvider component
 * @param {Object} props - Props for the component
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
    // Re-enable after one frame
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
 * Provides the theme hook
 * @returns {ThemeContextValue} Hook state for theme
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
