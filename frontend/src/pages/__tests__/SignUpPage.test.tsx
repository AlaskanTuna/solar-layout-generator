// Tests for §5.2.1.5 Authentication > SignUpPage (TCNO prefix SU)
// Covers frontend/src/pages/SignUpPage.tsx surface-level form behaviour only.

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const signUpMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>
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

import { SignUpPage } from '../SignUpPage'

function setAuth({ session = null, loading = false }: { session?: unknown; loading?: boolean } = {}) {
  useAuthMock.mockReturnValue({ session, loading, signUp: signUpMock })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SignUpPage />
    </MemoryRouter>
  )
}

describe('SignUpPage', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    useAuthMock.mockReset()
  })

  // SU-01
  it('renders nothing while the auth state is loading', () => {
    setAuth({ loading: true })
    const { container } = renderPage()
    expect(container.firstChild).toBeNull()
  })

  // SU-02
  it('shows the empty form when no session is present', () => {
    setAuth()
    renderPage()
    expect(screen.getByLabelText('signUp.emailLabel')).toBeTruthy()
    expect(screen.getByLabelText('signUp.passwordLabel')).toBeTruthy()
  })

  // SU-03
  it('calls signUp with the entered credentials and shows the verification block on success', async () => {
    setAuth()
    signUpMock.mockResolvedValue({ error: null })

    renderPage()

    fireEvent.change(screen.getByLabelText('signUp.emailLabel'), { target: { value: 'new@user.com' } })
    fireEvent.change(screen.getByLabelText('signUp.passwordLabel'), { target: { value: 'pw12345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'signUp.submitButton' }))

    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith('new@user.com', 'pw12345678'))
    await waitFor(() => expect(screen.getByText('signUp.success.backToSignIn')).toBeTruthy())
  })

  // SU-04
  it('renders the Supabase error string when signUp returns an error', async () => {
    setAuth()
    signUpMock.mockResolvedValue({ error: { message: 'User already registered' } })

    renderPage()

    fireEvent.change(screen.getByLabelText('signUp.emailLabel'), { target: { value: 'taken@user.com' } })
    fireEvent.change(screen.getByLabelText('signUp.passwordLabel'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'signUp.submitButton' }))

    await waitFor(() => expect(screen.getByText('User already registered')).toBeTruthy())
    expect(screen.queryByText('signUp.success.backToSignIn')).toBeNull()
  })

  // SU-05
  it('disables the submit button while the request is in flight', async () => {
    setAuth()
    let resolveFn: (value: { error: null }) => void = () => undefined
    signUpMock.mockReturnValue(new Promise((r) => { resolveFn = r }))

    renderPage()

    fireEvent.change(screen.getByLabelText('signUp.emailLabel'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('signUp.passwordLabel'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'signUp.submitButton' }))

    // Submit button label flips to 'submitting' state
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'signUp.submitting' })).toHaveProperty('disabled', true)
    )

    resolveFn({ error: null })
  })
})
