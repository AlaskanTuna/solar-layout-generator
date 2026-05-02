// TODO: replace with <img src="/chatbot/icon.svg" /> once asset is in place
import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot } from 'lucide-react'
import { ChatContext } from './ChatProvider'
import { ChatPanel } from './ChatPanel'

type ChatLauncherProps = {
  projectId: string
  page: 'workbench' | 'analysis'
}

/** Floating chat launcher that mirrors the guided-tour FAB styling and position. */
export function ChatLauncher({ projectId, page }: ChatLauncherProps) {
  const { t } = useTranslation('chat')
  const { getState, setState } = useContext(ChatContext)
  const { isOpen } = getState(projectId)

  if (isOpen) {
    return <ChatPanel projectId={projectId} page={page} />
  }

  return (
    <button
      type="button"
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
      <Bot className="h-5 w-5" />
    </button>
  )
}
