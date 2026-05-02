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
import {
  computeSnap,
  computeOverlapSnap,
  resolveGroupOverlapEscape,
  resolveOverlapEscape,
  type SnapGuide
} from '@/lib/snapAlignment'
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
  bulkUpdatePanels: (updates: Array<{ id: string; center?: { lat: number; lng: number }; rotation?: number }>) => void
  pushSnapshot: () => void
  showSegments: boolean
  solarPanels: SolarPanel[]
  roofSegments: RoofSegment[]
}

/**
 * Provides the canvasInteractions hook
 * @param {UseCanvasInteractionsOptions} options - Value used for options
 * @returns {Function} Hook state for canvas interactions
 */
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
  bulkUpdatePanels,
  pushSnapshot,
  setSelectedPanelModelId,
  showSegments,
  solarPanels,
  roofSegments
}: UseCanvasInteractionsOptions) {
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupRotateStateRef = useRef<{
    snapshots: Map<string, { centerPx: { x: number; y: number }; rotation: number }>
    centroid: { x: number; y: number }
    startAngle: number
  } | null>(null)
  const groupDragStateRef = useRef<{
    snapshots: Map<string, { centerPx: { x: number; y: number } }>
    grabbedPanelId: string
  } | null>(null)
  const [selectedPanelIds, setSelectedPanelIds] = useState<Set<string>>(new Set())
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [pendingPanelId, setPendingPanelId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [isModelRecomputing, setIsModelRecomputing] = useState(false)
  const [marqueeMode, setMarqueeMode] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  // RAF-throttle marquee updates: pointermove fires faster than the display can paint, so we
  // coalesce all moves between frames into one setMarqueeRect per RAF tick. Without this the
  // canvas thrashes with ~60+ React re-renders per second during selection drag.
  const marqueeRafRef = useRef<number | null>(null)
  const marqueeNextRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      if (marqueeRafRef.current != null) {
        cancelAnimationFrame(marqueeRafRef.current)
        marqueeRafRef.current = null
      }
    }
  }, [])

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

      // Disable snap during group drag because the other selected panels drift mid-drag
      // Snapping to those temporary positions would make the grabbed panel chase them
      if (groupDragStateRef.current) {
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

  function handlePanelDragStart(panelId: string) {
    if (selectedPanelIds.size <= 1 || !selectedPanelIds.has(panelId) || !geo) return
    pushSnapshot()
    const snapshots = new Map<string, { centerPx: { x: number; y: number } }>()
    for (const id of selectedPanelIds) {
      const p = getPanel(id)
      if (!p) continue
      snapshots.set(id, { centerPx: latLngToPixel(p.center.lat, p.center.lng, geo) })
    }
    groupDragStateRef.current = { snapshots, grabbedPanelId: panelId }
  }

  function handlePanelDragMove(panelId: string, position: { x: number; y: number }) {
    const state = groupDragStateRef.current
    if (!state || state.grabbedPanelId !== panelId || !geo) return
    const grabbedSnap = state.snapshots.get(panelId)
    if (!grabbedSnap) return
    const deltaX = position.x - grabbedSnap.centerPx.x
    const deltaY = position.y - grabbedSnap.centerPx.y

    const updates: Array<{ id: string; center: { lat: number; lng: number } }> = []
    for (const [id, snap] of state.snapshots) {
      if (id === panelId) continue
      const newPixel = { x: snap.centerPx.x + deltaX, y: snap.centerPx.y + deltaY }
      updates.push({ id, center: pixelToLatLng(newPixel.x, newPixel.y, geo) })
    }
    bulkUpdatePanels(updates)
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
      const enteredViaOverlap = placementError === 'overlap'

      // Auto-correct overlap against same-rotation neighbors by snapping edge-to-edge
      // Each pass pushes the panel out of its most-overlapping neighbor until clear or capped
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

        // After SAT push-out, try one alignment pass to clean up residual perpendicular offset
        // Revert if that alignment would reintroduce any placement error
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

        const escaped = resolveOverlapEscape(
          { x: candidatePixel.x, y: candidatePixel.y, rotation: panel.rotation },
          renderPanels
            .filter(({ panel: p }) => p.id !== panelId)
            .map(({ x, y, panel: p }) => ({ x, y, rotation: p.rotation })),
          panelDimensions.width,
          panelDimensions.height,
          {
            stageWidth: stageSize.width,
            stageHeight: stageSize.height
          }
        )
        candidatePixel = { x: escaped.x, y: escaped.y }
        placementError = getPlacementError(
          panelId,
          pixelToLatLng(candidatePixel.x, candidatePixel.y, geo),
          panel.rotation
        )
      }

      // Overlap is best-effort accepted because SAT push-out converges
      // Bounds and mask failures still revert because they are real boundary violations
      if (placementError && (!enteredViaOverlap || (placementError !== 'overlap' && placementError !== 'bounds'))) {
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

    // Group branch uses cached pre-drag pixel positions from handlePanelDragStart
    // Mid-drag updates drift the other selected panels, so reading them directly would double-apply the delta
    const groupState = groupDragStateRef.current
    groupDragStateRef.current = null

    const grabbedSnap = groupState?.snapshots.get(panelId)
    const origPixel = grabbedSnap?.centerPx ?? latLngToPixel(panel.center.lat, panel.center.lng, geo)
    let deltaX = position.x - origPixel.x
    let deltaY = position.y - origPixel.y

    const selectedPanelsWithOrigin = [...selectedPanelIds]
      .map((id) => {
        const p = getPanel(id)
        if (!p) return null
        const snap = groupState?.snapshots.get(id)
        const origPx = snap?.centerPx ?? latLngToPixel(p.center.lat, p.center.lng, geo)
        return { panel: p, origPx }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    let enteredViaOverlap = false

    // Resolve group-vs-outside overlaps by shifting the shared delta
    // The whole group translates as one unit along the SAT minimum-separation axis
    if (panelDimensions) {
      const outsidePanels = renderPanels.filter(({ panel: p }) => !selectedPanelIds.has(p.id))
      const maxIterations = Math.max(4, outsidePanels.length)

      for (let iter = 0; iter < maxIterations; iter++) {
        let worst: { axis: { x: number; y: number }; penetration: number } | null = null

        for (const { panel: sp, origPx } of selectedPanelsWithOrigin) {
          const draggedPoly = getRotatedRectPoints(
            origPx.x + deltaX,
            origPx.y + deltaY,
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
            if (!worst || overlap.penetration > worst.penetration) {
              worst = { axis: overlap.axis, penetration: overlap.penetration }
              enteredViaOverlap = true
            }
          }
        }

        if (!worst) break // no overlaps

        deltaX += worst.axis.x * (worst.penetration + 0.01)
        deltaY += worst.axis.y * (worst.penetration + 0.01)
      }

      const escaped = resolveGroupOverlapEscape(
        selectedPanelsWithOrigin.map(({ panel: sp, origPx }) => ({
          x: origPx.x,
          y: origPx.y,
          rotation: sp.rotation
        })),
        outsidePanels.map(({ panel: rp, x, y }) => ({ x, y, rotation: rp.rotation })),
        { x: deltaX, y: deltaY },
        panelDimensions.width,
        panelDimensions.height,
        {
          stageWidth: stageSize.width,
          stageHeight: stageSize.height
        }
      )
      deltaX = escaped.x
      deltaY = escaped.y
    }

    const moves: { id: string; prevCenter: { lat: number; lng: number }; nextCenter: { lat: number; lng: number } }[] =
      []

    for (const { panel: sp, origPx } of selectedPanelsWithOrigin) {
      const newPixel = { x: origPx.x + deltaX, y: origPx.y + deltaY }
      const nextCenter = pixelToLatLng(newPixel.x, newPixel.y, geo)
      const prevCenter = pixelToLatLng(origPx.x, origPx.y, geo)

      const placementError = getPlacementError(sp.id, nextCenter, sp.rotation, selectedPanelIds)
      // Best-effort accept residual overlap because SAT push converges
      // Only bounds and mask failures trigger a revert
      if (placementError && (!enteredViaOverlap || (placementError !== 'overlap' && placementError !== 'bounds'))) {
        bulkUpdatePanels(
          selectedPanelsWithOrigin.map(({ panel: p, origPx: px }) => ({
            id: p.id,
            center: pixelToLatLng(px.x, px.y, geo)
          }))
        )
        resetPosition()
        notify.error(`Group move failed: ${getPlacementErrorMessage(placementError)}`)
        return
      }
      moves.push({ id: sp.id, prevCenter, nextCenter })
    }

    // No snapshot — handlePanelDragStart already pushed one at gesture start
    bulkUpdatePanels(moves.map((mv) => ({ id: mv.id, center: mv.nextCenter })))

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
      bulkUpdatePanels(moves.map((mv) => ({ id: mv.id, center: mv.prevCenter })))
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

    // Single-panel rotation uses panelId directly to avoid a stale selectedPanel closure
    const panel = getPanel(panelId)
    if (!panel) return

    if (!selectedPanelIds.has(panelId)) {
      setSelectedPanelIds(new Set([panelId]))
    }

    const placementError = getPlacementError(panel.id, panel.center, nextRotation)
    // Rotation overlap is silently blocked to match group rotation behavior
    // Bounds and mask still toast because they are real boundary violations
    if (placementError === 'overlap') return
    if (placementError) {
      notify.error(getPlacementErrorMessage(placementError))
      return
    }

    const previousRotation = panel.rotation
    rotatePanel(panel.id, nextRotation)
    scheduleRotationRecompute(panel.id, panel.center, nextRotation, previousRotation)
  }

  function handleGroupRotateStart(pointerX: number, pointerY: number) {
    if (!geo) return
    pushSnapshot()
    const snapshots = new Map<string, { centerPx: { x: number; y: number }; rotation: number }>()
    for (const id of selectedPanelIds) {
      const p = getPanel(id)
      if (!p) continue
      snapshots.set(id, {
        centerPx: latLngToPixel(p.center.lat, p.center.lng, geo),
        rotation: p.rotation
      })
    }
    if (snapshots.size === 0) return
    const xs = [...snapshots.values()].map((s) => s.centerPx.x)
    const ys = [...snapshots.values()].map((s) => s.centerPx.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const startAngle = Math.atan2(pointerY - cy, pointerX - cx)
    groupRotateStateRef.current = { snapshots, centroid: { x: cx, y: cy }, startAngle }
  }

  function handleGroupRotateMove(pointerX: number, pointerY: number, snapDegrees: number) {
    const state = groupRotateStateRef.current
    if (!state || !geo) return
    const { snapshots, centroid, startAngle } = state
    const currentAngle = Math.atan2(pointerY - centroid.y, pointerX - centroid.x)
    let deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI
    deltaDeg = ((((deltaDeg + 180) % 360) + 360) % 360) - 180
    const snapped = Math.round(deltaDeg / snapDegrees) * snapDegrees
    const deltaRad = (snapped * Math.PI) / 180
    const cosD = Math.cos(deltaRad)
    const sinD = Math.sin(deltaRad)

    const proposals: Array<{ id: string; newCenter: { lat: number; lng: number }; newRotation: number }> = []
    for (const [id, snap] of snapshots) {
      const dx = snap.centerPx.x - centroid.x
      const dy = snap.centerPx.y - centroid.y
      const newX = centroid.x + dx * cosD - dy * sinD
      const newY = centroid.y + dx * sinD + dy * cosD
      const newCenter = pixelToLatLng(newX, newY, geo)
      const newRotation = (((snap.rotation + snapped) % 360) + 360) % 360
      proposals.push({ id, newCenter, newRotation })
    }

    for (const proposal of proposals) {
      const error = getPlacementError(proposal.id, proposal.newCenter, proposal.newRotation, selectedPanelIds)
      if (error) return
    }

    bulkUpdatePanels(proposals.map((p) => ({ id: p.id, center: p.newCenter, rotation: p.newRotation })))
  }

  function handleGroupRotateEnd() {
    const state = groupRotateStateRef.current
    groupRotateStateRef.current = null
    if (!state || !locationId) return
    const panels = [...state.snapshots.keys()]
      .map((id) => getPanel(id))
      .filter((p): p is NonNullable<typeof p> => p != null)
    if (panels.length === 0) return

    if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
    rotationTimeoutRef.current = setTimeout(() => {
      void recomputeFluxBatch(locationId, {
        panels: panels.map((p) => ({
          panelId: p.id,
          center: p.center,
          rotation: p.rotation,
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
    }, 500)
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
    if (!marqueeStartRef.current) return
    marqueeNextRef.current = {
      x: (pointerX - stageX) / scaleX,
      y: (pointerY - stageY) / scaleX
    }
    if (marqueeRafRef.current != null) return
    marqueeRafRef.current = requestAnimationFrame(() => {
      marqueeRafRef.current = null
      const next = marqueeNextRef.current
      const start = marqueeStartRef.current
      if (!next || !start) return
      setMarqueeRect({
        x: Math.min(start.x, next.x),
        y: Math.min(start.y, next.y),
        width: Math.abs(next.x - start.x),
        height: Math.abs(next.y - start.y)
      })
    })
  }

  function handleMarqueeEnd() {
    if (marqueeRafRef.current != null) {
      cancelAnimationFrame(marqueeRafRef.current)
      marqueeRafRef.current = null
    }
    marqueeNextRef.current = null
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

  // Stable callback wrappers for the handlers passed down to memoized PanelRect/PanelLayer.
  // Without this, every parent render produces fresh function refs and React.memo's shallow
  // equality always returns false — defeating memoization. The ref is reassigned every render
  // so the wrappers always invoke the latest closure (no stale-state risk).
  const latestHandlersRef = useRef({
    handleSnapDragMove,
    handlePanelSelect,
    handlePanelDragStart,
    handlePanelDragMove,
    handlePanelDragEnd,
    handleCanvasRotate
  })
  latestHandlersRef.current.handleSnapDragMove = handleSnapDragMove
  latestHandlersRef.current.handlePanelSelect = handlePanelSelect
  latestHandlersRef.current.handlePanelDragStart = handlePanelDragStart
  latestHandlersRef.current.handlePanelDragMove = handlePanelDragMove
  latestHandlersRef.current.handlePanelDragEnd = handlePanelDragEnd
  latestHandlersRef.current.handleCanvasRotate = handleCanvasRotate

  const stableHandlers = useMemo(
    () => ({
      handleSnapDragMove: (panelId: string, position: { x: number; y: number }) =>
        latestHandlersRef.current.handleSnapDragMove(panelId, position),
      handlePanelSelect: (panelId: string, shiftKey: boolean) =>
        latestHandlersRef.current.handlePanelSelect(panelId, shiftKey),
      handlePanelDragStart: (panelId: string) => latestHandlersRef.current.handlePanelDragStart(panelId),
      handlePanelDragMove: (panelId: string, position: { x: number; y: number }) =>
        latestHandlersRef.current.handlePanelDragMove(panelId, position),
      handlePanelDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) =>
        latestHandlersRef.current.handlePanelDragEnd(panelId, position, resetPosition),
      handleCanvasRotate: (panelId: string, value: number) =>
        latestHandlersRef.current.handleCanvasRotate(panelId, value)
    }),
    []
  )

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
    handleSnapDragMove: stableHandlers.handleSnapDragMove,
    handlePanelSelect: stableHandlers.handlePanelSelect,
    handlePanelDragStart: stableHandlers.handlePanelDragStart,
    handlePanelDragMove: stableHandlers.handlePanelDragMove,
    handlePanelDragEnd: stableHandlers.handlePanelDragEnd,
    handleCanvasRotate: stableHandlers.handleCanvasRotate,
    handleGroupRotateStart,
    handleGroupRotateMove,
    handleGroupRotateEnd,
    handleDeleteSelected,
    handleModelChange,
    handleMarqueeStart,
    handleMarqueeMove,
    handleMarqueeEnd
  }
}
