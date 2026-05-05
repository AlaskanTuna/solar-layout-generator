import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { resolveLocation, getLocationStatus, probeLocation } from '@/api/locations'
import { LowerResolutionConsentModal } from '@/components/map/LowerResolutionConsentModal'
import { CoverageNoticeModal, readCoverageNoticeDismissed } from '@/components/map/CoverageNoticeModal'
import { ManualCoordinateModal } from '@/components/map/ManualCoordinateModal'
import type { ImageryQuality } from '@shared/types'
import { createProject, getProject } from '@/api/projects'
import { ApiError } from '@/api/client'
import { notify } from '@/components/ui/toastConfig'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { clearNewProjectDraft, readNewProjectDraft, writeNewProjectDraft } from '@/lib/projectDraftStorage'
import { markProjectVisited } from '@/lib/recentProjectActivity'
import { AlertTriangle, ArrowLeft, Info, Loader2, Locate, MapPin } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { GuidedTour } from '@/components/ui/GuidedTour'

type Phase = 'search' | 'confirm' | 'processing' | 'failed'

const PROCESSING_TIMEOUT_MS = 120_000

const MALAYSIA_CENTER = { lat: 3.14, lng: 101.69 }
const MY_BOUNDS = { latMin: 0.85, latMax: 7.4, lngMin: 99.6, lngMax: 119.3 }

/**
 * Renders the map flow for location search, confirmation, and processing
 */
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
  const geocoderInstance = useRef<google.maps.Geocoder | null>(null)
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const isCreatingProjectRef = useRef(false)

  const [phase, setPhase] = useState<Phase>(
    initialDraft?.phase === 'processing' && initialDraft.locationId ? 'processing' : 'search'
  )
  const [selectedPlace, setSelectedPlace] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [locationId, setLocationId] = useState<string | null>(initialDraft?.locationId ?? null)
  const [errorMessage, setErrorMessage] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [pendingBaseConsent, setPendingBaseConsent] = useState(false)
  const [probeInFlight, setProbeInFlight] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [coverageModalOpen, setCoverageModalOpen] = useState(false)
  const coverageAutoShownRef = useRef(false)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)

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

  const reverseGeocodeAndSelect = useCallback(
    async (lat: number, lng: number) => {
      if (!geocoderInstance.current) {
        geocoderInstance.current = new google.maps.Geocoder()
      }
      setReverseGeocoding(true)
      try {
        const { results } = await geocoderInstance.current.geocode({ location: { lat, lng } })
        const address = results?.[0]?.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        handleSelectedPlace(lat, lng, address)
      } catch {
        // Reverse geocode failures fall back to coordinate display so the user can still proceed.
        handleSelectedPlace(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      } finally {
        setReverseGeocoding(false)
      }
    },
    [handleSelectedPlace]
  )

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (isReadonly || phase === 'processing' || reverseGeocoding) return
      const latLng = event.latLng
      if (!latLng) return
      const lat = latLng.lat()
      const lng = latLng.lng()
      if (lat < MY_BOUNDS.latMin || lat > MY_BOUNDS.latMax || lng < MY_BOUNDS.lngMin || lng > MY_BOUNDS.lngMax) {
        setErrorMessage(t('error.outOfBounds'))
        setPhase('failed')
        return
      }
      void reverseGeocodeAndSelect(lat, lng)
    },
    [isReadonly, phase, reverseGeocoding, reverseGeocodeAndSelect, t]
  )

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
      mapTypeId: 'satellite',
      clickableIcons: false
    })
    mapInstance.current = map
    geocoderInstance.current = new google.maps.Geocoder()
    initLegacyAutocomplete()
  }, [initLegacyAutocomplete])

  useEffect(() => {
    if (!isLoaded) return
    initMap()
  }, [isLoaded, initMap])

  // Bind/unbind the click-to-drop-pin handler. Re-binding when handleMapClick changes
  // keeps the closure fresh (phase, reverseGeocoding) without leaking listeners.
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    if (clickListenerRef.current) {
      clickListenerRef.current.remove()
      clickListenerRef.current = null
    }
    clickListenerRef.current = map.addListener('click', handleMapClick)
    return () => {
      clickListenerRef.current?.remove()
      clickListenerRef.current = null
    }
  }, [isLoaded, handleMapClick])

  // Surface the coverage notice once the guided tour finishes (or was already dismissed)
  // for a fresh new-project flow. Honors the user's permanent dismissal in localStorage.
  useEffect(() => {
    if (coverageAutoShownRef.current) return
    if (!isNewProject || isReadonly) return
    if (tourActive) return
    if (readCoverageNoticeDismissed()) return
    coverageAutoShownRef.current = true
    setCoverageModalOpen(true)
  }, [isNewProject, isReadonly, tourActive])

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

  function handleManualSubmit(lat: number, lng: number) {
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
        {/* Map canvas */}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-border shadow-sm">
          <div ref={mapRef} className="h-full w-full" />

          {/* Search and placement controls */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center px-4">
            <div className="pointer-events-auto w-full max-w-md">
              <div
                data-tour="search-box"
                className={`flex items-center rounded-xl bg-card/95 shadow-lg backdrop-blur-sm border border-border ${
                  !isLoaded || phase === 'processing' ? 'pointer-events-none opacity-70' : ''
                } ${isReadonly ? 'cursor-not-allowed' : ''}`}
              >
                <div ref={searchHostRef} className="min-w-0 flex-1">
                  <div className="h-12" />
                </div>
                {!isReadonly && (
                  <button
                    type="button"
                    onClick={() => setManualOpen(true)}
                    title={t('search.manualToggleShow')}
                    aria-label={t('search.manualToggleShow')}
                    className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Locate className="h-4 w-4" />
                  </button>
                )}
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
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      coverageAutoShownRef.current = true
                      setCoverageModalOpen(true)
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:text-foreground"
                  >
                    <Info className="h-3 w-3" />
                    {t('search.coverageInfoButton')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Read-only project card */}
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

          <GuidedTour
            storageKey="slg-tour-map"
            onActiveChange={setTourActive}
            steps={[
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
            ]}
          />

          {!isLoaded && <LoadingOverlay hints={[t('loading.loadingMaps'), t('loading.preparingMap')]} />}

          {/* Reverse-geocode in flight toast */}
          {reverseGeocoding && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card flex items-center gap-2 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">{t('confirm.checkingImagery')}</p>
              </div>
            </div>
          )}

          {/* Confirmation prompt */}
          {phase === 'confirm' && selectedPlace && !reverseGeocoding && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card w-[calc(100vw-2rem)] max-w-sm p-5 sm:w-96 sm:max-w-none">
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

          {/* Processing state */}
          {phase === 'processing' && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 p-5 sm:w-96 sm:max-w-none">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">{t('processing.title')}</p>
                  <p className="text-sm text-muted-foreground">{t('processing.description')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Failure state */}
          {phase === 'failed' && (
            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-in-up">
              <div className="glass-card w-[calc(100vw-2rem)] max-w-sm p-5 sm:w-96 sm:max-w-none">
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

      <CoverageNoticeModal open={coverageModalOpen} onClose={() => setCoverageModalOpen(false)} />

      <ManualCoordinateModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={handleManualSubmit}
        bounds={MY_BOUNDS}
      />
    </AppLayout>
  )
}
