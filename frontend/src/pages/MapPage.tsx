import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { resolveLocation, getLocationStatus } from '@/api/locations'
import { createProject, getProject } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { clearNewProjectDraft, readNewProjectDraft, writeNewProjectDraft } from '@/lib/projectDraftStorage'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, MapPin } from 'lucide-react'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { GuidedTour, type TourStep } from '@/components/GuidedTour'

const MAP_TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to the Solar Layout Generator',
    description:
      "This tool helps you estimate how much you could save on your electricity bill by installing solar panels. Let's start by finding your home."
  },
  {
    target: '[data-tour="search-box"]',
    title: 'Search for Your Address',
    description:
      'Type your full home address or postcode here. The map will zoom to your building and show its outline.'
  },
  {
    target: '[data-tour="search-box"]',
    title: 'Confirm Your Building',
    description:
      'After selecting an address, you\'ll see your building highlighted. Click "Analyse This Location" to fetch satellite solar data — this usually takes 15–30 seconds.'
  }
]

type Phase = 'search' | 'confirm' | 'processing' | 'failed'

const PROCESSING_TIMEOUT_MS = 120_000

const MALAYSIA_CENTER = { lat: 3.14, lng: 101.69 }

export function MapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
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

  // For existing projects, load the project to get its locationId
  const { data: existingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !isNewProject && !!projectId
  })

  // If existing project already has a ready location, navigate to workbench
  // Unless ?view=readonly is set (Back to Map from workbench)
  const searchParams = new URLSearchParams(window.location.search)
  const isReadonly = searchParams.get('view') === 'readonly'
  useEffect(() => {
    if (!isReadonly && existingProject?.location?.status === 'ready') {
      navigate(`/project/${existingProject.id}/workbench`, { replace: true })
    }
  }, [existingProject, navigate, isReadonly])

  // Poll location status while processing
  const { data: statusData, error: statusError } = useQuery({
    queryKey: ['locationStatus', locationId],
    queryFn: () => getLocationStatus(locationId!),
    enabled: phase === 'processing' && !!locationId,
    refetchInterval: 2000
  })

  useEffect(() => {
    if (!statusError || phase !== 'processing') return

    setErrorMessage(statusError instanceof Error ? statusError.message : 'Failed to check rooftop analysis status')
    setPhase('failed')
  }, [phase, statusError])

  // Processing timeout — prevent infinite spinner
  useEffect(() => {
    if (phase !== 'processing') return

    const timeout = window.setTimeout(() => {
      setErrorMessage(
        'Rooftop analysis is taking longer than expected. The Google Solar API may be slow or this location may not have sufficient data. Please try again or try a different address.'
      )
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
        setErrorMessage(err instanceof Error ? err.message : 'Failed to create project')
        setPhase('failed')
      }
    },
    [isNewProject, navigate, projectName]
  )

  // Handle status changes
  useEffect(() => {
    if (!statusData || phase !== 'processing') return

    if (statusData.status === 'ready') {
      if (isNewProject && projectName && locationId) {
        void finalizeNewProject(locationId)
      } else if (!isNewProject && projectId) {
        navigate(`/project/${projectId}/workbench`, { replace: true })
      }
    } else if (statusData.status === 'failed') {
      setErrorMessage('Solar data analysis failed for this location. Please try a different building.')
      setPhase('failed')
    }
  }, [statusData, phase, isNewProject, projectName, locationId, projectId, navigate, finalizeNewProject])

  const handleSelectedPlace = useCallback((lat: number, lng: number, address: string) => {
    const map = mapInstance.current
    if (!map) return

    map.panTo({ lat, lng })
    map.setZoom(19)

    if (markerInstance.current) {
      markerInstance.current.map = null
    }

    markerInstance.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat, lng }
    })

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
    input.placeholder = isReadonly
      ? 'Please create new project in dashboard for new location.'
      : 'Search for your address...'
    input.disabled = isReadonly
    input.className =
      'h-12 w-full rounded-xl border-0 bg-transparent px-4 text-base text-stone-950 outline-none placeholder:text-stone-500'
    host.appendChild(input)

    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'my' }, // Restricts map results to Malaysia only
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
  }, [handleSelectedPlace])

  // Initialize map and autocomplete (uses legacy Autocomplete — reliable with standard Places API)
  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = new google.maps.Map(mapRef.current, {
      center: MALAYSIA_CENTER,
      zoom: 16,
      mapId: 'solar-layout-map',
      disableDefaultUI: true,
      zoomControl: true,
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

  async function handleConfirm() {
    if (!selectedPlace) return
    setPhase('processing')
    setErrorMessage('')

    try {
      const result = await resolveLocation({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
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
      // If 'processing', the polling query above will take over
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resolve location')
      setPhase('failed')
    }
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
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 py-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="font-medium">Failed to load Google Maps</p>
            <p className="text-sm text-muted-foreground">{mapsError}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button variant="outline" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full">
      <div ref={mapRef} className="h-full w-full" />

      {/* Navigation buttons — bottom-left / bottom-right */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-between px-4">
        <Link
          to="/dashboard"
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-md transition-all active:scale-95 hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        {isReadonly && projectId && projectId !== 'new' ? (
          <Link
            to={`/project/${projectId}/workbench`}
            className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-md transition-all active:scale-95 hover:bg-stone-50"
          >
            Workbench
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center px-4">
        <div
          ref={searchHostRef}
          data-tour="search-box"
          className={`pointer-events-auto w-full max-w-md rounded-xl border border-white/70 bg-white/95 shadow-lg backdrop-blur ${
            !isLoaded || phase === 'processing' ? 'pointer-events-none opacity-70' : ''
          }`}
        >
          <div className="h-12" />
        </div>
      </div>

      <GuidedTour storageKey="slg-tour-map" steps={MAP_TOUR_STEPS} />

      {!isLoaded && <LoadingOverlay hints={['Loading Google Maps...', 'Preparing the map view...']} />}

      {/* Confirm panel */}
      {phase === 'confirm' && selectedPlace && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Card className="w-96 shadow-lg">
            <CardContent className="py-4">
              <p className="text-sm font-medium">Is this your building?</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedPlace.address}</p>
              <div className="mt-3 flex gap-2">
                <Button onClick={handleConfirm} className="flex-1">
                  Confirm Location
                </Button>
                <Button variant="outline" onClick={handleRetry} className="flex-1">
                  Search Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Processing overlay */}
      {phase === 'processing' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Card className="w-96 shadow-lg">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Analyzing your rooftop...</p>
                <p className="text-sm text-muted-foreground">
                  Fetching satellite data and solar potential. This usually takes 15–30 seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error state */}
      {phase === 'failed' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Card className="w-96 shadow-lg">
            <CardContent className="py-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={handleRetry} className="flex-1">
                  <MapPin className="mr-2 h-4 w-4" />
                  Try Another Location
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link to="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
