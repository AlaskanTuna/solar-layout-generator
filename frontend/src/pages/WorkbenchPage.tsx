import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Image as KonvaImage, Layer, Line as KonvaLine, Rect as KonvaRect, Stage } from 'react-konva'
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
import { useOverlayImages, type OverlayMode } from '@/hooks/useOverlayImages'
import { useWorkbenchSave } from '@/hooks/useWorkbenchSave'
import { useCanvasZoom } from '@/hooks/useCanvasZoom'
import { useCanvasInteractions } from '@/hooks/useCanvasInteractions'
import { useStageSize } from '@/hooks/useStageSize'
import { annualEnergyFromMonthly } from '@/lib/buildingInsights'
import { COLORS } from '@/lib/constants'
import { getWorkbenchTourSteps } from '@/lib/workbenchTour'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageContainer } from '@/components/layout/PageContainer'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { GuidedTour } from '@/components/ui/GuidedTour'
import { CanvasControls } from '@/components/workbench/CanvasControls'
import { CanvasLegends } from '@/components/workbench/CanvasLegends'
import { WorkbenchSidebar } from '@/components/workbench/WorkbenchSidebar'
import { LayoutPresetModal } from '@/components/workbench/LayoutPresetModal'
import { saveLayoutPreferences } from '@/api/projects'
import { describeLayoutPreset, inferVisibleCount } from '@/lib/layoutPreset'
import { markProjectVisited } from '@/lib/recentProjectActivity'
import type { LayoutPreferences } from '@shared/types'
import { PANEL_MODELS, DEFAULT_PANEL_MODEL_ID, getPanelModel } from '@shared/types'

function getPanelAnnualEnergy(monthlyEnergyDcKwh: number[], yearlyEnergyDcKwh: number): number {
  return monthlyEnergyDcKwh.length > 0 ? annualEnergyFromMonthly(monthlyEnergyDcKwh) : yearlyEnergyDcKwh
}

export function WorkbenchPage() {
  const { t } = useTranslation('workbench')
  const { projectId } = useParams<{ projectId: string }>()
  const containerRef = useRef<HTMLDivElement>(null)

  const [initialBatchStatus, setInitialBatchStatus] = useState<BatchRecomputeStatus>('idle')
  const [canvasExpanded, setCanvasExpanded] = useState(false)
  const [freeRotate, setFreeRotate] = useState(false)
  const [selectedPanelModelId, setSelectedPanelModelId] = useState(DEFAULT_PANEL_MODEL_ID)
  const hydratedPanelModelProjectIdRef = useRef<string | null>(null)
  const selectedPanelModel = getPanelModel(selectedPanelModelId) ?? PANEL_MODELS[1]!
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('rgb')
  const [overlayExpanded, setOverlayExpanded] = useState(false)
  const [showSegments, setShowSegments] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

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

  useEffect(() => {
    if (project?.id) {
      markProjectVisited(project.id)
    }
  }, [project?.id])

  useEffect(() => {
    if (!projectId) {
      hydratedPanelModelProjectIdRef.current = null
      return
    }
    if (hydratedPanelModelProjectIdRef.current === projectId) return
    if (!project) return
    hydratedPanelModelProjectIdRef.current = projectId
    const savedId = project.analysisConfig?.selectedPanelModelId
    if (savedId && getPanelModel(savedId)) {
      setSelectedPanelModelId(savedId)
    }
  }, [projectId, project])

  // ─── Layout Preset (W-1) ───────────────────────────────────────────────
  // Auto-shows on first Workbench entry per project. Manual slider moves
  // flip sizingGoal to 'custom' so the sidebar badge reflects reality.
  const queryClient = useQueryClient()
  const [layoutPresetOpen, setLayoutPresetOpen] = useState(false)
  const layoutPresetAutoShownRef = useRef<string | null>(null)
  const applyingPresetRef = useRef(false)

  const layoutPreferences: LayoutPreferences | null = project?.layoutPreferences ?? null

  const layoutPrefsMutation = useMutation({
    mutationFn: (next: Partial<LayoutPreferences>) => saveLayoutPreferences(projectId!, { layoutPreferences: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] })
  })

  useEffect(() => {
    if (!projectId || !project) return
    if (layoutPresetAutoShownRef.current === projectId) return
    layoutPresetAutoShownRef.current = projectId
    if (layoutPreferences === null) {
      setLayoutPresetOpen(true)
    }
  }, [projectId, project, layoutPreferences])

  const { backgroundImage, displayImage, imageError, isOverlayLoading } = useOverlayImages(
    rgbImageUrl,
    project?.locationId,
    overlayMode
  )

  const error = dataError ?? (imageError ? new Error(imageError) : null)
  const stageSize = useStageSize(containerRef, backgroundImage)

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
    bulkUpdatePanels,
    pushSnapshot,
    setVisibleCount,
    resetDeletionsAndApplyVisibleCount,
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
    roofDirection: project?.layoutPreferences?.roofDirection,
    onBatchRecomputeStatusChange: setInitialBatchStatus
  })

  // ─── Layout Preset (W-1) handlers ─────────────────────────────────────
  // Wraps setVisibleCount so a manual slider move flips sizingGoal to 'custom'.
  // Preset Save / Skip use the raw setter via applyingPresetRef.
  const handleVisibleCountChange = useCallback(
    (count: number) => {
      setVisibleCount(count)
      if (applyingPresetRef.current) return
      if (!projectId) return
      if (layoutPreferences && layoutPreferences.sizingGoal === 'custom') return
      layoutPrefsMutation.mutate({ sizingGoal: 'custom' })
    },
    [setVisibleCount, projectId, layoutPreferences, layoutPrefsMutation]
  )

  const handleLayoutPresetSave = useCallback(
    (next: LayoutPreferences) => {
      const panels = buildingInsights?.solarPotential.solarPanels ?? []
      const segments = buildingInsights?.solarPotential.roofSegmentStats ?? []
      const targetCount = inferVisibleCount(panels, next, segments)
      const clamped = Math.max(minVisibleCount, Math.min(maxVisibleCount, targetCount))
      applyingPresetRef.current = true
      try {
        // Reset all deletions before applying — on a reopened project,
        // setVisibleCount alone is capped by effectiveMaxVisibleCount (= max − deleted),
        // which silently floors larger preset targets to the saved active count.
        resetDeletionsAndApplyVisibleCount(clamped)
      } finally {
        // Release on next tick so React's batched commit has settled before slider listener fires.
        setTimeout(() => {
          applyingPresetRef.current = false
        }, 0)
      }
      layoutPrefsMutation.mutate(next)
    },
    [buildingInsights, minVisibleCount, maxVisibleCount, resetDeletionsAndApplyVisibleCount, layoutPrefsMutation]
  )

  const handleLayoutPresetSkip = useCallback(() => {
    layoutPrefsMutation.mutate({ sizingGoal: 'maximum', dismissedAt: new Date().toISOString() })
  }, [layoutPrefsMutation])

  const interactions = useCanvasInteractions({
    locationId: project?.locationId,
    imageGeoTransform,
    roofMask,
    stageSize,
    selectedPanelModel,
    selectedPanelModelId,
    setSelectedPanelModelId,
    visiblePanels,
    getPanel,
    movePanel,
    rotatePanel,
    deletePanel,
    updatePanelEnergy,
    bulkUpdatePanels,
    pushSnapshot,
    showSegments,
    solarPanels: buildingInsights?.solarPotential.solarPanels ?? [],
    roofSegments: buildingInsights?.solarPotential.roofSegmentStats ?? []
  })

  const { isSaving, isBatchRecomputing, handleSave } = useWorkbenchSave({
    projectId,
    locationId: project?.locationId,
    selectedPanelModel,
    selectedPanelModelId,
    serializeLayout,
    updatePanelEnergy
  })

  const zoom = useCanvasZoom(stageSize)

  useWorkbenchKeyboard({
    undo,
    redo,
    selectedPanelIds: interactions.selectedPanelIds,
    onDeleteSelected: interactions.handleDeleteSelected,
    onSpaceDown: () => setSpaceHeld(true),
    onSpaceUp: () => setSpaceHeld(false)
  })

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_100%)] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t('errorState.title')}</CardTitle>
            <CardDescription>{t('errorState.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : t('errorState.unknownError')}</p>
            <Button asChild variant="outline" size="sm" className="w-full justify-center gap-2">
              <Link to="/dashboard">{t('errorState.backToDashboard')}</Link>
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
          t('loading.rooftopImage'),
          t('loading.mappingPanels'),
          t('loading.preparingWorkbench')
        ]}
      />
    )
  }

  const selectedAnnualEnergy = interactions.selectedPanel
    ? getPanelAnnualEnergy(interactions.selectedPanel.monthlyEnergyDcKwh, interactions.selectedPanel.yearlyEnergyDcKwh)
    : null

  return (
    <AppLayout>
      <GuidedTour storageKey="slg-tour-workbench" steps={getWorkbenchTourSteps(t)} />
      <PageContainer variant="mvp">
        <WorkbenchSidebar
          projectName={project.name}
          imageryQuality={project.location?.imageryQuality ?? null}
          totalAnnualYield={totalAnnualYield}
          totalCarbonOffsetKg={totalCarbonOffsetKg}
          carbonOffsetFactorKgPerMwh={buildingInsights.solarPotential.carbonOffsetFactorKgPerMwh}
          maxArrayPanelsCount={buildingInsights.solarPotential.maxArrayPanelsCount}
          panelLifetimeYears={buildingInsights.solarPotential.panelLifetimeYears ?? undefined}
          selectedPanelModelId={selectedPanelModelId}
          selectedPanelModel={selectedPanelModel}
          onModelChange={interactions.handleModelChange}
          isModelRecomputing={interactions.isModelRecomputing}
          isSaving={isSaving}
          isBatchRecomputing={isBatchRecomputing}
          initialBatchStatus={initialBatchStatus}
          message={interactions.message}
          visiblePanelCount={visiblePanels.length}
          visibleCount={visibleCount}
          minVisibleCount={minVisibleCount}
          maxVisibleCount={maxVisibleCount}
          onVisibleCountChange={handleVisibleCountChange}
          layoutPresetLabel={describeLayoutPreset(layoutPreferences)}
          onOpenLayoutPreset={() => setLayoutPresetOpen(true)}
          selectedPanelIds={interactions.selectedPanelIds}
          selectedPanel={interactions.selectedPanel}
          selectedAnnualEnergy={selectedAnnualEnergy}
          pendingPanelId={interactions.pendingPanelId}
          onSave={handleSave}
        />

        <section
          className={
            canvasExpanded
              ? 'fixed inset-0 z-[70] flex flex-col bg-background p-4'
              : 'flex min-h-[60vh] min-w-0 flex-1 flex-col xl:min-h-0'
          }
        >
          <Card data-tour="canvas" className="flex flex-1 flex-col overflow-hidden border-border bg-card/90 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle data-tour="canvas-title">
                    {t('canvas.title')}
                    <InfoTooltip text={t('canvas.titleTooltip')} />
                  </CardTitle>
                </div>
                {(interactions.pendingPanelId || isBatchRecomputing || initialBatchStatus === 'loading') && (
                  <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                    {isBatchRecomputing
                      ? t('badge.batchRecompute')
                      : initialBatchStatus === 'loading'
                        ? t('badge.computingMonthly')
                        : t('badge.recomputing')}
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
                {interactions.selectedPanel && (
                  <div className="absolute left-3 top-3 z-20 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white backdrop-blur-sm">
                    {Math.round(interactions.selectedPanel.rotation)}°
                  </div>
                )}

                {interactions.stageReady && interactions.panelDimensions ? (
                  <>
                    <Stage
                      width={stageSize.width}
                      height={stageSize.height}
                      scaleX={zoom.stageScale}
                      scaleY={zoom.stageScale}
                      x={zoom.stagePosition.x}
                      y={zoom.stagePosition.y}
                      draggable={(zoom.stageScale > 1 && !interactions.marqueeMode) || spaceHeld}
                      style={{ cursor: spaceHeld ? 'grab' : undefined }}
                      onWheel={zoom.handleWheel}
                      className="overflow-hidden rounded-xl shadow-lg"
                      onClick={(e) => {
                        if (spaceHeld) return
                        if (e.target === e.target.getStage()) interactions.setSelectedPanelIds(new Set())
                      }}
                      onMouseDown={(e) => {
                        if (!interactions.marqueeMode || spaceHeld) return
                        if (e.target !== e.target.getStage()) return
                        const stage = e.target.getStage()
                        if (!stage) return
                        const pos = stage.getPointerPosition()
                        if (!pos) return
                        interactions.handleMarqueeStart(pos.x, pos.y, stage.scaleX(), stage.x(), stage.y())
                      }}
                      onMouseMove={(e) => {
                        const stage = e.target.getStage()
                        if (!stage) return
                        const pos = stage.getPointerPosition()
                        if (!pos) return
                        interactions.handleMarqueeMove(pos.x, pos.y, stage.scaleX(), stage.x(), stage.y())
                      }}
                      onMouseUp={() => interactions.handleMarqueeEnd()}
                    >
                      <Layer listening={false}>
                        <KonvaImage
                          image={displayImage ?? undefined}
                          width={stageSize.width}
                          height={stageSize.height}
                        />
                      </Layer>
                      {showSegments && interactions.segmentHulls.length > 0 && (
                        <Layer listening={false}>
                          {interactions.segmentHulls.map((hull) => (
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
                        panels={interactions.renderPanels}
                        panelWidth={interactions.panelDimensions.width}
                        panelHeight={interactions.panelDimensions.height}
                        selectedPanelIds={interactions.selectedPanelIds}
                        stageWidth={stageSize.width}
                        stageHeight={stageSize.height}
                        disabledPanelId={interactions.pendingPanelId}
                        snapEnabled={interactions.snapEnabled}
                        onSnapDragMove={interactions.handleSnapDragMove}
                        onSelect={interactions.handlePanelSelect}
                        onDragStart={interactions.handlePanelDragStart}
                        onDragMove={interactions.handlePanelDragMove}
                        onDragEnd={interactions.handlePanelDragEnd}
                        onRotate={interactions.handleCanvasRotate}
                        onGroupRotateStart={interactions.handleGroupRotateStart}
                        onGroupRotateMove={interactions.handleGroupRotateMove}
                        onGroupRotateEnd={interactions.handleGroupRotateEnd}
                        freeRotate={freeRotate}
                      />
                      {interactions.snapGuides.length > 0 && (
                        <Layer listening={false}>
                          {interactions.snapGuides.map((guide, i) => (
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
                      {interactions.marqueeRect && (
                        <Layer>
                          <KonvaRect
                            x={interactions.marqueeRect.x}
                            y={interactions.marqueeRect.y}
                            width={interactions.marqueeRect.width}
                            height={interactions.marqueeRect.height}
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
                      marqueeMode={interactions.marqueeMode}
                      onToggleMarquee={() => interactions.setMarqueeMode((v) => !v)}
                      snapEnabled={interactions.snapEnabled}
                      onToggleSnap={() => interactions.setSnapEnabled((v) => !v)}
                      stageScale={zoom.stageScale}
                      onZoomIn={zoom.handleZoomIn}
                      onZoomOut={zoom.handleZoomOut}
                      onZoomReset={zoom.handleZoomReset}
                      overlayExpanded={overlayExpanded}
                      onToggleOverlayExpanded={() => setOverlayExpanded((v) => !v)}
                      overlayMode={overlayMode}
                      onOverlayModeChange={setOverlayMode}
                      showSegments={showSegments}
                      onToggleSegments={() => setShowSegments((v) => !v)}
                      canvasExpanded={canvasExpanded}
                      onToggleCanvasExpanded={() => setCanvasExpanded((v) => !v)}
                      hasSelection={interactions.selectedPanelIds.size > 0}
                      onDeleteSelected={interactions.handleDeleteSelected}
                      freeRotate={freeRotate}
                      onToggleFreeRotate={() => setFreeRotate((v) => !v)}
                    />

                    {(isOverlayLoading || interactions.isModelRecomputing) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[1px]">
                        <div className="glass flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-medium">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                          {isOverlayLoading ? t('canvas.loadingOverlay') : t('canvas.recalculating')}
                        </div>
                      </div>
                    )}

                    <CanvasLegends
                      showSegments={showSegments}
                      segmentHulls={interactions.segmentHulls}
                      overlayMode={overlayMode}
                      isOverlayLoading={isOverlayLoading}
                    />
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                    {t('canvas.preparingCanvas')}
                  </div>
                )}
              </div>

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
                    if (a >= 337.5 || a < 22.5) return t('canvas.compass.n')
                    if (a < 67.5) return t('canvas.compass.ne')
                    if (a < 112.5) return t('canvas.compass.e')
                    if (a < 157.5) return t('canvas.compass.se')
                    if (a < 202.5) return t('canvas.compass.s')
                    if (a < 247.5) return t('canvas.compass.sw')
                    if (a < 292.5) return t('canvas.compass.w')
                    return t('canvas.compass.nw')
                  })()}
                  <InfoTooltip text={t('canvas.sunDirection.tooltip')} />
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      </PageContainer>

      <LayoutPresetModal
        open={layoutPresetOpen}
        onOpenChange={setLayoutPresetOpen}
        prefs={layoutPreferences}
        onSave={handleLayoutPresetSave}
        onSkip={handleLayoutPresetSkip}
      />
    </AppLayout>
  )
}
