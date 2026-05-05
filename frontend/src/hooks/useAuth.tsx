import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { notify } from '@/components/ui/toastConfig'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Renders the AuthProvider component
 * @param {Object} props - Props for the component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Surface OAuth callback errors. Supabase implicit-flow failures (e.g. identity already
  // exists, access denied, server_error) come back in the URL hash; some flows put them in
  // the query string instead. Without this, the user lands silently on /dashboard or /sign-in
  // with no idea why their sign-in failed. Strip the params after toasting so a page refresh
  // doesn't re-fire.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : ''
    const params = new URLSearchParams(hash || search)
    const errorCode = params.get('error')
    const errorDescription = params.get('error_description')
    if (!errorCode && !errorDescription) return

    notify.error(errorDescription ?? errorCode ?? 'Authentication failed')

    const url = new URL(window.location.href)
    url.hash = ''
    url.searchParams.delete('error')
    url.searchParams.delete('error_code')
    url.searchParams.delete('error_description')
    window.history.replaceState({}, '', url.toString())
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      // Wipe the React Query cache when the user signs out (or the session expires)
      // so a subsequent sign-in cannot momentarily render the previous user's
      // cached projects/quota/analyses while the refetch is in flight.
      if (event === 'SIGNED_OUT' || !session) {
        queryClient.clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Provides the auth hook
 * @returns {AuthContextValue} Hook state for auth
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
