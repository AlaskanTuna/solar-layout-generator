import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Image as KonvaImage, Layer, Stage } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { recomputeFlux, recomputeFluxBatch, getOverlayUrl } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { PanelLayer } from '@/components/workbench/PanelLayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { InfoTooltip } from '@/components/InfoTooltip'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
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
  const [overlayMode, setOverlayMode] = useState<'rgb' | 'annual-flux' | 'dsm'>('rgb')
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null)
  const [overlayExpanded, setOverlayExpanded] = useState(false)
  const zoomSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isOverlayLoading, setIsOverlayLoading] = useState(false)

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
    serializeLayout
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

  const selectedPanel = selectedPanelId ? (getPanel(selectedPanelId) ?? null) : null

  const renderPanels = useMemo(() => {
    if (!geo) return []

    return visiblePanels.map((panel) => ({
      panel,
      ...latLngToPixel(panel.center.lat, panel.center.lng, geo)
    }))
  }, [visiblePanels, geo])

  useEffect(() => {
    if (visiblePanels.length === 0) {
      setSelectedPanelId(null)
      return
    }

    if (!selectedPanelId || !visiblePanels.some((panel) => panel.id === selectedPanelId)) {
      setSelectedPanelId(visiblePanels[0]?.id ?? null)
    }
  }, [selectedPanelId, visiblePanels])

  useEffect(() => {
    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current)
      }
    }
  }, [])

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

  function getPlacementError(panelId: string, center: { lat: number; lng: number }, rotation: number) {
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

  async function handlePanelDragEnd(panelId: string, position: { x: number; y: number }, resetPosition: () => void) {
    if (!geo) return

    const panel = getPanel(panelId)
    if (!panel) return

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
    if (!selectedPanel) return

    const nextRotation = ((value % 360) + 360) % 360
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
    if (!selectedPanelId) return

    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
    }

    deletePanel(selectedPanelId)
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
    }, 3000)

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
      await saveLayout(projectId, { editedLayout: nextLayout, selectedPanelModelId })
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 xl:flex-row">
          <aside className="xl:w-[22rem] xl:min-w-[22rem]">
            <Card className="border-stone-200 bg-white/90 shadow-sm">
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </aside>
          <section className="min-w-0 flex-1">
            <Card className="overflow-hidden border-stone-200 bg-white/90 shadow-sm">
              <CardHeader className="border-b border-stone-200 bg-stone-50/70">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-1 h-4 w-72" />
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
                    Loading rooftop image...
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    )
  }

  const selectedAnnualEnergy = selectedPanel
    ? getPanelAnnualEnergy(selectedPanel.monthlyEnergyDcKwh, selectedPanel.yearlyEnergyDcKwh)
    : null

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 xl:flex-row">
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
                  <p className="text-stone-500">Annual Yield</p>
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

              <div className="space-y-3">
                <Label>
                  Panel Model
                  <InfoTooltip text="Select the solar panel model. Changing the model updates panel dimensions on the canvas and recalculates energy yield for all panels." />
                </Label>
                <select
                  value={selectedPanelModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={isModelRecomputing || isSaving}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                >
                  {PANEL_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} — {model.capacityWp}Wp
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
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
                    <InfoTooltip text="Click any panel on the canvas to select it. You can then rotate or delete it." />
                  </Label>
                  <span className="text-sm font-medium">{selectedPanel?.id ?? 'None'}</span>
                </div>

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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Rotate Panel
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
                    disabled={!selectedPanel || pendingPanelId === selectedPanel.id}
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
                  disabled={!selectedPanel || pendingPanelId === selectedPanel.id}
                  onClick={handleDeleteSelected}
                >
                  Delete Selected Panel
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Button variant="outline" asChild>
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
                <Button onClick={handleSave} disabled={isSaving || pendingPanelId !== null}>
                  {isBatchRecomputing ? 'Recomputing Layout...' : isSaving ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex-1">
          <Card className="overflow-hidden border-stone-200 bg-white/90 shadow-sm">
            <CardHeader className="border-b border-stone-200 bg-stone-50/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Roof Layout Workbench</CardTitle>
                  <CardDescription>
                    Drag panels, rotate the selected panel, and prune the array before analysis.
                  </CardDescription>
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
                className="relative flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-[radial-gradient(circle_at_top_left,#fefce8,transparent_30%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] p-2"
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
                      draggable={stageScale > 1}
                      onWheel={handleWheel}
                      className="overflow-hidden rounded-xl shadow-lg"
                    >
                      <Layer listening={false}>
                        <KonvaImage image={displayImage ?? undefined} width={stageSize.width} height={stageSize.height} />
                      </Layer>
                      <PanelLayer
                        panels={renderPanels}
                        panelWidth={panelDimensions.width}
                        panelHeight={panelDimensions.height}
                        selectedPanelId={selectedPanelId}
                        stageWidth={stageSize.width}
                        stageHeight={stageSize.height}
                        disabledPanelId={pendingPanelId}
                        energyMin={allPanelsEnergyRange.min}
                        energyMax={allPanelsEnergyRange.max}
                        onSelect={setSelectedPanelId}
                        onDragEnd={handlePanelDragEnd}
                      />
                    </Stage>

                    {/* Zoom controls */}
                    <div className="absolute right-4 top-4 flex flex-col gap-1">
                      <button
                        onClick={handleZoomIn}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm font-bold shadow-md hover:bg-white"
                        title="Zoom in"
                      >
                        +
                      </button>
                      <button
                        onClick={handleZoomOut}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm font-bold shadow-md hover:bg-white"
                        title="Zoom out"
                      >
                        −
                      </button>
                      <button
                        onClick={handleZoomReset}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-xs font-medium shadow-md hover:bg-white"
                        title="Reset zoom"
                      >
                        1:1
                      </button>
                      {stageScale !== 1 && (
                        <span className="mt-1 text-center text-xs text-stone-500">
                          {Math.round(stageScale * 100)}%
                        </span>
                      )}
                      <div className="mt-2 border-t border-stone-200 pt-2">
                        <button
                          onClick={() => setOverlayExpanded((v) => !v)}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-sm shadow-md transition-all hover:bg-white',
                            overlayExpanded && 'ring-1 ring-stone-400'
                          )}
                          title={overlayExpanded ? 'Hide overlays' : 'Show overlays'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {overlayExpanded && (
                          <div className="mt-1 flex flex-col gap-1">
                            <button
                              onClick={() => setOverlayMode('rgb')}
                              className={cn(
                                'group relative h-8 w-8 rounded-md shadow-md transition-all',
                                overlayMode === 'rgb' ? 'ring-2 ring-stone-900 ring-offset-1' : 'hover:ring-1 hover:ring-stone-400'
                              )}
                              style={{ background: 'linear-gradient(135deg, #a7f3d0, #93c5fd, #c4b5fd, #fda4af)' }}
                              title="RGB"
                            >
                              <span className="pointer-events-none absolute -left-12 top-1/2 -translate-y-1/2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                RGB
                              </span>
                            </button>
                            <button
                              onClick={() => setOverlayMode('annual-flux')}
                              className={cn(
                                'group relative h-8 w-8 rounded-md shadow-md transition-all',
                                overlayMode === 'annual-flux' ? 'ring-2 ring-stone-900 ring-offset-1' : 'hover:ring-1 hover:ring-stone-400'
                              )}
                              style={{ background: 'linear-gradient(135deg, #1e1b4b, #7e22ce, #f472b6, #fde68a, #fefce8)' }}
                              title="Annual Flux"
                            >
                              <span className="pointer-events-none absolute -left-12 top-1/2 -translate-y-1/2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                Flux
                              </span>
                            </button>
                            <button
                              onClick={() => setOverlayMode('dsm')}
                              className={cn(
                                'group relative h-8 w-8 rounded-md shadow-md transition-all',
                                overlayMode === 'dsm' ? 'ring-2 ring-stone-900 ring-offset-1' : 'hover:ring-1 hover:ring-stone-400'
                              )}
                              style={{ background: 'linear-gradient(135deg, #bfdbfe, #a5f3fc, #bbf7d0, #fef08a, #fecaca)' }}
                              title="DSM"
                            >
                              <span className="pointer-events-none absolute -left-12 top-1/2 -translate-y-1/2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                DSM
                              </span>
                            </button>
                          </div>
                        )}
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

                    {/* Vertical legend for overlay views */}
                    {overlayMode !== 'rgb' && !isOverlayLoading && (
                      <div className="absolute bottom-4 left-4 z-10">
                        <div className="flex items-end gap-2 rounded-lg bg-black/60 px-2.5 py-2 backdrop-blur-sm">
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
                          <span
                            className="text-[10px] font-medium text-white/80"
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.05em' }}
                          >
                            {overlayMode === 'annual-flux' ? 'Solar Flux' : 'Altitude'}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
                    Preparing the canvas...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
