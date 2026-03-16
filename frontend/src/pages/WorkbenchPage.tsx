import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Image as KonvaImage, Layer, Stage } from 'react-konva'
import { recomputeFlux, recomputeFluxBatch } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { PanelLayer } from '@/components/workbench/PanelLayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { usePanelState } from '@/hooks/usePanelState'
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

type UiMessage = {
  tone: 'error' | 'info'
  text: string
} | null

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(value)
}

function useLoadedImage(src: string) {
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
      const maxHeight = Math.max(window.innerHeight - 240, 280)
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)

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
  const [message, setMessage] = useState<UiMessage>(null)
  const [rotationInputValue, setRotationInputValue] = useState('')

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
  const error = dataError ?? (imageError ? new Error(imageError) : null)
  const stageSize = useStageSize(containerRef, backgroundImage)

  const geo = useMemo(() => {
    if (!imageGeoTransform || stageSize.width === 0 || stageSize.height === 0) {
      return null
    }

    return createCanvasGeo(imageGeoTransform, stageSize.width, stageSize.height)
  }, [imageGeoTransform, stageSize])

  const panelDimensions = useMemo(() => {
    if (!buildingInsights || !geo) return null
    return panelMetersToPixels(
      buildingInsights.solarPotential.panelWidthMeters,
      buildingInsights.solarPotential.panelHeightMeters,
      geo
    )
  }, [buildingInsights, geo])
  const maskGeo = useMemo(() => {
    if (!roofMask) {
      return null
    }

    return createCanvasGeo(roofMask.geoTransform, roofMask.width, roofMask.height)
  }, [roofMask])
  const maskPanelDimensions = useMemo(() => {
    if (!buildingInsights || !maskGeo) return null

    return panelMetersToPixels(
      buildingInsights.solarPotential.panelWidthMeters,
      buildingInsights.solarPotential.panelHeightMeters,
      maskGeo
    )
  }, [buildingInsights, maskGeo])
  const stageReady = stageSize.width > 0 && stageSize.height > 0 && !!geo && !!panelDimensions

  const {
    visiblePanels,
    visibleCount,
    minVisibleCount,
    maxVisibleCount,
    totalAnnualYield,
    totalCarbonOffsetKg,
    getPanel,
    movePanel,
    rotatePanel,
    deletePanel,
    updatePanelEnergy,
    setVisibleCount,
    serializeLayout
  } = usePanelState({
    projectId,
    solarPanels: buildingInsights?.solarPotential.solarPanels ?? [],
    roofSegments: buildingInsights?.solarPotential.roofSegmentStats ?? [],
    editedLayout: project?.editedLayout ?? null,
    maxArrayPanelsCount: buildingInsights?.solarPotential.maxArrayPanelsCount ?? 0,
    carbonOffsetFactorKgPerMwh: buildingInsights?.solarPotential.carbonOffsetFactorKgPerMwh ?? 0
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
    setRotationInputValue(selectedPanel ? String(Math.round(selectedPanel.rotation)) : '')
  }, [selectedPanel?.id, selectedPanel?.rotation])

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
        rotation
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
    }, 300)
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
          rotation: panel.rotation
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
      await saveLayout(projectId, { editedLayout: nextLayout })
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
                <Badge variant="secondary">Phase 2</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">Annual Yield</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(totalAnnualYield)} kWh</p>
                </div>
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="text-stone-500">CO₂ Offset</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(totalCarbonOffsetKg)} kg</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-rotation">
                    Rotate Panel
                    <InfoTooltip text="Enter a rotation angle (0–359°). The panel's energy yield is recomputed after each change." />
                  </Label>
                  <Input
                    id="panel-rotation"
                    type="number"
                    min={0}
                    max={359}
                    step={5}
                    value={rotationInputValue}
                    disabled={!selectedPanel || pendingPanelId === selectedPanel.id}
                    onChange={(event) => {
                      const rawValue = event.target.value
                      setRotationInputValue(rawValue)

                      if (rawValue === '') return

                      const nextValue = Number(rawValue)
                      if (!Number.isFinite(nextValue)) return

                      const normalizedValue = ((nextValue % 360) + 360) % 360
                      setRotationInputValue(String(Math.round(normalizedValue)))
                      handleRotationInput(normalizedValue)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Rotation changes are debounced by 300ms before recompute.
                  </p>
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
                {(pendingPanelId || isBatchRecomputing) && (
                  <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                    {isBatchRecomputing ? 'Batch Recompute' : 'Recomputing'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div
                ref={containerRef}
                className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-[radial-gradient(circle_at_top_left,#fefce8,transparent_30%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] p-2"
              >
                {stageReady && panelDimensions ? (
                  <Stage
                    width={stageSize.width}
                    height={stageSize.height}
                    className="overflow-hidden rounded-xl shadow-lg"
                  >
                    <Layer listening={false}>
                      <KonvaImage image={backgroundImage} width={stageSize.width} height={stageSize.height} />
                    </Layer>
                    <PanelLayer
                      panels={renderPanels}
                      panelWidth={panelDimensions.width}
                      panelHeight={panelDimensions.height}
                      selectedPanelId={selectedPanelId}
                      stageWidth={stageSize.width}
                      stageHeight={stageSize.height}
                      disabledPanelId={pendingPanelId}
                      onSelect={setSelectedPanelId}
                      onDragEnd={handlePanelDragEnd}
                    />
                  </Stage>
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
