// Tests for §5.2.1.6 Landing > LandingPage (TCNO prefix LP)
// Covers frontend/src/pages/LandingPage.tsx narrow behavioural surface only.
// Visual scroll-snap, blur-on-scroll, and animation behaviours are presentation-only
// and are folded into UAT instead.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const useAuthMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { returnObjects?: boolean }) => (opts?.returnObjects ? [] : k)
  })
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args)
}))

vi.mock('@/components/layout/ThemeToggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/layout/LanguageToggle', () => ({ LanguageToggle: () => null }))
vi.mock('@/components/layout/AppFooter', () => ({ AppFooter: () => null }))
vi.mock('@/components/ui/Logo', () => ({ Logo: () => null }))

import { LandingPage } from '../LandingPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )
}

describe('LandingPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  // LP-01
  it('renders the Get Started CTA routing to /sign-up when no session is present', () => {
    useAuthMock.mockReturnValue({ session: null })
    renderPage()

    const cta = screen.getByRole('link', { name: /nav\.getStarted/i })
    expect(cta.getAttribute('href')).toBe('/sign-up')
  })

  // LP-02
  it('renders the Go To Dashboard CTA routing to /dashboard when a session is present', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } } })
    renderPage()

    const cta = screen.getByRole('link', { name: /nav\.goToDashboard/i })
    expect(cta.getAttribute('href')).toBe('/dashboard')
  })

  // LP-03
  it('mounts the brand logo link routing back to /', () => {
    useAuthMock.mockReturnValue({ session: null })
    renderPage()

    const brandLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href') === '/')
    expect(brandLinks.length).toBeGreaterThan(0)
  })

  // LP-04
  it('renders the SolarSim brand wordmark in the navigation bar', () => {
    useAuthMock.mockReturnValue({ session: null })
    renderPage()

    const wordmarks = screen.getAllByText('SolarSim')
    expect(wordmarks.length).toBeGreaterThan(0)
  })
})
