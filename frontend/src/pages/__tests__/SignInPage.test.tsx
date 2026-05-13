// Tests for §5.2.1.5 Authentication > SignInPage (TCNO prefix SI)
// Covers frontend/src/pages/SignInPage.tsx surface-level form behaviour only.
// Auth scaffolding (Supabase Auth client internals) excluded per Chapter 4 §4.6.

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const navigateMock = vi.fn()
const signInMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args)
}))

vi.mock('@/components/layout/ThemeToggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/layout/LanguageToggle', () => ({ LanguageToggle: () => null }))
vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: ({ label }: { label: string }) => <button type="button">{label}</button>
}))
vi.mock('@/components/ui/Logo', () => ({ Logo: () => null }))

import { SignInPage } from '../SignInPage'

const REMEMBER_KEY = 'slg-remember-email'

function setAuth({ session = null, loading = false }: { session?: unknown; loading?: boolean } = {}) {
  useAuthMock.mockReturnValue({
    session,
    loading,
    signIn: signInMock
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SignInPage />
    </MemoryRouter>
  )
}

describe('SignInPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    signInMock.mockReset()
    useAuthMock.mockReset()
    window.localStorage.clear()
  })

  // SI-01
  it('renders nothing while the auth state is loading', () => {
    setAuth({ loading: true })
    const { container } = renderPage()
    expect(container.firstChild).toBeNull()
  })

  // SI-02
  it('hydrates the email field from localStorage when a remembered email exists', () => {
    window.localStorage.setItem(REMEMBER_KEY, 'returning@example.com')
    setAuth()
    renderPage()

    const emailInput = screen.getByLabelText('signIn.emailLabel') as HTMLInputElement
    expect(emailInput.value).toBe('returning@example.com')
  })

  // SI-03
  it('submits the form with the entered credentials and routes to dashboard on success', async () => {
    setAuth()
    signInMock.mockResolvedValue({ error: null })

    renderPage()

    fireEvent.change(screen.getByLabelText('signIn.emailLabel'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('signIn.passwordLabel'), { target: { value: 'pw123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'signIn.submitButton' }))

    await waitFor(() => expect(signInMock).toHaveBeenCalledWith('a@b.com', 'pw123456'))
    expect(navigateMock).toHaveBeenCalledWith('/dashboard')
  })

  // SI-04
  it('persists the email to localStorage when "Remember email" stays checked', async () => {
    setAuth()
    signInMock.mockResolvedValue({ error: null })

    renderPage()

    fireEvent.change(screen.getByLabelText('signIn.emailLabel'), { target: { value: 'remember@me.com' } })
    fireEvent.change(screen.getByLabelText('signIn.passwordLabel'), { target: { value: 'pw' } })

    // The form already has rememberMe true when remembered email exists; otherwise toggle it on.
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    if (!checkbox.checked) fireEvent.click(checkbox)

    fireEvent.click(screen.getByRole('button', { name: 'signIn.submitButton' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalled())
    expect(window.localStorage.getItem(REMEMBER_KEY)).toBe('remember@me.com')
  })

  // SI-05
  it('renders the Supabase error string in a destructive banner on auth failure', async () => {
    setAuth()
    signInMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    renderPage()

    fireEvent.change(screen.getByLabelText('signIn.emailLabel'), { target: { value: 'wrong@example.com' } })
    fireEvent.change(screen.getByLabelText('signIn.passwordLabel'), { target: { value: 'badpw' } })
    fireEvent.click(screen.getByRole('button', { name: 'signIn.submitButton' }))

    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeTruthy())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
