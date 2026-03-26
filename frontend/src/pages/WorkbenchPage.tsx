import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { GuidedTour, type TourStep } from '@/components/GuidedTour'

const WORKBENCH_TOUR_STEPS: TourStep[] = [
  {
    title: 'Your Roof Layout',
    description:
      'Welcome! This page shows solar panels placed on your rooftop by satellite analysis. The blue rectangles are solar panels — you can customise this layout before calculating your savings.'
  },
  {
    target: '[data-tour="panel-model"]',
    title: 'Choose Your Panel Model',
    description:
      'Pick a solar panel brand and model. Different panels have different sizes, efficiency, and prices. The default (Jinko Tiger Neo) is a popular choice in Malaysia.'
  },
  {
    target: '[data-tour="panel-count"]',
    title: 'How Many Panels?',
    description:
      'Slide left to remove panels, right to add more. The system keeps the highest-performing panels first. More panels = more savings, but also higher installation cost.'
  },
  {
    target: '[data-tour="canvas-title"]',
    title: 'Arrange Your Panels',
    description:
      'Click a panel to select it. Drag to reposition, use the sidebar slider to rotate, or press Delete to remove.'
  },
  {
    target: '[data-tour="canvas-controls"]',
    title: 'Canvas Controls',
    description:
      'Undo/redo your edits, use the marquee tool to drag-select groups of panels, toggle snap alignment for precise placement, zoom in/out, and switch overlay views. Hold Spacebar to pan the canvas without losing your selection.'
  },
  {
    target: '[data-tour="save-continue"]',
    title: 'Save & Continue',
    description:
      'Happy with the layout? Click "Save & Continue" to save your arrangement and move to the savings analysis page. You can always come back to adjust later.'
  }
]
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Image as KonvaImage, Layer, Line as KonvaLine, Rect as KonvaRect, Stage } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { recomputeFlux, recomputeFluxBatch, getOverlayUrl } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { MONTHLY_AZIMUTH, MONTHLY_IRRADIANCE, MONTH_LABELS } from '@/components/workbench/IrradianceGlow'
import { PanelLayer } from '@/components/workbench/PanelLayer'
import { PanelModelDrawer } from '@/components/workbench/PanelModelDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { usePanelState, type BatchRecomputeStatus } from '@/hooks/usePanelState'
import { useWorkbenchData } from '@/hooks/useWorkbenchData'
import { annualEnergyFromMonthly } from '@/lib/buildingInsights'
import {
  aabbsOverlap,
  createCanvasGeo,
  getRectAabb,
  getRotatedRectPoints,
  isAabbInsideStage,
  isPolygonInsideRasterMask,
  latLngToPixel,
  panelMetersToPixels,
  pixelToLatLng,
  type CanvasGeo
} from '@/lib/canvasTransforms'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { InfoTooltip } from '@/components/InfoTooltip'
import { computeSegmentHulls } from '@/lib/segmentVisualization'
import { computeSnap, type SnapGuide } from '@/lib/snapAlignment'
import { cn } from '@/lib/utils'
import { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from '@shared/types'

type UiMessage = {
  tone: 'error' | 'info'
  text: string
} | null

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(value)
}

function useLoadedImage(src: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      setImageError(null)
      return
    }

    const nextImage = new window.Image()
    const loadTimeout = window.setTimeout(() => {
      setImage(null)
      setImageError('Timed out while loading the rooftop preview image')
    }, 15000)

    if (import.meta.env.DEV) {
      console.info('[WorkbenchImage] Loading rooftop image', { src })
    }

    nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      window.clearTimeout(loadTimeout)
      setImage(nextImage)
      setImageError(null)

      if (import.meta.env.DEV) {
        console.info('[WorkbenchImage] Rooftop image loaded', {
          width: nextImage.width,
          height: nextImage.height
        })
      }
    }
    nextImage.onerror = () => {
      window.clearTimeout(loadTimeout)
      setImage(null)
      setImageError(`Failed to load rooftop image from: ${src.slice(0, 120)}`)

      if (import.meta.env.DEV) {
        console.error('[WorkbenchImage] Rooftop image failed to load', { src })
      }
    }
    nextImage.src = src

    return () => {
      window.clearTimeout(loadTimeout)
      nextImage.onload = null
      nextImage.onerror = null
    }
  }, [src])

  return { image, imageError }
}

function useStageSize(containerRef: RefObject<HTMLDivElement | null>, image: HTMLImageElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current || !image) {
      setSize({ width: 0, height: 0 })
      return
    }

    const element = containerRef.current

    const update = () => {
      const maxWidth = Math.max(element.clientWidth - 16, 1)
      const maxHeight = Math.max(window.innerHeight - 160, 400)
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height)

      setSize({
        width: Math.max(1, Math.round(image.width * scale)),
        height: Math.max(1, Math.round(image.height * scale))
      })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [containerRef, image])

  return size
}

function getPanelAnnualEnergy(monthlyEnergyDcKwh: number[], yearlyEnergyDcKwh: number): number {
  return monthlyEnergyDcKwh.length > 0 ? annualEnergyFromMonthly(monthlyEnergyDcKwh) : yearlyEnergyDcKwh
}

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

export function WorkbenchPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedPanelIds, setSelectedPanelIds] = useState<Set<string>>(new Set())
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [marqueeMode, setMarqueeMode] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [pendingPanelId, setPendingPanelId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isBatchRecomputing, setIsBatchRecomputing] = useState(false)
  const [initialBatchStatus, setInitialBatchStatus] = useState<BatchRecomputeStatus>('idle')
  const [message, setMessage] = useState<UiMessage>(null)
  const [selectedPanelModelId, setSelectedPanelModelId] = useState(DEFAULT_PANEL_MODEL_ID)
  const selectedPanelModel = getPanelModel(selectedPanelModelId) ?? PANEL_MODELS[1]!
  const [isModelRecomputing, setIsModelRecomputing] = useState(false)
  const [stageScale, setStageScale] = useState(1)
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 })
  const [overlayMode, setOverlayMode] = useState<'rgb' | 'annual-flux' | 'dsm' | 'mask'>('rgb')
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null)
  const [overlayExpanded, setOverlayExpanded] = useState(false)
  const [showSegments, setShowSegments] = useState(false)
  const zoomSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isOverlayLoading, setIsOverlayLoading] = useState(false)
  const [irradianceMonth, setIrradianceMonth] = useState(new Date().getMonth())

  const irradianceStyle = useMemo(() => {
    const azimuth = MONTHLY_AZIMUTH[irradianceMonth] ?? 180
    const intensity = MONTHLY_IRRADIANCE[irradianceMonth] ?? 0.9
    // Position glow on the container edge: azimuth 0°=N(top), 90°=E(right), 180°=S(bottom)
    const rad = (azimuth * Math.PI) / 180
    const gx = 50 + Math.sin(rad) * 50
    const gy = 50 - Math.cos(rad) * 50
    const alpha = intensity * 0.35
    // Replace the static background-image with a directional amber glow from the sun's position
    return {
      backgroundImage: `radial-gradient(circle at ${gx.toFixed(0)}% ${gy.toFixed(0)}%, rgba(255,184,0,${alpha.toFixed(2)}) 0%, rgba(255,200,50,${(alpha * 0.3).toFixed(3)}) 25%, transparent 55%), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)`
    }
  }, [irradianceMonth])

  const {
    project,
    buildingInsights,
    imageGeoTransform,
    roofMask,
    rgbImageUrl,
    isLoading,
    error: dataError
  } = useWorkbenchData(projectId)
  const { image: backgroundImage, imageError } = useLoadedImage(rgbImageUrl)
  const { image: overlayImage } = useLoadedImage(overlayMode !== 'rgb' ? (overlayImageUrl ?? undefined) : undefined)
  const displayImage = overlayMode !== 'rgb' && overlayImage ? overlayImage : backgroundImage
  const error = dataError ?? (imageError ? new Error(imageError) : null)
  const stageSize = useStageSize(containerRef, backgroundImage)

  const geo = useMemo(() => {
    if (!imageGeoTransform || stageSize.width === 0 || stageSize.height === 0) {
      return null
    }

    return createCanvasGeo(imageGeoTransform, stageSize.width, stageSize.height)
  }, [imageGeoTransform, stageSize])

  const panelDimensions = useMemo(() => {
    if (!geo) return null
    return panelMetersToPixels(selectedPanelModel.widthM, selectedPanelModel.heightM, geo)
  }, [selectedPanelModel, geo])
  const maskGeo = useMemo(() => {
    if (!roofMask) {
      return null
    }

    return createCanvasGeo(roofMask.geoTransform, roofMask.width, roofMask.height)
  }, [roofMask])
  const maskPanelDimensions = useMemo(() => {
    if (!maskGeo) return null
    return panelMetersToPixels(selectedPanelModel.widthM, selectedPanelModel.heightM, maskGeo)
  }, [selectedPanelModel, maskGeo])
  const stageReady = stageSize.width > 0 && stageSize.height > 0 && !!geo && !!panelDimensions

  const {
    visiblePanels,
    visibleCount,
    minVisibleCount,
    maxVisibleCount,
    totalAnnualYield,
    totalCarbonOffsetKg,
    allPanelsEnergyRange,
    getPanel,
    movePanel,
    rotatePanel,
    deletePanel,
    updatePanelEnergy,
    setVisibleCount,
    serializeLayout,
    undo,
    redo,
    canUndo,
    canRedo
  } = usePanelState({
    projectId,
    locationId: project?.locationId,
    solarPanels: buildingInsights?.solarPotential.solarPanels ?? [],
    roofSegments: buildingInsights?.solarPotential.roofSegmentStats ?? [],
    editedLayout: project?.editedLayout ?? null,
    maxArrayPanelsCount: buildingInsights?.solarPotential.maxArrayPanelsCount ?? 0,
    carbonOffsetFactorKgPerMwh: buildingInsights?.solarPotential.carbonOffsetFactorKgPerMwh ?? 0,
    panelWidthM: selectedPanelModel.widthM,
    panelHeightM: selectedPanelModel.heightM,
    panelCapacityWp: selectedPanelModel.capacityWp,
    onBatchRecomputeStatusChange: setInitialBatchStatus
  })

  const selectedPanelId = selectedPanelIds.size === 1 ? [...selectedPanelIds][0]! : null
  const selectedPanel = selectedPanelId ? (getPanel(selectedPanelId) ?? null) : null

  const renderPanels = useMemo(() => {
    if (!geo) return []

    return visiblePanels.map((panel) => ({
      panel,
      ...latLngToPixel(panel.center.lat, panel.center.lng, geo)
    }))
  }, [visiblePanels, geo])

  const segmentHulls = useMemo(() => {
    if (!showSegments || !buildingInsights || !geo || !panelDimensions) return []

    const solarPanels = buildingInsights.solarPotential.solarPanels
    const roofSegments = buildingInsights.solarPotential.roofSegmentStats
    const activePanelIds = new Set(visiblePanels.map((p) => p.id))

    // Build pixel position map (with rotation) from renderPanels
    const pixelMap = new Map<string, { x: number; y: number; rotation: number }>()
    for (const { panel, x, y } of renderPanels) {
      pixelMap.set(panel.id, { x, y, rotation: panel.rotation })
    }

    return computeSegmentHulls(
      solarPanels,
      roofSegments,
      pixelMap,
      activePanelIds,
      panelDimensions.width,
      panelDimensions.height
    )
  }, [showSegments, buildingInsights, geo, panelDimensions, visiblePanels, renderPanels])

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

  useEffect(() => {
    if (visiblePanels.length === 0) {
      setSelectedPanelIds(new Set())
      return
    }
    // Clean out any selected IDs that are no longer visible
    setSelectedPanelIds((prev) => {
      const visibleIds = new Set(visiblePanels.map((p) => p.id))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      if (next.size === 0 && visiblePanels.length > 0) {
        next.add(visiblePanels[0]!.id)
      }
      // Only update if changed to avoid infinite renders
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev
      return next
    })
  }, [visiblePanels])

  useEffect(() => {
    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current)
      }
    }
  }, [])

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
          handleDeleteSelected()
        }
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (!e.repeat) setSpaceHeld(true)
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, { passive: false })
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [undo, redo, selectedPanelIds])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    console.info('[WorkbenchPage]', {
      projectId: projectId ?? null,
      hasProject: Boolean(project),
      hasBuildingInsights: Boolean(buildingInsights),
      hasImageGeoTransform: Boolean(imageGeoTransform),
      hasRgbImageUrl: Boolean(rgbImageUrl),
      hasBackgroundImage: Boolean(backgroundImage),
      stageWidth: stageSize.width,
      stageHeight: stageSize.height,
      hasPanelDimensions: Boolean(panelDimensions),
      isLoading,
      error: error instanceof Error ? error.message : null
    })
  }, [
    projectId,
    project,
    buildingInsights,
    imageGeoTransform,
    rgbImageUrl,
    backgroundImage,
    stageSize.width,
    stageSize.height,
    panelDimensions,
    isLoading,
    error
  ])

  function getPlacementAabb(
    panelId: string,
    center: { lat: number; lng: number },
    rotation: number,
    canvasGeo: CanvasGeo
  ) {
    if (!panelDimensions) return null

    const pixelCenter = latLngToPixel(center.lat, center.lng, canvasGeo)
    const points = getRotatedRectPoints(
      pixelCenter.x,
      pixelCenter.y,
      panelDimensions.width,
      panelDimensions.height,
      rotation
    )

    return getRectAabb(points)
  }

  function getPlacementError(
    panelId: string,
    center: { lat: number; lng: number },
    rotation: number,
    excludeIds?: Set<string>
  ) {
    if (!geo || !panelDimensions) return 'bounds' as const

    const proposedAabb = getPlacementAabb(panelId, center, rotation, geo)
    if (!proposedAabb) return 'bounds' as const

    if (!isAabbInsideStage(proposedAabb, stageSize.width, stageSize.height)) {
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
      const otherAabb = getPlacementAabb(otherPanel.id, otherPanel.center, otherPanel.rotation, geo)
      if (otherAabb && aabbsOverlap(proposedAabb, otherAabb)) {
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
    if (!project) return

    setPendingPanelId(panelId)
    setMessage({ tone: 'info', text: 'Recomputing panel yield from cached monthly flux data...' })

    try {
      const result = await recomputeFlux(project.locationId, {
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
      setMessage({
        tone: 'error',
        text: recomputeError instanceof Error ? recomputeError.message : 'Failed to recompute panel energy'
      })
    } finally {
      setPendingPanelId(null)
    }
  }

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

    // Single panel drag or not part of multi-selection
    if (!selectedPanelIds.has(panelId) || selectedPanelIds.size <= 1) {
      const nextCenter = pixelToLatLng(position.x, position.y, geo)
      const placementError = getPlacementError(panelId, nextCenter, panel.rotation)
      if (placementError) {
        resetPosition()
        setMessage({ tone: 'error', text: getPlacementErrorMessage(placementError) })
        return
      }

      const previousCenter = panel.center
      movePanel(panelId, nextCenter)
      await recomputePanel(panelId, nextCenter, panel.rotation, () => {
        movePanel(panelId, previousCenter)
        resetPosition()
      })
      return
    }

    // Group drag
    const origPixel = latLngToPixel(panel.center.lat, panel.center.lng, geo)
    const deltaX = position.x - origPixel.x
    const deltaY = position.y - origPixel.y

    const selectedPanels = [...selectedPanelIds]
      .map((id) => getPanel(id))
      .filter((p): p is NonNullable<typeof p> => p != null)

    // Validate all new positions
    const moves: { id: string; prevCenter: { lat: number; lng: number }; nextCenter: { lat: number; lng: number } }[] =
      []

    for (const sp of selectedPanels) {
      const spPixel = latLngToPixel(sp.center.lat, sp.center.lng, geo)
      const newPixel = { x: spPixel.x + deltaX, y: spPixel.y + deltaY }
      const nextCenter = pixelToLatLng(newPixel.x, newPixel.y, geo)

      const placementError = getPlacementError(sp.id, nextCenter, sp.rotation, selectedPanelIds)
      if (placementError) {
        resetPosition()
        setMessage({ tone: 'error', text: `Group move failed: ${getPlacementErrorMessage(placementError)}` })
        return
      }
      moves.push({ id: sp.id, prevCenter: sp.center, nextCenter })
    }

    // Apply all moves
    for (const mv of moves) {
      movePanel(mv.id, mv.nextCenter)
    }

    // Batch recompute
    if (!project) return
    setPendingPanelId(panelId)
    setMessage({ tone: 'info', text: `Recomputing yield for ${moves.length} panels...` })

    try {
      const batchResponse = await recomputeFluxBatch(project.locationId, {
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
      // Rollback all
      for (const mv of moves) {
        movePanel(mv.id, mv.prevCenter)
      }
      resetPosition()
      setMessage({ tone: 'error', text: 'Failed to recompute group move. Positions reverted.' })
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
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
    }

    rotationTimeoutRef.current = setTimeout(() => {
      void recomputePanel(panelId, center, rotation, () => rotatePanel(panelId, previousRotation))
    }, 1000)
  }

  function handleRotationInput(value: number) {
    const nextRotation = ((value % 360) + 360) % 360

    if (selectedPanelIds.size > 1) {
      // Group rotate: apply same absolute rotation to all selected
      for (const id of selectedPanelIds) {
        const p = getPanel(id)
        if (!p) continue
        const placementError = getPlacementError(p.id, p.center, nextRotation)
        if (placementError) {
          setMessage({ tone: 'error', text: getPlacementErrorMessage(placementError) })
          return
        }
      }
      for (const id of selectedPanelIds) {
        rotatePanel(id, nextRotation)
      }
      // Schedule batch recompute for all selected
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
      rotationTimeoutRef.current = setTimeout(() => {
        if (!project) return
        const panels = [...selectedPanelIds]
          .map((id) => getPanel(id))
          .filter((p): p is NonNullable<typeof p> => p != null)
        void recomputeFluxBatch(project.locationId, {
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

    // Single panel rotation
    if (!selectedPanel) return

    const placementError = getPlacementError(selectedPanel.id, selectedPanel.center, nextRotation)
    if (placementError) {
      setMessage({ tone: 'error', text: getPlacementErrorMessage(placementError) })
      return
    }

    const previousRotation = selectedPanel.rotation
    rotatePanel(selectedPanel.id, nextRotation)
    scheduleRotationRecompute(selectedPanel.id, selectedPanel.center, nextRotation, previousRotation)
  }

  function handleDeleteSelected() {
    if (selectedPanelIds.size === 0) return

    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
    }

    for (const id of selectedPanelIds) {
      deletePanel(id)
    }
    setSelectedPanelIds(new Set())
    setMessage(null)
  }

  useEffect(() => {
    if (overlayMode === 'rgb' || !project?.locationId) {
      setOverlayImageUrl(null)
      return
    }
    let cancelled = false
    setIsOverlayLoading(true)
    getOverlayUrl(project.locationId, overlayMode)
      .then((data) => {
        if (!cancelled) setOverlayImageUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) {
          setOverlayImageUrl(null)
          setMessage({ tone: 'error', text: `Failed to load ${overlayMode} overlay` })
        }
      })
      .finally(() => {
        if (!cancelled) setIsOverlayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [overlayMode, project?.locationId])

  // Auto zoom-back to 1:1 when zoomed out below 100%, with 3s debounce
  useEffect(() => {
    if (zoomSnapTimerRef.current) {
      clearTimeout(zoomSnapTimerRef.current)
      zoomSnapTimerRef.current = null
    }
    if (stageScale >= 1) return

    zoomSnapTimerRef.current = setTimeout(() => {
      // 1s debounce before snapping back to 1:1
      const duration = 300
      const startScale = stageScale
      const startPos = { ...stagePosition }
      const startTime = performance.now()

      function animate(now: number) {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / duration)
        const ease = t * (2 - t) // ease-out
        const nextScale = startScale + (1 - startScale) * ease
        const nextX = startPos.x * (1 - ease)
        const nextY = startPos.y * (1 - ease)
        setStageScale(nextScale)
        setStagePosition({ x: nextX, y: nextY })
        if (t < 1) requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }, 1000)

    return () => {
      if (zoomSnapTimerRef.current) clearTimeout(zoomSnapTimerRef.current)
    }
  }, [stageScale, stagePosition])

  async function handleModelChange(nextModelId: string) {
    const prevModelId = selectedPanelModelId
    setSelectedPanelModelId(nextModelId)

    if (!project || visiblePanels.length === 0) return

    setIsModelRecomputing(true)
    setMessage({ tone: 'info', text: 'Recalculating energy for new panel dimensions...' })

    const nextModel = getPanelModel(nextModelId) ?? PANEL_MODELS[1]!

    try {
      const batchResponse = await recomputeFluxBatch(project.locationId, {
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
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Failed to recalculate energy. Reverted panel model.'
      })
    } finally {
      setIsModelRecomputing(false)
    }
  }

  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = e.target.getStage()
      const pointer = stage?.getPointerPosition()
      if (!pointer) return

      const direction = e.evt.deltaY > 0 ? -1 : 1
      const factor = 1.1
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stageScale * Math.pow(factor, direction)))

      const mousePointTo = {
        x: (pointer.x - stagePosition.x) / stageScale,
        y: (pointer.y - stagePosition.y) / stageScale
      }

      setStageScale(newScale)
      setStagePosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
      })
    },
    [stageScale, stagePosition]
  )

  function handleZoomIn() {
    const newScale = Math.min(MAX_ZOOM, stageScale * 1.25)
    const cx = stageSize.width / 2
    const cy = stageSize.height / 2
    const mousePointTo = { x: (cx - stagePosition.x) / stageScale, y: (cy - stagePosition.y) / stageScale }
    setStageScale(newScale)
    setStagePosition({ x: cx - mousePointTo.x * newScale, y: cy - mousePointTo.y * newScale })
  }

  function handleZoomOut() {
    const newScale = Math.max(MIN_ZOOM, stageScale / 1.25)
    const cx = stageSize.width / 2
    const cy = stageSize.height / 2
    const mousePointTo = { x: (cx - stagePosition.x) / stageScale, y: (cy - stagePosition.y) / stageScale }
    setStageScale(newScale)
    setStagePosition({ x: cx - mousePointTo.x * newScale, y: cy - mousePointTo.y * newScale })
  }

  function handleZoomReset() {
    setStageScale(1)
    setStagePosition({ x: 0, y: 0 })
  }

  async function handleSave() {
    if (!projectId || !project) return

    setIsSaving(true)
    setIsBatchRecomputing(true)
    setMessage(null)

    try {
      const serializedLayout = serializeLayout()
      const activePanels = serializedLayout.filter((panel) => panel.status !== 'deleted')

      setMessage({
        tone: 'info',
        text: `Recomputing monthly energy for ${activePanels.length} active panels before saving...`
      })

      const batchResponse = await recomputeFluxBatch(project.locationId, {
        panels: activePanels.map((panel) => ({
          panelId: panel.id,
          center: panel.center,
          rotation: panel.rotation,
          widthM: selectedPanelModel.widthM,
          heightM: selectedPanelModel.heightM,
          capacityWp: selectedPanelModel.capacityWp
        }))
      })

      const energyByPanelId = new Map(
        batchResponse.results.map((result) => [result.panelId, result.monthlyEnergyDcKwh] as const)
      )
      const incompletePanels = activePanels.filter((panel) => {
        const monthlyEnergyDcKwh = energyByPanelId.get(panel.id)
        return !monthlyEnergyDcKwh || monthlyEnergyDcKwh.length !== 12
      })

      if (incompletePanels.length > 0) {
        throw new Error(
          `Batch recompute returned incomplete results for ${incompletePanels.length} panel(s). Please retry.`
        )
      }

      const nextLayout = serializedLayout.map((panel) => {
        const monthlyEnergyDcKwh = energyByPanelId.get(panel.id)
        return monthlyEnergyDcKwh ? { ...panel, monthlyEnergyDcKwh } : panel
      })

      setIsBatchRecomputing(false)
      setMessage({ tone: 'info', text: 'Saving the refreshed layout to your project...' })
      const updatedProject = await saveLayout(projectId, { editedLayout: nextLayout, selectedPanelModelId })
      queryClient.setQueryData(['project', projectId], updatedProject)
      navigate(`/project/${projectId}/analysis`)
    } catch (saveError) {
      setMessage({
        tone: 'error',
        text:
          saveError instanceof Error
            ? saveError.message
            : 'Failed to recompute and save the current layout. Please retry.'
      })
    } finally {
      setIsBatchRecomputing(false)
      setIsSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Workbench Unavailable</CardTitle>
            <CardDescription>We couldn&apos;t load the project layout data for this rooftop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !project || !buildingInsights || !backgroundImage) {
    return (
      <LoadingOverlay
        hints={[
          'Loading your rooftop image...',
          'Mapping solar panels to your roof...',
          'Preparing the layout workbench...'
        ]}
      />
    )
  }

  const selectedAnnualEnergy = selectedPanel
    ? getPanelAnnualEnergy(selectedPanel.monthlyEnergyDcKwh, selectedPanel.yearlyEnergyDcKwh)
    : null

  return (
    <div className="h-screen overflow-hidden bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)]">
      <GuidedTour storageKey="slg-tour-workbench" steps={WORKBENCH_TOUR_STEPS} />
      <div className="pointer-events-none fixed inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-between px-4">
        <Link
          to={`/project/${projectId}/map?view=readonly`}
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-md backdrop-blur transition-all active:scale-95 hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Map
        </Link>
        <Link
          to={`/project/${projectId}/analysis`}
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-md backdrop-blur transition-all active:scale-95 hover:bg-stone-50"
        >
          Analysis
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 overflow-y-auto px-4 py-4 xl:flex-row">
        <aside className="xl:w-[22rem] xl:min-w-[22rem]">
          <Card className="border-stone-200 bg-white/90 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <CardDescription>Adjust the suggested layout before moving to financial analysis.</CardDescription>
                </div>
                {/* Badge removed — not needed for user-facing UI */}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">
                    Annual Yield
                    <InfoTooltip text="Total estimated electricity your panels will generate in a year." />
                  </p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(totalAnnualYield)} kWh</p>
                </div>
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">
                    CO₂ Offset
                    <InfoTooltip
                      text={`Estimated using a factor of ${buildingInsights.solarPotential.carbonOffsetFactorKgPerMwh} kg/MWh based on the grid emission factor for this region.`}
                    />
                  </p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(totalCarbonOffsetKg)} kg</p>
                </div>
              </div>
              <details className="rounded-lg border border-stone-200 bg-stone-50/80 text-sm">
                <summary className="cursor-pointer px-3 py-2 font-medium text-stone-700 select-none">
                  Panel Specifications
                </summary>
                <div className="space-y-1 border-t border-stone-200 px-3 py-2 text-stone-600">
                  <p>
                    Dimensions: {selectedPanelModel.heightM} &times; {selectedPanelModel.widthM} m
                  </p>
                  <p>Capacity: {selectedPanelModel.capacityWp} Wp</p>
                  <p>Efficiency: {(selectedPanelModel.efficiency * 100).toFixed(1)}%</p>
                  {selectedPanelModel.costPerWp > 0 && <p>Cost: RM {selectedPanelModel.costPerWp.toFixed(2)} / Wp</p>}
                  <p>Max panels (API): {buildingInsights.solarPotential.maxArrayPanelsCount}</p>
                  {buildingInsights.solarPotential.panelLifetimeYears != null && (
                    <p>Lifespan: {buildingInsights.solarPotential.panelLifetimeYears} years</p>
                  )}
                </div>
              </details>
            </CardHeader>
            <CardContent className="space-y-6">
              {initialBatchStatus === 'loading' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Computing monthly energy data for all panels...
                </div>
              )}

              {initialBatchStatus === 'error' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Could not compute monthly energy breakdown. Annual estimates will be used instead.
                </div>
              )}

              {message && (
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm',
                    message.tone === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  )}
                >
                  {message.text}
                </div>
              )}

              <div data-tour="panel-count" className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    Panel Quantity
                    <InfoTooltip text="Adjust how many panels to include. Higher-yield panels are kept first when you reduce the count." />
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {visiblePanels.length} / {maxVisibleCount}
                  </span>
                </div>
                <Slider
                  value={[visibleCount]}
                  min={minVisibleCount}
                  max={Math.max(minVisibleCount, maxVisibleCount)}
                  step={1}
                  onValueChange={(value) => {
                    const nextValue = value[0]
                    if (typeof nextValue === 'number') {
                      setVisibleCount(nextValue)
                    }
                  }}
                  disabled={maxVisibleCount <= minVisibleCount}
                />
                <p className="text-xs text-muted-foreground">
                  Higher-yield panels are kept visible first. Lowering the slider removes lower-ranked panels from the
                  saved layout.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                <div className="flex items-center justify-between">
                  <Label>
                    Selected Panel
                    <InfoTooltip text="Click any panel on the canvas to select it. Hold Shift to select multiple. You can then rotate or delete them." />
                  </Label>
                  <span className="text-sm font-medium">
                    {selectedPanelIds.size > 1 ? `${selectedPanelIds.size} panels` : (selectedPanel?.id ?? 'None')}
                  </span>
                </div>

                {selectedPanelIds.size > 1 ? (
                  <div className="text-sm text-stone-600">
                    <p className="font-medium">{selectedPanelIds.size} panels selected</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Use the rotation slider to rotate all selected panels. Press Delete to remove them.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-stone-500">Annual Yield</p>
                      <p className="text-sm font-semibold">
                        {selectedAnnualEnergy !== null ? `${formatNumber(selectedAnnualEnergy)} kWh` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">Rotation</p>
                      <p className="text-sm font-semibold">
                        {selectedPanel ? `${Math.round(selectedPanel.rotation)}°` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">
                        Avg Monthly Yield
                        <InfoTooltip
                          text={
                            selectedPanel && selectedPanel.monthlyEnergyDcKwh.length > 0
                              ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                                  .map(
                                    (month, i) =>
                                      `${month}: ${formatNumber(selectedPanel.monthlyEnergyDcKwh[i] ?? 0)} kWh`
                                  )
                                  .join('\n')
                              : 'Monthly data not yet computed'
                          }
                        />
                      </p>
                      <p className="text-sm font-semibold">
                        {selectedPanel && selectedPanel.monthlyEnergyDcKwh.length > 0
                          ? `${formatNumber(selectedAnnualEnergy! / 12)} kWh`
                          : '—'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Rotate {selectedPanelIds.size > 1 ? 'Panels' : 'Panel'}
                      <InfoTooltip text="Drag to set rotation angle (0–359°). The panel's energy yield is recomputed after each change." />
                    </Label>
                    <span className="text-sm font-medium">
                      {selectedPanel ? `${Math.round(selectedPanel.rotation)}°` : '—'}
                    </span>
                  </div>
                  <Slider
                    value={[selectedPanel?.rotation ?? 0]}
                    min={0}
                    max={359}
                    step={5}
                    disabled={
                      selectedPanelIds.size === 0 || (selectedPanel != null && pendingPanelId === selectedPanel.id)
                    }
                    onValueChange={(value) => {
                      const nextValue = value[0]
                      if (typeof nextValue === 'number') {
                        handleRotationInput(nextValue)
                      }
                    }}
                  />
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={
                    selectedPanelIds.size === 0 || (selectedPanel != null && pendingPanelId === selectedPanel.id)
                  }
                  onClick={handleDeleteSelected}
                >
                  {selectedPanelIds.size > 1 ? `Delete ${selectedPanelIds.size} Panels` : 'Delete Selected Panel'}
                </Button>
              </div>

              <div className="grid gap-2">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
                <Button
                  data-tour="save-continue"
                  className="w-full"
                  onClick={handleSave}
                  disabled={isSaving || pendingPanelId !== null}
                >
                  {isBatchRecomputing ? 'Recomputing Layout...' : isSaving ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex-1">
          <Card data-tour="canvas" className="overflow-hidden border-stone-200 bg-white/90 shadow-sm">
            <CardHeader className="border-b border-stone-200 bg-stone-50/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle data-tour="canvas-title">
                    Roof Layout Workbench
                    <InfoTooltip text="Use the slider to add or remove panels. Click a panel on the canvas to select it, then rotate or delete it." />
                  </CardTitle>
                </div>
                {(pendingPanelId || isBatchRecomputing || initialBatchStatus === 'loading') && (
                  <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                    {isBatchRecomputing
                      ? 'Batch Recompute'
                      : initialBatchStatus === 'loading'
                        ? 'Computing Monthly Data'
                        : 'Recomputing'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div
                ref={containerRef}
                className="relative flex min-h-[50vh] items-center justify-center rounded-2xl border border-dashed border-stone-300 p-2"
                style={irradianceStyle}
              >
                {stageReady && panelDimensions ? (
                  <>
                    <Stage
                      width={stageSize.width}
                      height={stageSize.height}
                      scaleX={stageScale}
                      scaleY={stageScale}
                      x={stagePosition.x}
                      y={stagePosition.y}
                      draggable={(stageScale > 1 && !marqueeMode) || spaceHeld}
                      style={{ cursor: spaceHeld ? 'grab' : undefined }}
                      onWheel={handleWheel}
                      className="overflow-hidden rounded-xl shadow-lg"
                      onClick={(e) => {
                        if (spaceHeld) return
                        if (e.target === e.target.getStage()) {
                          setSelectedPanelIds(new Set())
                        }
                      }}
                      onMouseDown={(e) => {
                        if (!marqueeMode || spaceHeld) return
                        if (e.target !== e.target.getStage()) return
                        const stage = e.target.getStage()
                        if (!stage) return
                        const pos = stage.getPointerPosition()
                        if (!pos) return
                        const sx = stage.scaleX()
                        const stagePos = {
                          x: (pos.x - stage.x()) / sx,
                          y: (pos.y - stage.y()) / sx
                        }
                        marqueeStartRef.current = stagePos
                        setMarqueeRect({ x: stagePos.x, y: stagePos.y, width: 0, height: 0 })
                      }}
                      onMouseMove={(e) => {
                        if (!marqueeStartRef.current || !marqueeRect) return
                        const stage = e.target.getStage()
                        if (!stage) return
                        const pos = stage.getPointerPosition()
                        if (!pos) return
                        const sx = stage.scaleX()
                        const stagePos = {
                          x: (pos.x - stage.x()) / sx,
                          y: (pos.y - stage.y()) / sx
                        }
                        const start = marqueeStartRef.current
                        setMarqueeRect({
                          x: Math.min(start.x, stagePos.x),
                          y: Math.min(start.y, stagePos.y),
                          width: Math.abs(stagePos.x - start.x),
                          height: Math.abs(stagePos.y - start.y)
                        })
                      }}
                      onMouseUp={() => {
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
                      }}
                    >
                      <Layer listening={false}>
                        <KonvaImage
                          image={displayImage ?? undefined}
                          width={stageSize.width}
                          height={stageSize.height}
                        />
                      </Layer>
                      {showSegments && segmentHulls.length > 0 && (
                        <Layer listening={false}>
                          {segmentHulls.map((hull) => (
                            <KonvaLine
                              key={`seg-${hull.segmentIndex}`}
                              points={hull.hullPoints.flatMap((p) => [p.x, p.y])}
                              closed
                              fill={hull.color}
                              stroke={hull.color.replace('0.35)', '0.7)')}
                              strokeWidth={1.5}
                              listening={false}
                            />
                          ))}
                        </Layer>
                      )}
                      <PanelLayer
                        panels={renderPanels}
                        panelWidth={panelDimensions.width}
                        panelHeight={panelDimensions.height}
                        selectedPanelIds={selectedPanelIds}
                        stageWidth={stageSize.width}
                        stageHeight={stageSize.height}
                        disabledPanelId={pendingPanelId}
                        energyMin={allPanelsEnergyRange.min}
                        energyMax={allPanelsEnergyRange.max}
                        snapEnabled={snapEnabled}
                        onSnapDragMove={handleSnapDragMove}
                        onSelect={handlePanelSelect}
                        onDragEnd={handlePanelDragEnd}
                      />
                      {snapGuides.length > 0 && (
                        <Layer listening={false}>
                          {snapGuides.map((guide, i) => (
                            <KonvaLine
                              key={i}
                              points={
                                guide.orientation === 'vertical'
                                  ? [guide.position, guide.start, guide.position, guide.end]
                                  : [guide.start, guide.position, guide.end, guide.position]
                              }
                              stroke="#22d3ee"
                              strokeWidth={1}
                              dash={[4, 4]}
                              listening={false}
                            />
                          ))}
                        </Layer>
                      )}
                      {marqueeRect && (
                        <Layer>
                          <KonvaRect
                            x={marqueeRect.x}
                            y={marqueeRect.y}
                            width={marqueeRect.width}
                            height={marqueeRect.height}
                            stroke="#22d3ee"
                            strokeWidth={1}
                            dash={[6, 4]}
                            fill="rgba(34, 211, 238, 0.1)"
                            listening={false}
                          />
                        </Layer>
                      )}
                    </Stage>

                    {/* Canvas controls */}
                    <div data-tour="canvas-controls" className="absolute right-4 top-4 flex flex-col gap-1">
                      {/* Tools group */}
                      <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 text-center">
                        Tools
                      </span>
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 7v6h6" />
                          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                        </svg>
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Undo
                        </span>
                      </button>
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 7v6h-6" />
                          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                        </svg>
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Redo
                        </span>
                      </button>
                      <button
                        onClick={() => setMarqueeMode((v) => !v)}
                        className={cn(
                          'group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white active:scale-90',
                          marqueeMode && 'ring-1 ring-cyan-400 bg-cyan-50'
                        )}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 3h2" />
                          <path d="M9 3h2" />
                          <path d="M13 3h2" />
                          <path d="M17 3h2" />
                          <path d="M21 5v2" />
                          <path d="M21 9v2" />
                          <path d="M21 13v2" />
                          <path d="M21 17v2" />
                          <path d="M19 21h-2" />
                          <path d="M15 21h-2" />
                          <path d="M11 21h-2" />
                          <path d="M7 21h-2" />
                          <path d="M3 19v-2" />
                          <path d="M3 15v-2" />
                          <path d="M3 11v-2" />
                          <path d="M3 7v-2" />
                        </svg>
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {marqueeMode ? 'Marquee: ON' : 'Marquee'}
                        </span>
                      </button>
                      <button
                        onClick={() => setSnapEnabled((v) => !v)}
                        className={cn(
                          'group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white active:scale-90',
                          snapEnabled && 'ring-1 ring-cyan-400 bg-cyan-50'
                        )}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 15V9a6 6 0 0 1 12 0v6" />
                          <path d="M6 9h4" />
                          <path d="M14 9h4" />
                          <path d="M6 15h4" />
                          <path d="M14 15h4" />
                        </svg>
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {snapEnabled ? 'Snap: ON' : 'Snap'}
                        </span>
                      </button>
                      <div className="my-1 border-t border-stone-200" />
                      {/* View group */}
                      <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 text-center">
                        View
                      </span>
                      <button
                        onClick={handleZoomIn}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm font-bold shadow-md transition-transform hover:bg-white active:scale-90"
                      >
                        +
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Zoom in
                        </span>
                      </button>
                      <button
                        onClick={handleZoomOut}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm font-bold shadow-md transition-transform hover:bg-white active:scale-90"
                      >
                        −
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Zoom out
                        </span>
                      </button>
                      <button
                        onClick={handleZoomReset}
                        className="group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-xs font-medium shadow-md transition-transform hover:bg-white active:scale-90"
                      >
                        1:1
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Reset zoom
                        </span>
                      </button>
                      {stageScale !== 1 && (
                        <span className="mt-1 text-center text-xs text-stone-500">{Math.round(stageScale * 100)}%</span>
                      )}
                      <div className="my-1 border-t border-stone-200" />
                      {/* Layers group */}
                      <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400 text-center">
                        Layers
                      </span>
                      <button
                        onClick={() => setOverlayExpanded((v) => !v)}
                        className={cn(
                          'group relative flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white active:scale-90',
                          overlayExpanded && 'ring-1 ring-stone-400'
                        )}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {overlayExpanded ? 'Hide overlays' : 'Overlays'}
                        </span>
                      </button>
                      <div
                        className={cn(
                          'mt-1 flex flex-col gap-1 overflow-hidden transition-all duration-200',
                          overlayExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        )}
                      >
                        <button
                          onClick={() => setOverlayMode('rgb')}
                          className={cn(
                            'group relative h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
                            overlayMode === 'rgb' ? 'ring-1 ring-stone-900 ring-offset-1' : ''
                          )}
                          style={{ background: 'linear-gradient(135deg, #a7f3d0, #93c5fd, #c4b5fd, #fda4af)' }}
                          title="RGB"
                        >
                          <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            RGB
                          </span>
                        </button>
                        <button
                          onClick={() => setOverlayMode('annual-flux')}
                          className={cn(
                            'group relative h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
                            overlayMode === 'annual-flux' ? 'ring-1 ring-stone-900 ring-offset-1' : ''
                          )}
                          style={{
                            background: 'linear-gradient(135deg, #1e1b4b, #7e22ce, #f472b6, #fde68a, #fefce8)'
                          }}
                          title="Annual Flux"
                        >
                          <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Flux
                          </span>
                        </button>
                        <button
                          onClick={() => setOverlayMode('dsm')}
                          className={cn(
                            'group relative h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
                            overlayMode === 'dsm' ? 'ring-1 ring-stone-900 ring-offset-1' : ''
                          )}
                          style={{
                            background: 'linear-gradient(135deg, #bfdbfe, #a5f3fc, #bbf7d0, #fef08a, #fecaca)'
                          }}
                          title="DSM"
                        >
                          <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            DSM
                          </span>
                        </button>
                        <button
                          onClick={() => setOverlayMode('mask')}
                          className={cn(
                            'group relative h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
                            overlayMode === 'mask' ? 'ring-1 ring-stone-900 ring-offset-1' : ''
                          )}
                          style={{
                            background: 'linear-gradient(135deg, #064e3b, #059669, #34d399, #d1fae5)'
                          }}
                          title="Mask"
                        >
                          <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Mask
                          </span>
                        </button>
                        <button
                          onClick={() => setShowSegments((v) => !v)}
                          className={cn(
                            'group relative h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
                            showSegments ? 'ring-1 ring-stone-900 ring-offset-1' : ''
                          )}
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b, #06b6d4, #8b5cf6, #ef4444)'
                          }}
                          title="Segments"
                        >
                          <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Segments
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Loading overlays */}
                    {isOverlayLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[1px]">
                        <div className="flex items-center gap-3 rounded-lg bg-white/90 px-5 py-3 text-sm font-medium shadow-lg">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
                          Loading overlay...
                        </div>
                      </div>
                    )}
                    {isModelRecomputing && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[1px]">
                        <div className="flex items-center gap-3 rounded-lg bg-white/90 px-5 py-3 text-sm font-medium shadow-lg">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
                          Recalculating energy for new panel dimensions...
                        </div>
                      </div>
                    )}

                    {/* Bottom-left legends */}
                    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
                      {showSegments && segmentHulls.length > 0 && (
                        <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
                          <p className="mb-1 font-medium">Roof Segments</p>
                          {segmentHulls.map((hull) => (
                            <p key={hull.segmentIndex} className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: hull.color.replace('0.35)', '1)') }}
                              />
                              Seg {hull.segmentIndex + 1}: {hull.azimuth.toFixed(0)}° / {hull.pitch.toFixed(0)}° (
                              {hull.panelCount} panels)
                            </p>
                          ))}
                        </div>
                      )}
                      {overlayMode !== 'rgb' && !isOverlayLoading && (
                        <div className="rounded-lg bg-black/60 px-2.5 py-2 backdrop-blur-sm">
                          {overlayMode === 'mask' ? (
                            <div className="flex flex-col items-start gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="h-3 w-3 rounded-sm bg-green-500/60" />
                                <span className="text-[9px] font-medium text-white/90">Roof</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="h-3 w-3 rounded-sm bg-black/40 ring-1 ring-white/20" />
                                <span className="text-[9px] font-medium text-white/90">Off-roof</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-medium text-white/90">
                                {overlayMode === 'annual-flux' ? 'Sunny' : 'High'}
                              </span>
                              <div
                                className="w-3 rounded-sm"
                                style={{
                                  height: '120px',
                                  background:
                                    overlayMode === 'annual-flux'
                                      ? 'linear-gradient(to bottom, #ffffff, #fadc32, #dc1e1e, #800080, #000000)'
                                      : 'linear-gradient(to bottom, #dc0000, #f0f000, #00c800, #00b4dc, #0000b4)'
                                }}
                              />
                              <span className="text-[9px] font-medium text-white/90">
                                {overlayMode === 'annual-flux' ? 'Shady' : 'Low'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
                    Preparing the canvas...
                  </div>
                )}
              </div>

              {/* Irradiance month slider */}
              <div className="mt-3 flex items-center gap-3">
                <span className="w-8 text-xs font-medium text-amber-600">{MONTH_LABELS[irradianceMonth]}</span>
                <Slider
                  value={[irradianceMonth]}
                  min={0}
                  max={11}
                  step={1}
                  onValueChange={(v) => {
                    if (typeof v[0] === 'number') setIrradianceMonth(v[0])
                  }}
                  className="flex-1"
                />
                <span className="w-32 text-right text-[11px] text-stone-400">
                  ☀️ {MONTHLY_AZIMUTH[irradianceMonth]}°{' '}
                  {(() => {
                    const a = MONTHLY_AZIMUTH[irradianceMonth] ?? 180
                    if (a >= 337.5 || a < 22.5) return 'N'
                    if (a < 67.5) return 'NE'
                    if (a < 112.5) return 'E'
                    if (a < 157.5) return 'SE'
                    if (a < 202.5) return 'S'
                    if (a < 247.5) return 'SW'
                    if (a < 292.5) return 'W'
                    return 'NW'
                  })()}
                </span>
              </div>

              {/* Panel model selector — rendered as fixed element below */}
              <div data-tour="panel-model" className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
                <PanelModelDrawer
                  selectedModelId={selectedPanelModelId}
                  onSelect={handleModelChange}
                  disabled={isModelRecomputing || isSaving}
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
