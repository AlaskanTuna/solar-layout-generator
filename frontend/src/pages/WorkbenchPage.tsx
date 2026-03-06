import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Image as KonvaImage, Layer, Stage } from 'react-konva'
import { recomputeFlux } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { PanelLayer } from '@/components/workbench/PanelLayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  latLngToPixel,
  panelMetersToPixels,
  pixelToLatLng,
  type CanvasGeo
} from '@/lib/canvasTransforms'
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

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }

    const nextImage = new window.Image()
    nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => setImage(nextImage)
    nextImage.onerror = () => setImage(null)
    nextImage.src = src
  }, [src])

  return image
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

export function WorkbenchPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [pendingPanelId, setPendingPanelId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<UiMessage>(null)
  const [rotationInputValue, setRotationInputValue] = useState('')

  const { project, buildingInsights, rgbImageUrl, isLoading, error } = useWorkbenchData(projectId)
  const backgroundImage = useLoadedImage(rgbImageUrl)
  const stageSize = useStageSize(containerRef, backgroundImage)

  const geo = useMemo(() => {
    if (!buildingInsights || stageSize.width === 0 || stageSize.height === 0) {
      return null
    }

    return createCanvasGeo(buildingInsights.boundingBox, stageSize.width, stageSize.height)
  }, [buildingInsights, stageSize])

  const panelDimensions = useMemo(() => {
    if (!buildingInsights || !geo) return null
    return panelMetersToPixels(
      buildingInsights.solarPotential.panelWidthMeters,
      buildingInsights.solarPotential.panelHeightMeters,
      geo
    )
  }, [buildingInsights, geo])

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

  const selectedPanel = selectedPanelId ? getPanel(selectedPanelId) ?? null : null

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

  function getPlacementAabb(panelId: string, center: { lat: number; lng: number }, rotation: number, canvasGeo: CanvasGeo) {
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

  function isPlacementValid(panelId: string, center: { lat: number; lng: number }, rotation: number) {
    if (!geo || !panelDimensions) return false

    const proposedAabb = getPlacementAabb(panelId, center, rotation, geo)
    if (!proposedAabb) return false

    if (!isAabbInsideStage(proposedAabb, stageSize.width, stageSize.height)) {
      return false
    }

    for (const otherPanel of visiblePanels) {
      if (otherPanel.id === panelId) continue
      const otherAabb = getPlacementAabb(otherPanel.id, otherPanel.center, otherPanel.rotation, geo)
      if (otherAabb && aabbsOverlap(proposedAabb, otherAabb)) {
        return false
      }
    }

    return true
  }

  async function recomputePanel(panelId: string, center: { lat: number; lng: number }, rotation: number, rollback: () => void) {
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
    if (!isPlacementValid(panelId, nextCenter, panel.rotation)) {
      resetPosition()
      setMessage({ tone: 'error', text: 'That placement overlaps another panel or leaves the roof image bounds.' })
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
    if (!isPlacementValid(selectedPanel.id, selectedPanel.center, nextRotation)) {
      setMessage({ tone: 'error', text: 'That rotation overlaps another panel or leaves the roof image bounds.' })
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
    if (!projectId) return

    setIsSaving(true)
    setMessage(null)

    try {
      await saveLayout(projectId, { editedLayout: serializeLayout() })
      navigate(`/project/${projectId}/analysis`)
    } catch (saveError) {
      setMessage({
        tone: 'error',
        text: saveError instanceof Error ? saveError.message : 'Failed to save the current layout'
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !project || !buildingInsights || !backgroundImage || !panelDimensions) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)] px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
            <p className="text-sm text-muted-foreground">Preparing the workbench...</p>
          </CardContent>
        </Card>
      </div>
    )
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
                  <Label>Panel Quantity</Label>
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
                  <Label>Selected Panel</Label>
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
                  <Label htmlFor="panel-rotation">Rotate Panel</Label>
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
                  {isSaving ? 'Saving...' : 'Save & Continue'}
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
                {pendingPanelId && <Badge className="bg-amber-600 text-white hover:bg-amber-600">Recomputing</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div
                ref={containerRef}
                className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-[radial-gradient(circle_at_top_left,#fefce8,transparent_30%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] p-2"
              >
                {stageSize.width > 0 && stageSize.height > 0 ? (
                  <Stage width={stageSize.width} height={stageSize.height} className="overflow-hidden rounded-xl shadow-lg">
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
                    Loading the rooftop image...
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
