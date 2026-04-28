import { useEffect } from 'react'

type UseWorkbenchKeyboardOptions = {
  undo: () => void
  redo: () => void
  selectedPanelIds: Set<string>
  onDeleteSelected: () => void
  onSpaceDown: () => void
  onSpaceUp: () => void
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
  onSpaceUp
}: UseWorkbenchKeyboardOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPanelIds.size > 0) {
          e.preventDefault()
          onDeleteSelected()
        }
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (!e.repeat) onSpaceDown()
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
  }, [undo, redo, selectedPanelIds, onDeleteSelected, onSpaceDown, onSpaceUp])
}
