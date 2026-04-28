import { useCallback, useRef, useState } from 'react'

type UndoRedoOptions = {
  maxHistory?: number
}

/** Imperative undo/redo controls returned by {@link useUndoRedo}. */
export type UndoRedoControls<T> = {
  push: (snapshot: T) => void
  undo: () => T | undefined
  redo: () => T | undefined
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

/**
 * Generic snapshot-based undo/redo stack.
 * Pushing a new snapshot truncates any forward (redo) history. Defaults to 30 entries; oldest are dropped first.
 *
 * @param options - Configuration (`maxHistory` defaults to 30)
 * @returns {@link UndoRedoControls} with `push`/`undo`/`redo`/`clear` and `canUndo`/`canRedo` flags
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
