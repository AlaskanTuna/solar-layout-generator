import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { resolveLocation, getLocationStatus } from '@/api/locations'
import { createProject, getProject } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { clearNewProjectDraft, readNewProjectDraft, writeNewProjectDraft } from '@/lib/projectDraftStorage'

type Phase = 'search' | 'confirm' | 'processing' | 'failed'

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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const autocompleteInstance = useRef<google.maps.places.Autocomplete | null>(null)
  const markerInstance = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

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
      locationId: phase === 'processing' ? locationId ?? undefined : undefined,
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
  useEffect(() => {
    if (existingProject?.location?.status === 'ready') {
      navigate(`/project/${existingProject.id}/workbench`, { replace: true })
    }
  }, [existingProject, navigate])

  // Poll location status while processing
  const { data: statusData } = useQuery({
    queryKey: ['locationStatus', locationId],
    queryFn: () => getLocationStatus(locationId!),
    enabled: phase === 'processing' && !!locationId,
    refetchInterval: 2000
  })

  // Handle status changes
  useEffect(() => {
    if (!statusData || phase !== 'processing') return

    if (statusData.status === 'ready') {
      if (isNewProject && projectName && locationId) {
        createProject({ name: projectName, locationId })
          .then((project) => {
            clearNewProjectDraft()
            navigate(`/project/${project.id}/workbench`, { replace: true })
          })
          .catch((err) => {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to create project')
            setPhase('failed')
          })
      } else if (!isNewProject && projectId) {
        navigate(`/project/${projectId}/workbench`, { replace: true })
      }
    } else if (statusData.status === 'failed') {
      setErrorMessage('Solar data analysis failed for this location. Please try a different building.')
      setPhase('failed')
    }
  }, [statusData, phase, isNewProject, projectName, locationId, projectId, navigate])

  // Initialize map and autocomplete
  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = new google.maps.Map(mapRef.current, {
      center: MALAYSIA_CENTER,
      zoom: 16,
      mapId: 'solar-layout-map',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      mapTypeId: 'satellite'
    })
    mapInstance.current = map

    const input = searchInputRef.current
    if (!input || autocompleteInstance.current) return

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
    })
  }, [])

  useEffect(() => {
    if (isLoaded) initMap()
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
          const project = await createProject({ name: projectName, locationId: result.locationId })
          clearNewProjectDraft()
          navigate(`/project/${project.id}/workbench`, { replace: true })
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
      <div className="flex h-screen items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load Google Maps: {mapsError}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full">
      <div ref={mapRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-md">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search for your address..."
            disabled={!isLoaded || phase === 'processing'}
            className="h-12 border-white/70 bg-white/95 px-4 text-base shadow-lg backdrop-blur"
          />
        </div>
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
        </div>
      )}

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
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
              <div>
                <p className="text-sm font-medium">Analyzing your rooftop...</p>
                <p className="text-sm text-muted-foreground">This may take a moment.</p>
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
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" onClick={handleRetry} className="mt-3 w-full">
                Try a Different Location
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
