import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { resolveLocation, getLocationStatus, probeLocation } from '@/api/locations'
import { LowerResolutionConsentModal } from '@/components/map/LowerResolutionConsentModal'
import type { ImageryQuality } from '@shared/types'
import { createProject, getProject } from '@/api/projects'
import { ApiError } from '@/api/client'
import { notify } from '@/components/ui/toastConfig'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { clearNewProjectDraft, readNewProjectDraft, writeNewProjectDraft } from '@/lib/projectDraftStorage'
import { markProjectVisited } from '@/lib/recentProjectActivity'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, MapPin } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { GuidedTour, type TourStep } from '@/components/ui/GuidedTour'

type Phase = 'search' | 'confirm' | 'processing' | 'failed'

const PROCESSING_TIMEOUT_MS = 120_000

const MALAYSIA_CENTER = { lat: 3.14, lng: 101.69 }

export function MapPage() {
  const { t } = useTranslation('map')
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isLoaded, error: mapsError } = useGoogleMaps()

  const isNewProject = projectId === 'new'
  const initialDraft = isNewProject ? readNewProjectDraft() : null
  const routeProjectName = (location.state as { projectName?: string } | null)?.projectName?.trim() ?? ''
  const projectName = isNewProject ? routeProjectName || initialDraft?.projectName || '' : ''

  const mapRef = useRef<HTMLDivElement>(null)
  const searchHostRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const autocompleteInstance = useRef<google.maps.places.Autocomplete | null>(null)
  const markerInstance = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const isCreatingProjectRef = useRef(false)

  const [phase, setPhase] = useState<Phase>(
    initialDraft?.phase === 'processing' && initialDraft.locationId ? 'processing' : 'search'
  )
  const [selectedPlace, setSelectedPlace] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [locationId, setLocationId] = useState<string | null>(initialDraft?.locationId ?? null)
  const [errorMessage, setErrorMessage] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [manualError, setManualError] = useState('')
  const [pendingBaseConsent, setPendingBaseConsent] = useState(false)
  const [probeInFlight, setProbeInFlight] = useState(false)

  const searchParams = new URLSearchParams(window.location.search)
  const isReadonly = searchParams.get('view') === 'readonly'

  useEffect(() => {
    if (!isNewProject) return

    if (!projectName) {
      navigate('/dashboard', { replace: true })
      return
    }

    writeNewProjectDraft({
      projectName,
      locationId: phase === 'processing' ? (locationId ?? undefined) : undefined,
      phase: phase === 'processing' ? 'processing' : 'search'
    })
  }, [isNewProject, projectName, locationId, navigate, phase])

  const { data: existingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !isNewProject && !!projectId
  })

  useEffect(() => {
    if (!isNewProject && existingProject?.id) {
      markProjectVisited(existingProject.id)
    }
  }, [existingProject?.id, isNewProject])

  useEffect(() => {
    if (!isReadonly && existingProject?.location?.status === 'ready') {
      navigate(`/project/${existingProject.id}/workbench`, { replace: true })
    }
  }, [existingProject, navigate, isReadonly])

  const { data: statusData, error: statusError } = useQuery({
    queryKey: ['locationStatus', locationId],
    queryFn: () => getLocationStatus(locationId!),
    enabled: phase === 'processing' && !!locationId,
    refetchInterval: 2000
  })

  useEffect(() => {
    if (!statusError || phase !== 'processing') return
    setErrorMessage(statusError instanceof Error ? statusError.message : t('error.checkStatusFailed'))
    setPhase('failed')
  }, [phase, statusError])

  useEffect(() => {
    if (phase !== 'processing') return
    const timeout = window.setTimeout(() => {
      setErrorMessage(t('error.timeout'))
      setPhase('failed')
    }, PROCESSING_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [phase])

  const finalizeNewProject = useCallback(
    async (readyLocationId: string) => {
      if (!isNewProject || !projectName || isCreatingProjectRef.current) return
      isCreatingProjectRef.current = true
      try {
        const project = await createProject({ name: projectName, locationId: readyLocationId })
        clearNewProjectDraft()
        navigate(`/project/${project.id}/workbench`, { replace: true })
      } catch (err) {
        isCreatingProjectRef.current = false
        if (err instanceof ApiError && err.status === 429) {
          notify.warning(err.message)
          void queryClient.invalidateQueries({ queryKey: ['quota'] })
        }
        setErrorMessage(err instanceof Error ? err.message : t('error.resolveLocationFailed'))
        setPhase('failed')
      }
    },
    [isNewProject, navigate, projectName, queryClient]
  )

  useEffect(() => {
    if (!statusData || phase !== 'processing') return
    if (statusData.status === 'ready') {
      if (isNewProject && projectName && locationId) {
        void finalizeNewProject(locationId)
      } else if (!isNewProject && projectId) {
        navigate(`/project/${projectId}/workbench`, { replace: true })
      }
    } else if (statusData.status === 'failed') {
      setErrorMessage(t('error.rooftopAnalysisFailed'))
      setPhase('failed')
    }
  }, [statusData, phase, isNewProject, projectName, locationId, projectId, navigate, finalizeNewProject])

  const handleSelectedPlace = useCallback((lat: number, lng: number, address: string) => {
    const map = mapInstance.current
    if (!map) return
    map.panTo({ lat, lng })
    map.setZoom(19)
    if (markerInstance.current) markerInstance.current.map = null
    markerInstance.current = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat, lng } })
    setSelectedPlace({ lat, lng, address })
    setPhase('confirm')
  }, [])

  const initLegacyAutocomplete = useCallback(() => {
    const map = mapInstance.current
    const host = searchHostRef.current
    if (!map || !host || autocompleteInstance.current) return

    host.replaceChildren()

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = t('search.placeholder')
    input.disabled = isReadonly
    input.className =
      'h-12 w-full rounded-xl border-0 bg-transparent px-4 text-center text-base text-foreground outline-none placeholder:text-center placeholder:text-muted-foreground disabled:cursor-not-allowed'
    host.appendChild(input)

    if (!isReadonly) {
      const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'my' },
        fields: ['geometry', 'formatted_address']
      })
      autocompleteInstance.current = autocomplete
      autocomplete.bindTo('bounds', map)

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.geometry?.location) return
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        const address = place.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        handleSelectedPlace(lat, lng, address)
      })
    }
  }, [handleSelectedPlace, isReadonly])

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = new google.maps.Map(mapRef.current, {
      center: MALAYSIA_CENTER,
      zoom: 16,
      mapId: 'solar-layout-map',
      disableDefaultUI: true,
      mapTypeControl: true,
      mapTypeId: 'satellite'
    })
    mapInstance.current = map
    initLegacyAutocomplete()
  }, [initLegacyAutocomplete])

  useEffect(() => {
    if (!isLoaded) return
    initMap()
  }, [isLoaded, initMap])

  const [pendingExpanded, setPendingExpanded] = useState(false)

  async function handleConfirm() {
    if (!selectedPlace || probeInFlight) return
    setProbeInFlight(true)
    setErrorMessage('')
    try {
      const probe = await probeLocation(selectedPlace.lat, selectedPlace.lng)
      if (!probe.bestQuality) {
        setErrorMessage(t('error.noImagery'))
        setPhase('failed')
        return
      }
      if (probe.bestQuality === 'BASE') {
        // User must opt in to BASE-tier imagery via the consent modal
        // Remember whether expansion was needed so resolve replays the same combo
        setPendingExpanded(probe.expandedCoverage)
        setPendingBaseConsent(true)
        return
      }
      await runResolveLocation('HIGH', false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('error.checkImageryFailed'))
      setPhase('failed')
    } finally {
      setProbeInFlight(false)
    }
  }

  async function runResolveLocation(requiredQuality: ImageryQuality, expandedCoverage: boolean) {
    if (!selectedPlace) return
    setPhase('processing')
    setErrorMessage('')
    try {
      const result = await resolveLocation({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        requiredQuality,
        expandedCoverage,
        ...(isNewProject ? {} : { projectId: projectId })
      })
      setLocationId(result.locationId)
      if (isNewProject && projectName) {
        writeNewProjectDraft({
          projectName,
          locationId: result.locationId,
          phase: result.status === 'processing' ? 'processing' : 'search'
        })
      }
      if (result.status === 'ready') {
        if (isNewProject && projectName) {
          await finalizeNewProject(result.locationId)
        } else if (!isNewProject && projectId) {
          navigate(`/project/${projectId}/workbench`, { replace: true })
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('error.resolveLocationFailed'))
      setPhase('failed')
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setManualError('')
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setManualError(t('search.manualForm.errorInvalidCoords'))
      return
    }
    // Malaysia bounds (approximate, includes Sabah/Sarawak)
    if (lat < 0.85 || lat > 7.4 || lng < 99.6 || lng > 119.3) {
      setManualError(t('search.manualForm.errorOutOfBounds'))
      return
    }
    handleSelectedPlace(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    setManualOpen(false)
  }

  function handleRetry() {
    isCreatingProjectRef.current = false
    setPhase('search')
    setSelectedPlace(null)
    setLocationId(null)
    setErrorMessage('')
    if (isNewProject && projectName) {
      writeNewProjectDraft({ projectName, phase: 'search' })
    }
  }

  if (mapsError) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="glass-card w-full max-w-md space-y-4 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="font-medium">{t('errorState.failedToLoadMaps')}</p>
          <p className="text-sm text-muted-foreground">{mapsError}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t('errorState.reloadPage')}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('errorState.dashboard')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="relative flex w-full flex-col overflow-hidden p-4" style={{ height: 'calc(100vh - 3.5rem)' }}>
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-border shadow-sm">
          <div ref={mapRef} className="h-full w-full" />

          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center px-4">
            <div className="pointer-events-auto w-full max-w-md">
              <div
                ref={searchHostRef}
                data-tour="search-box"
                className={`rounded-xl bg-card/95 shadow-lg backdrop-blur-sm border border-border ${
                  !isLoaded || phase === 'processing' ? 'pointer-events-none opacity-70' : ''
                } ${isReadonly ? 'cursor-not-allowed' : ''}`}
              >
                <div className="h-12" />
              </div>
              {isReadonly && (
                <div className="mt-2 rounded-lg bg-card/95 px-3 py-1.5 shadow-md backdrop-blur-sm border border-border">
                  <p className="text-center text-xs text-muted-foreground">
                    {t('search.readonlyHint')}{' '}
                    <Link to="/dashboard" className="font-medium text-primary underline underline-offset-2">
                      {t('search.readonlyHintLink')}
                    </Link>{' '}
                    {t('search.readonlyHintSuffix')}
                  </p>
                </div>
              )}
              {!isReadonly && phase !== 'processing' && (
                <>
                  <div className="mt-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-center shadow-md backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setManualOpen((v) => !v)
                        setManualError('')
                      }}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {manualOpen ? t('search.manualToggleHide') : t('search.manualToggleShow')}
                    </button>
                  </div>
                  {manualOpen && (
                    <form
                      onSubmit={handleManualSubmit}
                      className="mt-2 space-y-2 rounded-xl border border-border bg-card/95 p-3 shadow-md backdrop-blur-sm"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoFocus
                          placeholder={t('search.manualForm.latitudePlaceholder')}
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={t('search.manualForm.longitudePlaceholder')}
                          value={manualLng}
                          onChange={(e) => setManualLng(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      {manualError && <p className="text-xs text-destructive">{manualError}</p>}
                      <Button type="submit" size="sm" className="w-full gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {t('search.manualForm.submitButton')}
                      </Button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>

          {isReadonly && existingProject && (
            <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2 animate-fade-in">
              <div className="glass-card w-64 p-4">
                <p className="font-heading text-sm font-semibold">{existingProject.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('readonlyCard.viewingSavedLocation')}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="w-full justify-center gap-2" asChild>
                    <Link to="/dashboard">{t('readonlyCard.backToDashboard')}</Link>
                  </Button>
                  <Button size="sm" className="w-full justify-center gap-2" asChild>
                    <Link to={`/project/${existingProject.id}/workbench`}>{t('readonlyCard.proceedToWorkbench')}</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <GuidedTour storageKey="slg-tour-map" steps={[
            {
              title: t('tour.step1Title'),
              description: t('tour.step1Body')
            },
            {
              target: '[data-tour="search-box"]',
              title: t('tour.step2Title'),
              description: t('tour.step2Body'),
              placement: 'below' as const
            },
            {
              title: t('tour.step3Title'),
              description: t('tour.step3Body'),
              placement: 'center-bottom' as const
            }
          ]} />

          {!isLoaded && <LoadingOverlay hints={[t('loading.loadingMaps'), t('loading.preparingMap')]} />}

          {phase === 'confirm' && selectedPlace && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card w-96 p-5">
                <p className="text-sm font-medium">{t('confirm.question')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedPlace.address}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={handleConfirm}
                    className="flex-1 disabled:cursor-not-allowed"
                    disabled={probeInFlight || pendingBaseConsent}
                  >
                    {probeInFlight ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('confirm.checkingImagery')}
                      </>
                    ) : (
                      t('confirm.confirmButton')
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleRetry} className="flex-1">
                    {t('confirm.searchAgain')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === 'processing' && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card flex w-96 items-center gap-3 p-5">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">{t('processing.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('processing.description')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {phase === 'failed' && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card w-96 p-5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" onClick={handleRetry}>
                    <MapPin className="mr-2 h-4 w-4" />
                    {t('error.tryAnotherLocation')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <LowerResolutionConsentModal
        open={pendingBaseConsent}
        onAccept={() => {
          setPendingBaseConsent(false)
          void runResolveLocation('BASE', pendingExpanded)
        }}
        onCancel={() => setPendingBaseConsent(false)}
      />
    </AppLayout>
  )
}
