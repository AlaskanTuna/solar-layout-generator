import { useEffect, useMemo, useState } from 'react'
import type { PanelEdit } from '@shared/types'
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

type UsePanelStateArgs = {
  projectId: string | undefined
  solarPanels: SolarPanel[]
  roofSegments: RoofSegment[]
  editedLayout: unknown
  maxArrayPanelsCount: number
  carbonOffsetFactorKgPerMwh: number
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
  solarPanels,
  roofSegments,
  editedLayout,
  maxArrayPanelsCount,
  carbonOffsetFactorKgPerMwh
}: UsePanelStateArgs) {
  const [panels, setPanels] = useState<WorkbenchPanelState[]>([])
  const [visibleCount, setVisibleCountState] = useState(0)

  const parsedEdits = useMemo(() => parsePanelEdits(editedLayout), [editedLayout])

  const minVisibleCount = solarPanels.length === 0 ? 0 : Math.min(4, solarPanels.length)
  const maxVisibleCount = Math.min(maxArrayPanelsCount, solarPanels.length)

  useEffect(() => {
    if (!projectId || solarPanels.length === 0) {
      setPanels((prev) => (prev.length === 0 ? prev : []))
      setVisibleCountState((prev) => (prev === 0 ? prev : 0))
      return
    }

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

    const savedActiveCount =
      parsedEdits.length > 0 ? nextPanels.filter((panel) => !panel.deleted).length : maxVisibleCount
    const nextVisibleCount = Math.max(minVisibleCount, Math.min(maxVisibleCount, savedActiveCount || maxVisibleCount))
    setVisibleCountState(nextVisibleCount)
  }, [projectId, solarPanels, roofSegments, parsedEdits, minVisibleCount, maxVisibleCount])

  const orderedPanels = useMemo(
    () => [...panels].sort((a, b) => getPanelAnnualEnergy(b) - getPanelAnnualEnergy(a)),
    [panels]
  )

  const activePanelIds = useMemo(() => {
    const ids = orderedPanels
      .filter((panel) => !panel.deleted)
      .slice(0, visibleCount)
      .map((panel) => panel.id)

    return new Set(ids)
  }, [orderedPanels, visibleCount])

  const visiblePanels = useMemo(
    () => orderedPanels.filter((panel) => activePanelIds.has(panel.id)),
    [orderedPanels, activePanelIds]
  )

  const panelMap = useMemo(() => new Map(panels.map((panel) => [panel.id, panel])), [panels])

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
  }

  function updatePanelEnergy(panelId: string, monthlyEnergyDcKwh: number[]) {
    updatePanelState(panelId, (panel) => ({ ...panel, monthlyEnergyDcKwh }))
  }

  function getPanel(panelId: string) {
    return panelMap.get(panelId)
  }

  function setVisibleCount(count: number) {
    setVisibleCountState(Math.max(minVisibleCount, Math.min(maxVisibleCount, count)))
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
    maxVisibleCount,
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
