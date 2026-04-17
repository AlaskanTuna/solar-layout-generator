import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { recomputeFlux, recomputeFluxBatch } from '@/api/locations'
import {
  createCanvasGeo,
  getRectAabb,
  getRotatedRectPoints,
  isAabbInsideStage,
  isPolygonInsideRasterMask,
  obbsOverlap,
  obbsOverlapWithMinSeparation,
  latLngToPixel,
  panelMetersToPixels,
  pixelToLatLng,
  type CanvasGeo
} from '@/lib/canvasTransforms'
import { notify } from '@/components/ui/toastConfig'
import { computeSnap, computeOverlapSnap, type SnapGuide } from '@/lib/snapAlignment'
import type { LocationImageGeoTransform } from '@/api/locations'
import type { DecodedRoofMask } from '@/hooks/useWorkbenchData'
import type { WorkbenchPanelState } from '@/hooks/usePanelState'
import { computeSegmentHulls } from '@/lib/segmentVisualization'
import type { SolarPanel, RoofSegment } from '@/lib/buildingInsights'
import { PANEL_MODELS, getPanelModel, type PanelModel } from '@shared/types'

function getPlacementErrorMessage(reason: 'bounds' | 'mask' | 'overlap') {
  switch (reason) {
    case 'mask':
      return 'That placement leaves the detected roof boundary.'
    case 'overlap':
      return 'That placement overlaps another panel.'
    default:
      return 'That placement leaves the roof image bounds.'
  }
}

type UseCanvasInteractionsOptions = {
  locationId: string | undefined
  imageGeoTransform: LocationImageGeoTransform | null
  roofMask: DecodedRoofMask | null
  stageSize: { width: number; height: number }
  selectedPanelModel: PanelModel
  selectedPanelModelId: string
  setSelectedPanelModelId: (id: string) => void
  visiblePanels: WorkbenchPanelState[]
  getPanel: (id: string) => WorkbenchPanelState | undefined
  movePanel: (id: string, center: { lat: number; lng: number }) => void
  rotatePanel: (id: string, rotation: number) => void
  deletePanel: (id: string) => void
  updatePanelEnergy: (panelId: string, monthlyEnergyDcKwh: number[]) => void
  showSegments: boolean
  solarPanels: SolarPanel[]
  roofSegments: RoofSegment[]
}

export function useCanvasInteractions({
  locationId,
  imageGeoTransform,
  roofMask,
  stageSize,
  selectedPanelModel,
  selectedPanelModelId,
  visiblePanels,
  getPanel,
  movePanel,
  rotatePanel,
  deletePanel,
  updatePanelEnergy,
  setSelectedPanelModelId,
  showSegments,
  solarPanels,
  roofSegments
}: UseCanvasInteractionsOptions) {
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedPanelIds, setSelectedPanelIds] = useState<Set<string>>(new Set())
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [pendingPanelId, setPendingPanelId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [isModelRecomputing, setIsModelRecomputing] = useState(false)
  const [marqueeMode, setMarqueeMode] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)

  const geo = useMemo(() => {
    if (!imageGeoTransform || stageSize.width === 0 || stageSize.height === 0) return null
    return createCanvasGeo(imageGeoTransform, stageSize.width, stageSize.height)
  }, [imageGeoTransform, stageSize])

  const renderPanels = useMemo(() => {
    if (!geo) return []
    return visiblePanels.map((panel) => ({
      panel,
      ...latLngToPixel(panel.center.lat, panel.center.lng, geo)
    }))
  }, [visiblePanels, geo])

  const panelDimensions = useMemo(() => {
    if (!geo) return null
    return panelMetersToPixels(selectedPanelModel.widthM, selectedPanelModel.heightM, geo)
  }, [selectedPanelModel, geo])

  const maskGeo = useMemo(() => {
    if (!roofMask) return null
    return createCanvasGeo(roofMask.geoTransform, roofMask.width, roofMask.height)
  }, [roofMask])

  const maskPanelDimensions = useMemo(() => {
    if (!maskGeo) return null
    return panelMetersToPixels(selectedPanelModel.widthM, selectedPanelModel.heightM, maskGeo)
  }, [selectedPanelModel, maskGeo])

  const stageReady = stageSize.width > 0 && stageSize.height > 0 && !!geo && !!panelDimensions

  const segmentHulls = useMemo(() => {
    if (!showSegments || !geo || !panelDimensions) return []
    const pixelMap = new Map<string, { x: number; y: number; rotation: number }>()
    for (const { panel, x, y } of renderPanels) {
      pixelMap.set(panel.id, { x, y, rotation: panel.rotation })
    }
    return computeSegmentHulls(
      solarPanels,
      roofSegments,
      pixelMap,
      new Set(visiblePanels.map((p) => p.id)),
      panelDimensions.width,
      panelDimensions.height
    )
  }, [showSegments, geo, panelDimensions, visiblePanels, renderPanels, solarPanels, roofSegments])

  const selectedPanelId = selectedPanelIds.size === 1 ? [...selectedPanelIds][0]! : null
  const selectedPanel = selectedPanelId ? (getPanel(selectedPanelId) ?? null) : null

  useEffect(() => {
    if (visiblePanels.length === 0) {
      setSelectedPanelIds(new Set())
      return
    }
    setSelectedPanelIds((prev) => {
      const visibleIds = new Set(visiblePanels.map((p) => p.id))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      if (next.size === 0 && visiblePanels.length > 0) {
        next.add(visiblePanels[0]!.id)
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev
      return next
    })
  }, [visiblePanels])

  useEffect(() => {
    return () => {
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
    }
  }, [])

  function getPlacementPoints(center: { lat: number; lng: number }, rotation: number, canvasGeo: CanvasGeo) {
    if (!panelDimensions) return null
    const pixelCenter = latLngToPixel(center.lat, center.lng, canvasGeo)
    return getRotatedRectPoints(pixelCenter.x, pixelCenter.y, panelDimensions.width, panelDimensions.height, rotation)
  }

  function getPlacementError(
    panelId: string,
    center: { lat: number; lng: number },
    rotation: number,
    excludeIds?: Set<string>
  ) {
    if (!geo || !panelDimensions) return 'bounds' as const

    const proposedPoints = getPlacementPoints(center, rotation, geo)
    if (!proposedPoints) return 'bounds' as const

    if (!isAabbInsideStage(getRectAabb(proposedPoints), stageSize.width, stageSize.height)) {
      return 'bounds' as const
    }

    if (roofMask && maskGeo && maskPanelDimensions) {
      const maskCenter = latLngToPixel(center.lat, center.lng, maskGeo)
      const maskPoints = getRotatedRectPoints(
        maskCenter.x,
        maskCenter.y,
        maskPanelDimensions.width,
        maskPanelDimensions.height,
        rotation
      )
      if (!isPolygonInsideRasterMask(maskPoints, roofMask)) {
        return 'mask' as const
      }
    }

    for (const otherPanel of visiblePanels) {
      if (otherPanel.id === panelId) continue
      if (excludeIds?.has(otherPanel.id)) continue
      const otherPoints = getPlacementPoints(otherPanel.center, otherPanel.rotation, geo)
      if (otherPoints && obbsOverlap(proposedPoints, otherPoints)) {
        return 'overlap' as const
      }
    }

    return null
  }

  async function recomputePanel(
    panelId: string,
    center: { lat: number; lng: number },
    rotation: number,
    rollback: () => void
  ) {
    if (!locationId) return

    setPendingPanelId(panelId)
    notify.info('Recomputing panel yield from cached monthly flux data...')

    try {
      const result = await recomputeFlux(locationId, {
        panelId,
        center,
        rotation,
        widthM: selectedPanelModel.widthM,
        heightM: selectedPanelModel.heightM,
        capacityWp: selectedPanelModel.capacityWp
      })
      updatePanelEnergy(result.panelId, result.monthlyEnergyDcKwh)
      setMessage(null)
    } catch (recomputeError) {
      rollback()
      notify.error(recomputeError instanceof Error ? recomputeError.message : 'Failed to recompute panel energy')
    } finally {
      setPendingPanelId(null)
    }
  }

  const handleSnapDragMove = useCallback(
    (panelId: string, position: { x: number; y: number }) => {
      if (!snapEnabled || !panelDimensions) {
        setSnapGuides([])
        return position
      }

      const panel = getPanel(panelId)
      if (!panel) return position

      const otherPanels = renderPanels
        .filter(({ panel: p }) => p.id !== panelId)
        .map(({ panel: p, x, y }) => ({ id: p.id, x, y, rotation: p.rotation }))

      const result = computeSnap(
        { x: position.x, y: position.y, rotation: panel.rotation, id: panelId },
        otherPanels,
        panelDimensions.width,
        panelDimensions.height,
        stageSize.width,
        stageSize.height
      )

      setSnapGuides(result.guides)
      return { x: result.x, y: result.y }
    },
    [snapEnabled, panelDimensions, getPanel, renderPanels, stageSize]
  )

  function handlePanelSelect(panelId: string, shiftKey: boolean) {
    setSelectedPanelIds((prev) => {
      if (shiftKey) {
        const next = new Set(prev)
        if (next.has(panelId)) {
          next.delete(panelId)
        } else {
          next.add(panelId)
        }
        return next
      }
      return new Set([panelId])
    })
  }

  async function handlePanelDragEnd(panelId: string, position: { x: number; y: number }, resetPosition: () => void) {
    setSnapGuides([])
    if (!geo) return

    const panel = getPanel(panelId)
    if (!panel) return

    if (!selectedPanelIds.has(panelId) || selectedPanelIds.size <= 1) {
      let candidatePixel = { x: position.x, y: position.y }
      const rawCenter = pixelToLatLng(candidatePixel.x, candidatePixel.y, geo)
      let placementError = getPlacementError(panelId, rawCenter, panel.rotation)

      // Auto-correct overlap against same-rotation neighbors by snapping edge-to-edge.
      // Iteratively resolves: each pass pushes the dragged panel out of its most-overlapping
      // neighbor; repeats until no overlap, until rotation mismatch blocks the snap, or the
      // iteration cap is hit (guards against oscillation between neighbors).
      if (placementError === 'overlap' && panelDimensions) {
        const maxIterations = Math.max(4, renderPanels.length)

        for (let iter = 0; iter < maxIterations; iter++) {
          let worst: { neighbor: { x: number; y: number; rotation: number }; penetration: number } | null = null

          for (const rp of renderPanels) {
            if (rp.panel.id === panelId) continue
            const draggedPoly = getRotatedRectPoints(
              candidatePixel.x,
              candidatePixel.y,
              panelDimensions.width,
              panelDimensions.height,
              panel.rotation
            )
            const neighborPoly = getRotatedRectPoints(
              rp.x,
              rp.y,
              panelDimensions.width,
              panelDimensions.height,
              rp.panel.rotation
            )
            const overlap = obbsOverlapWithMinSeparation(draggedPoly, neighborPoly)
            if (overlap && (!worst || overlap.penetration > worst.penetration)) {
              worst = {
                neighbor: { x: rp.x, y: rp.y, rotation: rp.panel.rotation },
                penetration: overlap.penetration
              }
            }
          }

          if (!worst) break // no more overlaps

          const overlapSnap = computeOverlapSnap(
            { x: candidatePixel.x, y: candidatePixel.y, rotation: panel.rotation },
            worst.neighbor,
            panelDimensions.width,
            panelDimensions.height
          )
          if (!overlapSnap.snapped) break // rotation mismatch — cannot resolve cleanly

          candidatePixel = { x: overlapSnap.x, y: overlapSnap.y }
        }

        const correctedCenter = pixelToLatLng(candidatePixel.x, candidatePixel.y, geo)
        placementError = getPlacementError(panelId, correctedCenter, panel.rotation)

        // After overlap-snap resolves the dominant SAT axis, try one axis-alignment pass
        // to clean up residual perpendicular offset (e.g. corner-overlap cases). Revert if
        // the alignment would re-introduce any placement error.
        if (!placementError && snapEnabled) {
          const otherPanels = renderPanels
            .filter(({ panel: p }) => p.id !== panelId)
            .map(({ panel: p, x, y }) => ({ id: p.id, x, y, rotation: p.rotation }))
          const aligned = computeSnap(
            { x: candidatePixel.x, y: candidatePixel.y, rotation: panel.rotation, id: panelId },
            otherPanels,
            panelDimensions.width,
            panelDimensions.height,
            stageSize.width,
            stageSize.height
          )
          const alignedCenter = pixelToLatLng(aligned.x, aligned.y, geo)
          if (!getPlacementError(panelId, alignedCenter, panel.rotation)) {
            candidatePixel = { x: aligned.x, y: aligned.y }
          }
        }
      }

      if (placementError) {
        resetPosition()
        notify.error(getPlacementErrorMessage(placementError))
        return
      }

      const nextCenter = pixelToLatLng(candidatePixel.x, candidatePixel.y, geo)
      const previousCenter = panel.center
      movePanel(panelId, nextCenter)
      await recomputePanel(panelId, nextCenter, panel.rotation, () => {
        movePanel(panelId, previousCenter)
        resetPosition()
      })
      return
    }

    const origPixel = latLngToPixel(panel.center.lat, panel.center.lng, geo)
    let deltaX = position.x - origPixel.x
    let deltaY = position.y - origPixel.y

    const selectedPanels = [...selectedPanelIds]
      .map((id) => getPanel(id))
      .filter((p): p is NonNullable<typeof p> => p != null)

    // Iteratively resolve group-vs-outside overlaps by shifting the shared delta.
    // Preserves intra-group geometry; the whole group translates as one unit.
    if (panelDimensions) {
      const outsidePanels = renderPanels.filter(({ panel: p }) => !selectedPanelIds.has(p.id))
      const maxIterations = Math.max(4, outsidePanels.length)

      for (let iter = 0; iter < maxIterations; iter++) {
        let worst: { axis: { x: number; y: number }; penetration: number; rotDiff: number } | null = null

        for (const sp of selectedPanels) {
          const spPixel = latLngToPixel(sp.center.lat, sp.center.lng, geo)
          const draggedPoly = getRotatedRectPoints(
            spPixel.x + deltaX,
            spPixel.y + deltaY,
            panelDimensions.width,
            panelDimensions.height,
            sp.rotation
          )
          for (const rp of outsidePanels) {
            const neighborPoly = getRotatedRectPoints(
              rp.x,
              rp.y,
              panelDimensions.width,
              panelDimensions.height,
              rp.panel.rotation
            )
            const overlap = obbsOverlapWithMinSeparation(draggedPoly, neighborPoly)
            if (!overlap) continue
            const rotDiff = Math.abs(((sp.rotation - rp.panel.rotation + 180) % 360) - 180)
            if (!worst || overlap.penetration > worst.penetration) {
              worst = { axis: overlap.axis, penetration: overlap.penetration, rotDiff }
            }
          }
        }

        if (!worst) break // no overlaps
        if (worst.rotDiff > 3) break // rotation mismatch — cannot resolve

        deltaX += worst.axis.x * (worst.penetration + 0.01)
        deltaY += worst.axis.y * (worst.penetration + 0.01)
      }
    }

    const moves: { id: string; prevCenter: { lat: number; lng: number }; nextCenter: { lat: number; lng: number } }[] =
      []

    for (const sp of selectedPanels) {
      const spPixel = latLngToPixel(sp.center.lat, sp.center.lng, geo)
      const newPixel = { x: spPixel.x + deltaX, y: spPixel.y + deltaY }
      const nextCenter = pixelToLatLng(newPixel.x, newPixel.y, geo)

      const placementError = getPlacementError(sp.id, nextCenter, sp.rotation, selectedPanelIds)
      if (placementError) {
        resetPosition()
        notify.error(`Group move failed: ${getPlacementErrorMessage(placementError)}`)
        return
      }
      moves.push({ id: sp.id, prevCenter: sp.center, nextCenter })
    }

    for (const mv of moves) {
      movePanel(mv.id, mv.nextCenter)
    }

    if (!locationId) return
    setPendingPanelId(panelId)
    notify.info(`Recomputing yield for ${moves.length} panels...`)

    try {
      const batchResponse = await recomputeFluxBatch(locationId, {
        panels: moves.map((mv) => {
          const p = getPanel(mv.id)!
          return {
            panelId: mv.id,
            center: mv.nextCenter,
            rotation: p.rotation,
            widthM: selectedPanelModel.widthM,
            heightM: selectedPanelModel.heightM,
            capacityWp: selectedPanelModel.capacityWp
          }
        })
      })
      for (const result of batchResponse.results) {
        if (result.monthlyEnergyDcKwh.length === 12) {
          updatePanelEnergy(result.panelId, result.monthlyEnergyDcKwh)
        }
      }
      setMessage(null)
    } catch {
      for (const mv of moves) {
        movePanel(mv.id, mv.prevCenter)
      }
      resetPosition()
      notify.error('Failed to recompute group move. Positions reverted.')
    } finally {
      setPendingPanelId(null)
    }
  }

  function scheduleRotationRecompute(
    panelId: string,
    center: { lat: number; lng: number },
    rotation: number,
    previousRotation: number
  ) {
    if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)

    rotationTimeoutRef.current = setTimeout(() => {
      void recomputePanel(panelId, center, rotation, () => rotatePanel(panelId, previousRotation))
    }, 1000)
  }

  function handleCanvasRotate(panelId: string, value: number) {
    const nextRotation = ((value % 360) + 360) % 360

    // Multi-panel rotation: rotate all selected panels together. Exclude the selection from
    // overlap candidates so tight-packed groups don't flag their own siblings as collisions.
    if (selectedPanelIds.size > 1 && selectedPanelIds.has(panelId)) {
      for (const id of selectedPanelIds) {
        const p = getPanel(id)
        if (!p) continue
        const placementError = getPlacementError(p.id, p.center, nextRotation, selectedPanelIds)
        if (placementError) {
          notify.error(getPlacementErrorMessage(placementError))
          return
        }
      }
      for (const id of selectedPanelIds) {
        rotatePanel(id, nextRotation)
      }
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
      rotationTimeoutRef.current = setTimeout(() => {
        if (!locationId) return
        const panels = [...selectedPanelIds]
          .map((id) => getPanel(id))
          .filter((p): p is NonNullable<typeof p> => p != null)
        void recomputeFluxBatch(locationId, {
          panels: panels.map((p) => ({
            panelId: p.id,
            center: p.center,
            rotation: nextRotation,
            widthM: selectedPanelModel.widthM,
            heightM: selectedPanelModel.heightM,
            capacityWp: selectedPanelModel.capacityWp
          }))
        })
          .then((resp) => {
            for (const r of resp.results) {
              if (r.monthlyEnergyDcKwh.length === 12) updatePanelEnergy(r.panelId, r.monthlyEnergyDcKwh)
            }
          })
          .catch(() => {})
      }, 1000)
      return
    }

    // Single-panel rotation: use panelId directly to avoid stale closure on selectedPanel
    const panel = getPanel(panelId)
    if (!panel) return

    if (!selectedPanelIds.has(panelId)) {
      setSelectedPanelIds(new Set([panelId]))
    }

    const placementError = getPlacementError(panel.id, panel.center, nextRotation)
    if (placementError) {
      notify.error(getPlacementErrorMessage(placementError))
      return
    }

    const previousRotation = panel.rotation
    rotatePanel(panel.id, nextRotation)
    scheduleRotationRecompute(panel.id, panel.center, nextRotation, previousRotation)
  }

  function handleDeleteSelected() {
    if (selectedPanelIds.size === 0) return
    if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)

    for (const id of selectedPanelIds) {
      deletePanel(id)
    }
    setSelectedPanelIds(new Set())
    setMessage(null)
  }

  async function handleModelChange(nextModelId: string) {
    const prevModelId = selectedPanelModelId
    setSelectedPanelModelId(nextModelId)

    if (!locationId || visiblePanels.length === 0) return

    setIsModelRecomputing(true)
    notify.info('Recalculating energy for new panel dimensions...')

    const nextModel = getPanelModel(nextModelId) ?? PANEL_MODELS[1]!

    try {
      const batchResponse = await recomputeFluxBatch(locationId, {
        panels: visiblePanels.map((panel) => ({
          panelId: panel.id,
          center: panel.center,
          rotation: panel.rotation,
          widthM: nextModel.widthM,
          heightM: nextModel.heightM,
          capacityWp: nextModel.capacityWp
        }))
      })

      for (const result of batchResponse.results) {
        if (result.monthlyEnergyDcKwh.length === 12) {
          updatePanelEnergy(result.panelId, result.monthlyEnergyDcKwh)
        }
      }
      setMessage(null)
    } catch (err) {
      setSelectedPanelModelId(prevModelId)
      notify.error(err instanceof Error ? err.message : 'Failed to recalculate energy. Reverted panel model.')
    } finally {
      setIsModelRecomputing(false)
    }
  }

  function handleMarqueeStart(pointerX: number, pointerY: number, scaleX: number, stageX: number, stageY: number) {
    const stagePos = {
      x: (pointerX - stageX) / scaleX,
      y: (pointerY - stageY) / scaleX
    }
    marqueeStartRef.current = stagePos
    setMarqueeRect({ x: stagePos.x, y: stagePos.y, width: 0, height: 0 })
  }

  function handleMarqueeMove(pointerX: number, pointerY: number, scaleX: number, stageX: number, stageY: number) {
    if (!marqueeStartRef.current || !marqueeRect) return
    const stagePos = {
      x: (pointerX - stageX) / scaleX,
      y: (pointerY - stageY) / scaleX
    }
    const start = marqueeStartRef.current
    setMarqueeRect({
      x: Math.min(start.x, stagePos.x),
      y: Math.min(start.y, stagePos.y),
      width: Math.abs(stagePos.x - start.x),
      height: Math.abs(stagePos.y - start.y)
    })
  }

  function handleMarqueeEnd() {
    if (!marqueeRect || !marqueeStartRef.current) return
    const selected = new Set<string>()
    for (const { panel, x, y } of renderPanels) {
      if (
        x >= marqueeRect.x &&
        x <= marqueeRect.x + marqueeRect.width &&
        y >= marqueeRect.y &&
        y <= marqueeRect.y + marqueeRect.height
      ) {
        selected.add(panel.id)
      }
    }
    if (selected.size > 0) {
      setSelectedPanelIds(selected)
    }
    setMarqueeRect(null)
    marqueeStartRef.current = null
  }

  return {
    geo,
    panelDimensions,
    stageReady,
    selectedPanelIds,
    setSelectedPanelIds,
    selectedPanel,
    snapEnabled,
    setSnapEnabled,
    snapGuides,
    pendingPanelId,
    message,
    renderPanels,
    segmentHulls,
    isModelRecomputing,
    marqueeMode,
    setMarqueeMode,
    marqueeRect,
    handleSnapDragMove,
    handlePanelSelect,
    handlePanelDragEnd,
    handleCanvasRotate,
    handleDeleteSelected,
    handleModelChange,
    handleMarqueeStart,
    handleMarqueeMove,
    handleMarqueeEnd
  }
}
