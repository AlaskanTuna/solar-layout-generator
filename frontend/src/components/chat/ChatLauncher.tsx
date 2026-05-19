/**
 * Floating AI chat entry point for project workbench and analysis pages.
 * Mounts the chat panel with live solar-layout state so answers can reference unsaved edits.
 */

import { useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatContext } from './ChatProvider'
import { ChatPanel } from './ChatPanel'
import type { ChatLiveState } from '@/hooks/useChat'

type ChatLauncherProps = {
  projectId: string
  page: 'workbench' | 'analysis'
  /** Optional callback returning the page's unsaved live state for chat grounding. */
  liveStateProvider?: () => ChatLiveState | undefined
}

/**
 * Renders the floating chat button and project-scoped chat panel.
 * Expects the current project id, page context, and optional live-state provider for grounding.
 */
export function ChatLauncher({ projectId, page, liveStateProvider }: ChatLauncherProps) {
  const { t } = useTranslation('chat')
  const { getState, setState } = useContext(ChatContext)
  const { isOpen } = getState(projectId)

  // Close the panel on mount of a fresh launcher instance, which fires every
  // time the user navigates between WorkbenchPage and AnalysisPage. The
  // conversation history is keyed by projectId in ChatProvider and stays
  // intact, so reopening the panel on the new page picks up where it left off.
  useEffect(() => {
    setState(projectId, (prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, [])

  if (isOpen) {
    return <ChatPanel projectId={projectId} page={page} liveStateProvider={liveStateProvider} />
  }

  return (
    <button
      type="button"
      data-tour="chat-launcher"
      onClick={() =>
        setState(projectId, (prev) => ({
          ...prev,
          isOpen: true
        }))
      }
      aria-label={t('launcher.aria')}
      title={t('launcher.title')}
      className="fixed bottom-[68px] right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/40 text-foreground shadow-[0_8px_24px_rgba(234,88,12,0.18)] backdrop-blur-xl transition-colors duration-300 hover:bg-white/60 dark:border-white/10 dark:bg-stone-900/55 dark:hover:bg-stone-900/75"
    >
      <img src="/chatbot/sol.webp" alt="" className="h-7 w-7 object-contain" draggable={false} />
    </button>
  )
}
