import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Image as KonvaImage, Layer, Line as KonvaLine, Rect as KonvaRect, Stage } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { recomputeFlux, recomputeFluxBatch, getOverlayUrl } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { MONTHLY_AZIMUTH, MONTH_LABELS } from '@/components/workbench/IrradianceGlow'
import { PanelLayer } from '@/components/workbench/PanelLayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { usePanelState, type BatchRecomputeStatus } from '@/hooks/usePanelState'
import { useWorkbenchData } from '@/hooks/useWorkbenchData'
import { useWorkbenchKeyboard } from '@/hooks/useWorkbenchKeyboard'
import { useIrradiance } from '@/hooks/useIrradiance'
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
import { COLORS } from '@/lib/constants'
import { AppLayout } from '@/components/AppLayout'
import { InfoTooltip } from '@/components/InfoTooltip'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { GuidedTour, type TourStep } from '@/components/GuidedTour'
import { notify } from '@/components/ui/toast-config'
import { CanvasControls } from '@/components/workbench/CanvasControls'
import { WorkbenchSidebar } from '@/components/workbench/WorkbenchSidebar'
import { computeSegmentHulls } from '@/lib/segmentVisualization'
import { computeSnap, type SnapGuide } from '@/lib/snapAlignment'
import { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from '@shared/types'

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
    title: 'Arrange Your Panels',
    description:
      'Click a panel to select it. Drag to reposition, use the sidebar slider to rotate, or press Delete to remove. Hold spacebar to pan around while keeping your current selection.',
    placement: 'center' as const
  },
  {
    target: '[data-tour="canvas-controls"]',
    title: 'Canvas Controls',
    description:
      'Undo/redo your edits, use the marquee tool to drag-select groups of panels, toggle snap alignment for precise placement, zoom in/out, and switch overlay views.',
    placement: 'left' as const
  },
  {
    target: '[data-tour="save-continue"]',
    title: 'Save & Continue',
    description:
      'Happy with the layout? Click "Save & Continue" to save your arrangement and move to the savings analysis page. You can always come back to adjust later.'
  }
]

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
      const maxWidth = Math.max(element.clientWidth - 64, 1)
      const maxHeight = Math.max(window.innerHeight - 280, 200)
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
  const [canvasExpanded, setCanvasExpanded] = useState(false)
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

  const { irradianceMonth, setIrradianceMonth, irradianceStyle } = useIrradiance()

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
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current)
      }
    }
  }, [])

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

  useWorkbenchKeyboard({
    undo,
    redo,
    selectedPanelIds,
    onDeleteSelected: handleDeleteSelected,
    onSpaceDown: () => setSpaceHeld(true),
    onSpaceUp: () => setSpaceHeld(false)
  })

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
    notify.info('Recomputing panel yield from cached monthly flux data...')

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

    for (const mv of moves) {
      movePanel(mv.id, mv.nextCenter)
    }

    if (!project) return
    setPendingPanelId(panelId)
    notify.info(`Recomputing yield for ${moves.length} panels...`)

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

  function handleCanvasRotate(panelId: string, value: number) {
    // Select the panel if not already selected
    if (!selectedPanelIds.has(panelId)) {
      setSelectedPanelIds(new Set([panelId]))
    }
    handleRotationInput(value)
  }

  function handleRotationInput(value: number) {
    const nextRotation = ((value % 360) + 360) % 360

    if (selectedPanelIds.size > 1) {
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
      const duration = 300
      const startScale = stageScale
      const startPos = { ...stagePosition }
      const startTime = performance.now()

      function animate(now: number) {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / duration)
        const ease = t * (2 - t)
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
    notify.info('Recalculating energy for new panel dimensions...')

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

      notify.info(`Recomputing monthly energy for ${activePanels.length} active panels before saving...`)

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
      notify.info('Saving the refreshed layout to your project...')
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
            <Button asChild variant="outline" size="sm" className="w-full justify-center gap-2">
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
    <AppLayout>
      <GuidedTour storageKey="slg-tour-workbench" steps={WORKBENCH_TOUR_STEPS} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 xl:h-[calc(100vh-3.5rem)] xl:flex-row">
        <WorkbenchSidebar
          projectName={project.name}
          totalAnnualYield={totalAnnualYield}
          totalCarbonOffsetKg={totalCarbonOffsetKg}
          carbonOffsetFactorKgPerMwh={buildingInsights.solarPotential.carbonOffsetFactorKgPerMwh}
          maxArrayPanelsCount={buildingInsights.solarPotential.maxArrayPanelsCount}
          panelLifetimeYears={buildingInsights.solarPotential.panelLifetimeYears ?? undefined}
          selectedPanelModelId={selectedPanelModelId}
          selectedPanelModel={selectedPanelModel}
          onModelChange={handleModelChange}
          isModelRecomputing={isModelRecomputing}
          isSaving={isSaving}
          isBatchRecomputing={isBatchRecomputing}
          initialBatchStatus={initialBatchStatus}
          message={message}
          visiblePanelCount={visiblePanels.length}
          visibleCount={visibleCount}
          minVisibleCount={minVisibleCount}
          maxVisibleCount={maxVisibleCount}
          onVisibleCountChange={setVisibleCount}
          selectedPanelIds={selectedPanelIds}
          selectedPanel={selectedPanel}
          selectedAnnualEnergy={selectedAnnualEnergy}
          pendingPanelId={pendingPanelId}
          onSave={handleSave}
        />

        <section
          className={
            canvasExpanded ? 'fixed inset-0 z-[70] flex flex-col bg-background p-4' : 'flex min-w-0 flex-1 flex-col'
          }
        >
          <Card data-tour="canvas" className="flex flex-1 flex-col overflow-hidden border-border bg-card/90 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle data-tour="canvas-title">
                    Roof Layout Workbench
                    <InfoTooltip text="Use the slider to add or remove panels. Click a panel on the canvas to select it, then rotate or delete it. Hold spacebar to pan the view" />
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
            <CardContent className="flex flex-1 flex-col overflow-hidden p-4">
              <div
                ref={containerRef}
                className="relative flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border p-8"
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
                        onRotate={handleCanvasRotate}
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
                              stroke={COLORS.selectionCyan}
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
                            stroke={COLORS.selectionCyan}
                            strokeWidth={1}
                            dash={[6, 4]}
                            fill="rgba(34, 211, 238, 0.1)"
                            listening={false}
                          />
                        </Layer>
                      )}
                    </Stage>

                    <CanvasControls
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={undo}
                      onRedo={redo}
                      marqueeMode={marqueeMode}
                      onToggleMarquee={() => setMarqueeMode((v) => !v)}
                      snapEnabled={snapEnabled}
                      onToggleSnap={() => setSnapEnabled((v) => !v)}
                      stageScale={stageScale}
                      onZoomIn={handleZoomIn}
                      onZoomOut={handleZoomOut}
                      onZoomReset={handleZoomReset}
                      overlayExpanded={overlayExpanded}
                      onToggleOverlayExpanded={() => setOverlayExpanded((v) => !v)}
                      overlayMode={overlayMode}
                      onOverlayModeChange={setOverlayMode}
                      showSegments={showSegments}
                      onToggleSegments={() => setShowSegments((v) => !v)}
                      canvasExpanded={canvasExpanded}
                      onToggleCanvasExpanded={() => setCanvasExpanded((v) => !v)}
                      hasSelection={selectedPanelIds.size > 0}
                      onDeleteSelected={handleDeleteSelected}
                    />

                    {/* Loading overlays */}
                    {isOverlayLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[1px]">
                        <div className="glass flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-medium">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                          Loading overlay...
                        </div>
                      </div>
                    )}
                    {isModelRecomputing && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[1px]">
                        <div className="glass flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-medium">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
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
                                  background: overlayMode === 'annual-flux' ? COLORS.legendFlux : COLORS.legendDsm
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
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
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
                <span className="w-32 text-right text-[11px] text-muted-foreground">
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
                  <InfoTooltip text="Approximate sun direction for this month in Malaysia. The amber glow on the canvas shows where sunlight hits your roof." />
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  )
}
