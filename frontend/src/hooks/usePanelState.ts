/**
 * Workbench panel state hook.
 *
 * Owns the canonical panel collection for a project: starts from Google's
 * default Solar API layout, applies the user's persisted edits, and exposes
 * mutators (`movePanel`, `rotatePanel`, `deletePanel`, etc.) plus derived
 * views (visible subset, ordering, totals).
 *
 * Three non-obvious behaviours documented inline below:
 *   - **Slider resurrection**: increasing the visible-count slider above the
 *     non-deleted pool size revives deleted panels in stable-order rather
 *     than silently capping the slider.
 *   - **Stable ordering**: panels are sorted once on init by roof-direction
 *     match then by yield, and `stableOrderRef` preserves that ordering
 *     across deletions so the slider behaves predictably.
 *   - **First-load batch recompute**: on project init we batch-recompute
 *     monthly energy for any panel that lacks 12-month samples (e.g. older
 *     saved layouts before per-panel flux was added).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PanelEdit, RoofDirection } from '@shared/types'
import { recomputeFluxBatch } from '@/api/locations'
import {
  annualEnergyFromMonthly,
  getInitialPanelRotation,
  normalizeRotation,
  parsePanelEdits,
  type RoofSegment,
  type SolarPanel
} from '@/lib/buildingInsights'
import { segmentMatchesRoofDirection } from '@/lib/workbench/roofDirection'
import { useUndoRedo } from './useUndoRedo'

type UndoRedoSnapshot = {
  panels: WorkbenchPanelState[]
  visibleCount: number
}

/** Normalized panel state used by the workbench. */
export type WorkbenchPanelState = {
  id: string
  originalCenter: { lat: number; lng: number }
  center: { lat: number; lng: number }
  originalRotation: number
  rotation: number
  yearlyEnergyDcKwh: number
  monthlyEnergyDcKwh: number[]
  deleted: boolean
}

/** Batch recompute lifecycle status. */
export type BatchRecomputeStatus = 'idle' | 'loading' | 'done' | 'error'

type UsePanelStateArgs = {
  projectId: string | undefined
  locationId: string | undefined
  solarPanels: SolarPanel[]
  roofSegments: RoofSegment[]
  editedLayout: unknown
  maxArrayPanelsCount: number
  carbonOffsetFactorKgPerMwh: number
  panelWidthM?: number
  panelHeightM?: number
  panelCapacityWp?: number
  roofDirection?: RoofDirection
  onBatchRecomputeStatusChange?: (status: BatchRecomputeStatus) => void
}

/**
 * Tunable constants for workbench panel behaviour.
 *
 * - `positionEpsilon` — lat/lng delta below which a panel is considered "not
 *   moved" when serialising (~ 1 mm at Klang Valley latitudes).
 * - `rotationEpsilon` — radian delta below which rotation is considered "not
 *   moved" when serialising (~ 0.06°).
 * - `undoHistoryDepth` — undo stack cap; older snapshots are discarded.
 * - `defaultVisiblePanelFloor` — minimum panels shown on a fresh project so
 *   the workbench never opens completely empty.
 */
const WORKBENCH_CONFIG = {
  positionEpsilon: 1e-8,
  rotationEpsilon: 1e-3,
  undoHistoryDepth: 30,
  defaultVisiblePanelFloor: 4
} as const

/** Return monthly-derived annual energy when monthly samples exist; otherwise the API yearly value. */
export function getPanelAnnualEnergy(panel: Pick<WorkbenchPanelState, 'monthlyEnergyDcKwh' | 'yearlyEnergyDcKwh'>) {
  return panel.monthlyEnergyDcKwh.length > 0
    ? annualEnergyFromMonthly(panel.monthlyEnergyDcKwh)
    : panel.yearlyEnergyDcKwh
}

function getSortedPanelIds(
  panels: WorkbenchPanelState[],
  solarPanels: SolarPanel[],
  roofSegments: RoofSegment[],
  roofDirection: RoofDirection | undefined
) {
  const segmentIndexByPanelId = new Map(solarPanels.map((panel) => [panel.id, panel.segmentIndex]))

  return [...panels]
    .sort((a, b) => {
      const aSegmentIndex = segmentIndexByPanelId.get(a.id)
      const bSegmentIndex = segmentIndexByPanelId.get(b.id)
      const aMatch =
        typeof aSegmentIndex === 'number' && segmentMatchesRoofDirection(aSegmentIndex, roofSegments, roofDirection)
      const bMatch =
        typeof bSegmentIndex === 'number' && segmentMatchesRoofDirection(bSegmentIndex, roofSegments, roofDirection)
      if (aMatch !== bMatch) return aMatch ? -1 : 1
      return getPanelAnnualEnergy(b) - getPanelAnnualEnergy(a)
    })
    .map((panel) => panel.id)
}

/** Manages workbench panel state: ordering, edits, undo/redo, batch flux recompute, slider count, serialisation. */
export function usePanelState({
  projectId,
  locationId,
  solarPanels,
  roofSegments,
  editedLayout,
  maxArrayPanelsCount,
  carbonOffsetFactorKgPerMwh,
  panelWidthM,
  panelHeightM,
  panelCapacityWp,
  roofDirection,
  onBatchRecomputeStatusChange
}: UsePanelStateArgs) {
  const [panels, setPanels] = useState<WorkbenchPanelState[]>([])
  const [visibleCount, setVisibleCountState] = useState(0)
  const initializedProjectIdRef = useRef<string | null>(null)
  const batchRecomputedProjectIdRef = useRef<string | null>(null)
  const stableOrderRef = useRef<string[]>([])

  const panelsRef = useRef<WorkbenchPanelState[]>(panels)
  const visibleCountRef = useRef(visibleCount)
  useEffect(() => {
    panelsRef.current = panels
  }, [panels])
  useEffect(() => {
    visibleCountRef.current = visibleCount
  }, [visibleCount])

  const undoRedo = useUndoRedo<UndoRedoSnapshot>({ maxHistory: WORKBENCH_CONFIG.undoHistoryDepth })

  const pushSnapshot = useCallback(() => {
    undoRedo.push({ panels: panelsRef.current, visibleCount: visibleCountRef.current })
  }, [undoRedo])

  const parsedEdits = useMemo(() => parsePanelEdits(editedLayout), [editedLayout])

  const minVisibleCount =
    solarPanels.length === 0 ? 0 : Math.min(WORKBENCH_CONFIG.defaultVisiblePanelFloor, solarPanels.length)
  const maxVisibleCount = Math.min(maxArrayPanelsCount, solarPanels.length)

  useEffect(() => {
    if (!projectId || solarPanels.length === 0) {
      setPanels((prev) => (prev.length === 0 ? prev : []))
      setVisibleCountState((prev) => (prev === 0 ? prev : 0))
      initializedProjectIdRef.current = null
      batchRecomputedProjectIdRef.current = null
      return
    }

    if (initializedProjectIdRef.current === projectId) return
    initializedProjectIdRef.current = projectId

    const editById = new Map(parsedEdits.map((edit) => [edit.id, edit]))

    const nextPanels = solarPanels.map((panel) => {
      const edit = editById.get(panel.id)
      const originalRotation = getInitialPanelRotation(panel, roofSegments)

      return {
        id: panel.id,
        originalCenter: panel.center,
        center: edit?.center ?? panel.center,
        originalRotation,
        rotation: normalizeRotation(edit?.rotation ?? originalRotation),
        yearlyEnergyDcKwh: panel.yearlyEnergyDcKwh,
        monthlyEnergyDcKwh: edit?.monthlyEnergyDcKwh ?? [],
        deleted: edit?.status === 'deleted'
      } satisfies WorkbenchPanelState
    })

    setPanels(nextPanels)

    stableOrderRef.current = getSortedPanelIds(nextPanels, solarPanels, roofSegments, roofDirection)

    const savedActiveCount =
      parsedEdits.length > 0 ? nextPanels.filter((panel) => !panel.deleted).length : maxVisibleCount
    const nextVisibleCount = Math.max(minVisibleCount, Math.min(maxVisibleCount, savedActiveCount || maxVisibleCount))
    setVisibleCountState(nextVisibleCount)

    undoRedo.push({ panels: nextPanels, visibleCount: nextVisibleCount })
  }, [projectId, solarPanels, roofSegments, parsedEdits, minVisibleCount, maxVisibleCount, undoRedo, roofDirection])

  const lastSortedDirectionRef = useRef<RoofDirection | undefined>(undefined)
  useEffect(() => {
    if (!projectId || initializedProjectIdRef.current !== projectId) return
    if (lastSortedDirectionRef.current === roofDirection) return
    lastSortedDirectionRef.current = roofDirection
    if (panelsRef.current.length === 0) return
    stableOrderRef.current = getSortedPanelIds(panelsRef.current, solarPanels, roofSegments, roofDirection)
    setPanels((prev) => [...prev])
  }, [projectId, roofDirection, solarPanels, roofSegments])

  useEffect(() => {
    if (!projectId || !locationId || panels.length === 0) return
    if (initializedProjectIdRef.current !== projectId) return
    if (batchRecomputedProjectIdRef.current === projectId) return

    const panelsNeedingMonthly = panels.filter((p) => !p.deleted && p.monthlyEnergyDcKwh.length === 0)
    if (panelsNeedingMonthly.length === 0) {
      batchRecomputedProjectIdRef.current = projectId
      return
    }

    batchRecomputedProjectIdRef.current = projectId
    const controller = new AbortController()

    async function runBatchRecompute() {
      onBatchRecomputeStatusChange?.('loading')
      try {
        const response = await recomputeFluxBatch(locationId!, {
          panels: panelsNeedingMonthly.map((p) => ({
            panelId: p.id,
            center: p.center,
            rotation: p.rotation,
            ...(panelWidthM != null && { widthM: panelWidthM }),
            ...(panelHeightM != null && { heightM: panelHeightM }),
            ...(panelCapacityWp != null && { capacityWp: panelCapacityWp })
          }))
        })
        if (!controller.signal.aborted) {
          const energyMap = new Map(response.results.map((r) => [r.panelId, r.monthlyEnergyDcKwh]))
          setPanels((current) =>
            current.map((panel) => {
              const monthly = energyMap.get(panel.id)
              return monthly && monthly.length === 12 ? { ...panel, monthlyEnergyDcKwh: monthly } : panel
            })
          )
          onBatchRecomputeStatusChange?.('done')
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          if (import.meta.env.DEV) {
            console.warn('[usePanelState] Initial batch recompute failed:', err)
          }
          onBatchRecomputeStatusChange?.('error')
        }
      }
    }

    void runBatchRecompute()

    return () => {
      controller.abort()
    }
  }, [projectId, locationId, panels, onBatchRecomputeStatusChange])

  const orderedPanels = useMemo(
    () => [...panels].sort((a, b) => getPanelAnnualEnergy(b) - getPanelAnnualEnergy(a)),
    [panels]
  )

  const panelMap = useMemo(() => new Map(panels.map((panel) => [panel.id, panel])), [panels])

  // Slider max stays anchored to the Solar API ceiling regardless of how many
  // panels the user has deleted. Per UX intent, deleting reduces the visible
  // count (and therefore the slider position) but never the slider's upper bound.
  const activePanelIds = useMemo(() => {
    const ids = stableOrderRef.current
      .filter((id) => {
        const panel = panelMap.get(id)
        return panel && !panel.deleted
      })
      .slice(0, visibleCount)
    return new Set(ids)
  }, [panelMap, visibleCount])

  const visiblePanels = useMemo(() => panels.filter((panel) => activePanelIds.has(panel.id)), [panels, activePanelIds])

  const totalAnnualYield = useMemo(
    () => visiblePanels.reduce((sum, panel) => sum + getPanelAnnualEnergy(panel), 0),
    [visiblePanels]
  )

  const totalCarbonOffsetKg = useMemo(
    () => (totalAnnualYield / 1000) * carbonOffsetFactorKgPerMwh,
    [totalAnnualYield, carbonOffsetFactorKgPerMwh]
  )

  // All mutators below follow the "snapshot AFTER mutation" convention: compute the next state
  // from the latest ref, call setPanels with that explicit value, then push that exact value
  // into the undo history. The previous push-before-mutation pattern left the latest state out
  // of history entirely, which broke redo.
  //
  // We synchronously update `panelsRef` / `visibleCountRef` to the new value before each
  // setPanels / setVisibleCountState call so consecutive mutators in the same event handler
  // compose correctly — React batches the state updates but our refs already reflect the
  // accumulated change.

  function commitPanels(next: WorkbenchPanelState[]) {
    panelsRef.current = next
    setPanels(next)
  }

  function commitVisibleCount(next: number) {
    visibleCountRef.current = next
    setVisibleCountState(next)
  }

  function movePanel(panelId: string, center: { lat: number; lng: number }) {
    const next = panelsRef.current.map((panel) => (panel.id === panelId ? { ...panel, center } : panel))
    commitPanels(next)
    undoRedo.push({ panels: next, visibleCount: visibleCountRef.current })
  }

  const lastRotateSnapshotRef = useRef(0)

  function rotatePanel(panelId: string, rotation: number) {
    const next = panelsRef.current.map((panel) =>
      panel.id === panelId ? { ...panel, rotation: normalizeRotation(rotation) } : panel
    )
    commitPanels(next)
    const snapshot = { panels: next, visibleCount: visibleCountRef.current }
    // Collapse continuous rotation into a single undo step: the first rotation in a new gesture
    // pushes a fresh entry; rapid follow-up rotations within 1s replace the head of the stack so
    // the final state is always captured without filling the undo history with frame-level steps.
    const now = Date.now()
    if (now - lastRotateSnapshotRef.current > 1000) {
      undoRedo.push(snapshot)
    } else {
      undoRedo.replaceLast(snapshot)
    }
    lastRotateSnapshotRef.current = now
  }

  function deletePanel(panelId: string) {
    const nextPanels = panelsRef.current.map((panel) =>
      panel.id === panelId ? { ...panel, deleted: true } : panel
    )
    const nextVisibleCount = Math.max(minVisibleCount, visibleCountRef.current - 1)
    commitPanels(nextPanels)
    commitVisibleCount(nextVisibleCount)
    undoRedo.push({ panels: nextPanels, visibleCount: nextVisibleCount })
  }

  function updatePanelEnergy(panelId: string, monthlyEnergyDcKwh: number[]) {
    // Energy refreshes are derived data from the backend recompute; not part of the undo history.
    const next = panelsRef.current.map((panel) =>
      panel.id === panelId ? { ...panel, monthlyEnergyDcKwh } : panel
    )
    commitPanels(next)
  }

  /**
   * Mid-gesture bulk update — applies new centers/rotations without pushing to history.
   * Used by the canvas interactions to live-preview group drag and group rotation; the gesture
   * commits a single snapshot at gesture end via {@link bulkUpdatePanelsAndCommit}.
   */
  function bulkUpdatePanels(
    updates: Array<{ id: string; center?: { lat: number; lng: number }; rotation?: number }>
  ): WorkbenchPanelState[] {
    if (updates.length === 0) return panelsRef.current
    const updateMap = new Map(updates.map((u) => [u.id, u]))
    const next = panelsRef.current.map((panel) => {
      const update = updateMap.get(panel.id)
      if (!update) return panel
      return {
        ...panel,
        ...(update.center !== undefined && { center: update.center }),
        ...(update.rotation !== undefined && { rotation: normalizeRotation(update.rotation) })
      }
    })
    commitPanels(next)
    return next
  }

  /**
   * Gesture-end bulk update — applies the final positions and pushes ONE snapshot capturing the
   * after-state. Used at the end of group drag / group rotation so the gesture is undoable as a
   * single transaction.
   */
  function bulkUpdatePanelsAndCommit(
    updates: Array<{ id: string; center?: { lat: number; lng: number }; rotation?: number }>
  ) {
    const next = bulkUpdatePanels(updates)
    undoRedo.push({ panels: next, visibleCount: visibleCountRef.current })
  }

  function getPanel(panelId: string) {
    return panelMap.get(panelId)
  }

  function setVisibleCount(count: number) {
    const target = Math.max(minVisibleCount, Math.min(maxVisibleCount, count))

    // If the slider goes above the current non-deleted pool size, resurrect the
    // top-of-stable-order deleted panels so increasing the slider actually adds
    // panels back to the workbench. activePanelIds always filters out deleted
    // panels, so without this the slider would silently cap at nonDeletedCount.
    const current = panelsRef.current
    let nextPanels = current
    const nonDeletedCount = current.reduce((acc, panel) => acc + (panel.deleted ? 0 : 1), 0)
    if (target > nonDeletedCount) {
      const needed = target - nonDeletedCount
      const orderIndex = new Map(stableOrderRef.current.map((id, i) => [id, i]))
      const resurrectIds = new Set(
        current
          .filter((panel) => panel.deleted)
          .sort((a, b) => (orderIndex.get(a.id) ?? Infinity) - (orderIndex.get(b.id) ?? Infinity))
          .slice(0, needed)
          .map((panel) => panel.id)
      )
      if (resurrectIds.size > 0) {
        nextPanels = current.map((panel) => (resurrectIds.has(panel.id) ? { ...panel, deleted: false } : panel))
      }
    }

    commitPanels(nextPanels)
    commitVisibleCount(target)
    undoRedo.push({ panels: nextPanels, visibleCount: target })
  }

  function resetDeletionsAndApplyVisibleCount(count: number) {
    const nextPanels = panelsRef.current.map((p) => (p.deleted ? { ...p, deleted: false } : p))
    const nextVisibleCount = Math.max(minVisibleCount, Math.min(maxVisibleCount, count))
    commitPanels(nextPanels)
    commitVisibleCount(nextVisibleCount)
    undoRedo.push({ panels: nextPanels, visibleCount: nextVisibleCount })
  }

  const undo = useCallback(() => {
    const snapshot = undoRedo.undo()
    if (snapshot) {
      setPanels(snapshot.panels)
      setVisibleCountState(snapshot.visibleCount)
    }
  }, [undoRedo])

  const redo = useCallback(() => {
    const snapshot = undoRedo.redo()
    if (snapshot) {
      setPanels(snapshot.panels)
      setVisibleCountState(snapshot.visibleCount)
    }
  }, [undoRedo])

  function serializeLayout(): PanelEdit[] {
    return panels.map((panel) => {
      const isActive = activePanelIds.has(panel.id)
      const moved =
        Math.abs(panel.center.lat - panel.originalCenter.lat) > WORKBENCH_CONFIG.positionEpsilon ||
        Math.abs(panel.center.lng - panel.originalCenter.lng) > WORKBENCH_CONFIG.positionEpsilon ||
        Math.abs(panel.rotation - panel.originalRotation) > WORKBENCH_CONFIG.rotationEpsilon

      return {
        id: panel.id,
        status: isActive ? (moved ? 'moved' : 'kept') : 'deleted',
        center: panel.center,
        rotation: panel.rotation,
        monthlyEnergyDcKwh: panel.monthlyEnergyDcKwh
      }
    })
  }

  const allPanelsEnergyRange = useMemo(() => {
    const energies = panels.filter((p) => !p.deleted).map((p) => getPanelAnnualEnergy(p))
    if (energies.length === 0) return { min: 0, max: 0 }
    return { min: Math.min(...energies), max: Math.max(...energies) }
  }, [panels])

  return {
    panels,
    orderedPanels,
    visiblePanels,
    visibleCount,
    minVisibleCount,
    maxVisibleCount,
    totalAnnualYield,
    totalCarbonOffsetKg,
    activePanelIds,
    allPanelsEnergyRange,
    getPanel,
    movePanel,
    rotatePanel,
    deletePanel,
    updatePanelEnergy,
    bulkUpdatePanels,
    bulkUpdatePanelsAndCommit,
    pushSnapshot,
    setVisibleCount,
    resetDeletionsAndApplyVisibleCount,
    serializeLayout,
    undo,
    redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo
  }
}
