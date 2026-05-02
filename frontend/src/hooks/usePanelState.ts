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

  function updatePanelState(panelId: string, updater: (panel: WorkbenchPanelState) => WorkbenchPanelState) {
    setPanels((current) => current.map((panel) => (panel.id === panelId ? updater(panel) : panel)))
  }

  function movePanel(panelId: string, center: { lat: number; lng: number }) {
    pushSnapshot()
    updatePanelState(panelId, (panel) => ({ ...panel, center }))
  }

  const lastRotateSnapshotRef = useRef(0)

  function rotatePanel(panelId: string, rotation: number) {
    // Throttle snapshots to avoid filling undo stack during continuous rotation
    const now = Date.now()
    if (now - lastRotateSnapshotRef.current > 1000) {
      pushSnapshot()
      lastRotateSnapshotRef.current = now
    }
    updatePanelState(panelId, (panel) => ({ ...panel, rotation: normalizeRotation(rotation) }))
  }

  function deletePanel(panelId: string) {
    pushSnapshot()
    updatePanelState(panelId, (panel) => ({ ...panel, deleted: true }))
    setVisibleCountState((current) => Math.max(minVisibleCount, current - 1))
  }

  function updatePanelEnergy(panelId: string, monthlyEnergyDcKwh: number[]) {
    updatePanelState(panelId, (panel) => ({ ...panel, monthlyEnergyDcKwh }))
  }

  function bulkUpdatePanels(updates: Array<{ id: string; center?: { lat: number; lng: number }; rotation?: number }>) {
    if (updates.length === 0) return
    const updateMap = new Map(updates.map((u) => [u.id, u]))
    setPanels((current) =>
      current.map((panel) => {
        const update = updateMap.get(panel.id)
        if (!update) return panel
        return {
          ...panel,
          ...(update.center !== undefined && { center: update.center }),
          ...(update.rotation !== undefined && { rotation: normalizeRotation(update.rotation) })
        }
      })
    )
  }

  function getPanel(panelId: string) {
    return panelMap.get(panelId)
  }

  function setVisibleCount(count: number) {
    pushSnapshot()
    setVisibleCountState(Math.max(minVisibleCount, Math.min(maxVisibleCount, count)))
  }

  function resetDeletionsAndApplyVisibleCount(count: number) {
    pushSnapshot()
    setPanels((current) => current.map((p) => (p.deleted ? { ...p, deleted: false } : p)))
    setVisibleCountState(Math.max(minVisibleCount, Math.min(maxVisibleCount, count)))
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
