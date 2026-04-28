import { useCallback, useRef, useState } from 'react'

type UndoRedoOptions = {
  maxHistory?: number
}

/**
 * Defines the UndoRedoControls type
 */
export type UndoRedoControls<T> = {
  push: (snapshot: T) => void
  undo: () => T | undefined
  redo: () => T | undefined
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

/**
 * Provides the undoRedo hook
 * @param {UndoRedoOptions} options - Value used for options
 * @returns {UndoRedoControls<T>} Hook state for undo redo
 */
export function useUndoRedo<T>(options?: UndoRedoOptions): UndoRedoControls<T> {
  const maxHistory = options?.maxHistory ?? 30
  const historyRef = useRef<T[]>([])
  const indexRef = useRef(-1)
  const [, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])

  const push = useCallback(
    (snapshot: T) => {
      const history = historyRef.current
      const idx = indexRef.current

      // Truncate any redo entries beyond current index
      historyRef.current = history.slice(0, idx + 1)
      historyRef.current.push(snapshot)

      // Enforce max history
      if (historyRef.current.length > maxHistory) {
        historyRef.current = historyRef.current.slice(historyRef.current.length - maxHistory)
      }

      indexRef.current = historyRef.current.length - 1
      bump()
    },
    [maxHistory, bump]
  )

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return undefined
    indexRef.current -= 1
    bump()
    return historyRef.current[indexRef.current]
  }, [bump])

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return undefined
    indexRef.current += 1
    bump()
    return historyRef.current[indexRef.current]
  }, [bump])

  const clear = useCallback(() => {
    historyRef.current = []
    indexRef.current = -1
    bump()
  }, [bump])

  const canUndo = indexRef.current > 0
  const canRedo = indexRef.current < historyRef.current.length - 1

  return { push, undo, redo, canUndo, canRedo, clear }
}
