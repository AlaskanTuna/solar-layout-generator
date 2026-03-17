import { useEffect, useMemo, useRef, useState } from 'react'
import type { PanelEdit } from '@shared/types'
import { recomputeFluxBatch } from '@/api/locations'
import {
  annualEnergyFromMonthly,
  getInitialPanelRotation,
  normalizeRotation,
  parsePanelEdits,
  type RoofSegment,
  type SolarPanel
} from '@/lib/buildingInsights'

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

export type BatchRecomputeStatus = 'idle' | 'loading' | 'done' | 'error'

type UsePanelStateArgs = {
  projectId: string | undefined
  locationId: string | undefined
  solarPanels: SolarPanel[]
  roofSegments: RoofSegment[]
  editedLayout: unknown
  maxArrayPanelsCount: number
  carbonOffsetFactorKgPerMwh: number
  onBatchRecomputeStatusChange?: (status: BatchRecomputeStatus) => void
}

const POSITION_EPSILON = 1e-8
const ROTATION_EPSILON = 1e-3

function getPanelAnnualEnergy(panel: WorkbenchPanelState): number {
  return panel.monthlyEnergyDcKwh.length > 0
    ? annualEnergyFromMonthly(panel.monthlyEnergyDcKwh)
    : panel.yearlyEnergyDcKwh
}

export function usePanelState({
  projectId,
  locationId,
  solarPanels,
  roofSegments,
  editedLayout,
  maxArrayPanelsCount,
  carbonOffsetFactorKgPerMwh,
  onBatchRecomputeStatusChange
}: UsePanelStateArgs) {
  const [panels, setPanels] = useState<WorkbenchPanelState[]>([])
  const [visibleCount, setVisibleCountState] = useState(0)
  const initializedProjectIdRef = useRef<string | null>(null)
  const batchRecomputedProjectIdRef = useRef<string | null>(null)
  const stableOrderRef = useRef<string[]>([])

  const parsedEdits = useMemo(() => parsePanelEdits(editedLayout), [editedLayout])

  const minVisibleCount = solarPanels.length === 0 ? 0 : Math.min(4, solarPanels.length)
  const maxVisibleCount = Math.min(maxArrayPanelsCount, solarPanels.length)

  useEffect(() => {
    if (!projectId || solarPanels.length === 0) {
      setPanels((prev) => (prev.length === 0 ? prev : []))
      setVisibleCountState((prev) => (prev === 0 ? prev : 0))
      initializedProjectIdRef.current = null
      batchRecomputedProjectIdRef.current = null
      return
    }

    // Only initialize once per project to prevent TanStack Query refetches
    // from overwriting in-progress local edits (drag, rotate, delete)
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

    const sorted = [...nextPanels].sort((a, b) => getPanelAnnualEnergy(b) - getPanelAnnualEnergy(a))
    stableOrderRef.current = sorted.map((p) => p.id)

    const savedActiveCount =
      parsedEdits.length > 0 ? nextPanels.filter((panel) => !panel.deleted).length : maxVisibleCount
    const nextVisibleCount = Math.max(minVisibleCount, Math.min(maxVisibleCount, savedActiveCount || maxVisibleCount))
    setVisibleCountState(nextVisibleCount)
  }, [projectId, solarPanels, roofSegments, parsedEdits, minVisibleCount, maxVisibleCount])

  // Auto-recompute monthly energy for panels that only have yearly data
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
            rotation: p.rotation
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

  const deletedCount = useMemo(() => panels.filter((p) => p.deleted).length, [panels])
  const effectiveMaxVisibleCount = Math.max(minVisibleCount, maxVisibleCount - deletedCount)

  const activePanelIds = useMemo(() => {
    const ids = stableOrderRef.current
      .filter((id) => {
        const panel = panelMap.get(id)
        return panel && !panel.deleted
      })
      .slice(0, visibleCount)
    return new Set(ids)
  }, [panelMap, visibleCount])

  const visiblePanels = useMemo(
    () => panels.filter((panel) => activePanelIds.has(panel.id)),
    [panels, activePanelIds]
  )

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
    updatePanelState(panelId, (panel) => ({ ...panel, center }))
  }

  function rotatePanel(panelId: string, rotation: number) {
    updatePanelState(panelId, (panel) => ({ ...panel, rotation: normalizeRotation(rotation) }))
  }

  function deletePanel(panelId: string) {
    updatePanelState(panelId, (panel) => ({ ...panel, deleted: true }))
    setVisibleCountState((current) => Math.max(minVisibleCount, current - 1))
  }

  function updatePanelEnergy(panelId: string, monthlyEnergyDcKwh: number[]) {
    updatePanelState(panelId, (panel) => ({ ...panel, monthlyEnergyDcKwh }))
  }

  function getPanel(panelId: string) {
    return panelMap.get(panelId)
  }

  function setVisibleCount(count: number) {
    setVisibleCountState(Math.max(minVisibleCount, Math.min(effectiveMaxVisibleCount, count)))
  }

  function serializeLayout(): PanelEdit[] {
    return panels.map((panel) => {
      const isActive = activePanelIds.has(panel.id)
      const moved =
        Math.abs(panel.center.lat - panel.originalCenter.lat) > POSITION_EPSILON ||
        Math.abs(panel.center.lng - panel.originalCenter.lng) > POSITION_EPSILON ||
        Math.abs(panel.rotation - panel.originalRotation) > ROTATION_EPSILON

      return {
        id: panel.id,
        status: isActive ? (moved ? 'moved' : 'kept') : 'deleted',
        center: panel.center,
        rotation: panel.rotation,
        monthlyEnergyDcKwh: panel.monthlyEnergyDcKwh
      }
    })
  }

  return {
    panels,
    orderedPanels,
    visiblePanels,
    visibleCount,
    minVisibleCount,
    maxVisibleCount: effectiveMaxVisibleCount,
    totalAnnualYield,
    totalCarbonOffsetKg,
    activePanelIds,
    getPanel,
    movePanel,
    rotatePanel,
    deletePanel,
    updatePanelEnergy,
    setVisibleCount,
    serializeLayout
  }
}
