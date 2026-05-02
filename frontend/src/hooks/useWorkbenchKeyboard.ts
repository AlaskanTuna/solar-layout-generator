import { useEffect } from 'react'

type UseWorkbenchKeyboardOptions = {
  undo: () => void
  redo: () => void
  selectedPanelIds: Set<string>
  onDeleteSelected: () => void
  onSpaceDown: () => void
  onSpaceUp: () => void
  onToggleMarquee?: () => void
  onToggleSnap?: () => void
  onToggleFreeRotate?: () => void
}

function isTypingInElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * Provides the workbenchKeyboard hook
 * @param {UseWorkbenchKeyboardOptions} options - Value used for options
 */
export function useWorkbenchKeyboard({
  undo,
  redo,
  selectedPanelIds,
  onDeleteSelected,
  onSpaceDown,
  onSpaceUp,
  onToggleMarquee,
  onToggleSnap,
  onToggleFreeRotate
}: UseWorkbenchKeyboardOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPanelIds.size > 0) {
          e.preventDefault()
          onDeleteSelected()
        }
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (!e.repeat) onSpaceDown()
        return
      }

      // Plain alphanumeric tool toggles. Skip if user is typing in a text field
      // or pressing a modifier combo that should pass through to the browser.
      if (isTypingInElement(e.target)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        onToggleMarquee?.()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        onToggleSnap?.()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        onToggleFreeRotate?.()
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        onSpaceUp()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { passive: false })
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    undo,
    redo,
    selectedPanelIds,
    onDeleteSelected,
    onSpaceDown,
    onSpaceUp,
    onToggleMarquee,
    onToggleSnap,
    onToggleFreeRotate
  ])
}
