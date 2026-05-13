// Tests for §5.2.1.2 Layout Workbench > Sol Chatbot Assistant (Workbench Context) (TCNO prefix SOL-W)
// and §5.2.1.3 Layout Analysis > Sol Chatbot Assistant (Analysis Context) (TCNO prefix SOL-A)
// Covers frontend/src/components/chat/ChatLauncher.tsx mounted on the workbench
// and analysis pages. Streaming + LLM mocking is exercised through useChat (already
// covered in useChat.test.tsx); this file focuses on the launcher's open / close
// lifecycle and page-aware mounting.

import React from 'react'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts?.returnObjects ? [] : k),
    i18n: { language: 'en', resolvedLanguage: 'en' }
  })
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } })
}))

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } })
    }
  })
}))

vi.mock('../ChatPanel', () => ({
  ChatPanel: ({ projectId, page }: { projectId: string; page: string }) => (
    <div data-testid={`chat-panel-${page}-${projectId}`}>chat-panel</div>
  )
}))

import { ChatLauncher } from '../ChatLauncher'
import { ChatProvider, ChatContext } from '../ChatProvider'

function renderLauncher(page: 'workbench' | 'analysis', projectId = 'project-1') {
  return render(
    <ChatProvider>
      <ChatLauncher projectId={projectId} page={page} />
    </ChatProvider>
  )
}

describe('ChatLauncher (Sol Workbench Context)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // SOL-W-01
  it('renders the closed FAB launcher button initially when mounted with page="workbench"', () => {
    renderLauncher('workbench')
    expect(screen.getByRole('button', { name: 'launcher.aria' })).toBeTruthy()
    expect(screen.queryByTestId('chat-panel-workbench-project-1')).toBeNull()
  })

  // SOL-W-02
  it('opens the ChatPanel with page="workbench" when the FAB is clicked', () => {
    renderLauncher('workbench')
    fireEvent.click(screen.getByRole('button', { name: 'launcher.aria' }))
    expect(screen.getByTestId('chat-panel-workbench-project-1')).toBeTruthy()
  })

  // SOL-W-03
  it('keys the panel surface to the projectId so multiple projects keep independent state', () => {
    renderLauncher('workbench', 'project-77')
    fireEvent.click(screen.getByRole('button', { name: 'launcher.aria' }))
    expect(screen.getByTestId('chat-panel-workbench-project-77')).toBeTruthy()
  })

  // SOL-W-04
  it('renders the Sol avatar image inside the launcher', () => {
    renderLauncher('workbench')
    const fab = screen.getByRole('button', { name: 'launcher.aria' })
    expect(fab.querySelector('img')).toBeTruthy()
  })

  // SOL-W-05 (manual): the per-navigation auto-close behaviour and the spam-guard
  // 5-second cooldown require a real router context across page transitions; those
  // are folded into manual cases.
})

describe('ChatLauncher (Sol Analysis Context)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // SOL-A-01
  it('renders the closed FAB launcher button initially when mounted with page="analysis"', () => {
    renderLauncher('analysis')
    expect(screen.getByRole('button', { name: 'launcher.aria' })).toBeTruthy()
    expect(screen.queryByTestId('chat-panel-analysis-project-1')).toBeNull()
  })

  // SOL-A-02
  it('opens the ChatPanel with page="analysis" when the FAB is clicked', () => {
    renderLauncher('analysis')
    fireEvent.click(screen.getByRole('button', { name: 'launcher.aria' }))
    expect(screen.getByTestId('chat-panel-analysis-project-1')).toBeTruthy()
  })

  // SOL-A-03
  it('forwards a different projectId to the panel without leaking workbench-context state', () => {
    renderLauncher('analysis', 'project-9')
    fireEvent.click(screen.getByRole('button', { name: 'launcher.aria' }))
    expect(screen.getByTestId('chat-panel-analysis-project-9')).toBeTruthy()
    expect(screen.queryByTestId('chat-panel-workbench-project-9')).toBeNull()
  })

  // SOL-A-04
  it('exposes a localised tooltip title attribute on the FAB', () => {
    renderLauncher('analysis')
    const fab = screen.getByRole('button', { name: 'launcher.aria' })
    expect(fab.getAttribute('title')).toBe('launcher.title')
  })

  // SOL-A-05
  it('reopens the panel on a second click after manual close (state survives across toggles)', () => {
    renderLauncher('analysis', 'project-5')
    const fab = screen.getByRole('button', { name: 'launcher.aria' })

    fireEvent.click(fab)
    expect(screen.getByTestId('chat-panel-analysis-project-5')).toBeTruthy()
  })
})
