import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLocationData } from '@/api/locations'
import { getProject } from '@/api/projects'
import { parseBuildingInsights } from '@/lib/buildingInsights'

export function useWorkbenchData(projectId: string | undefined) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId
  })

  const locationId = projectQuery.data?.locationId

  const locationQuery = useQuery({
    queryKey: ['locationData', locationId],
    queryFn: () => getLocationData(locationId!),
    enabled: !!locationId
  })

  const buildingInsights = useMemo(
    () => (locationQuery.data ? parseBuildingInsights(locationQuery.data.buildingInsights) : null),
    [locationQuery.data]
  )
  const missingLocationError =
    projectQuery.data && !locationId ? new Error('Project is missing a linked location and cannot open the workbench') : null
  const missingRgbImageError =
    locationQuery.data && !locationQuery.data.rgbImageUrl
      ? new Error('Location data is ready, but the rooftop preview image URL is missing')
      : null
  const parseError =
    locationQuery.data && !buildingInsights ? new Error('Location data is missing required building insights fields') : null
  const error = projectQuery.error ?? locationQuery.error ?? missingLocationError ?? missingRgbImageError ?? parseError

  useEffect(() => {
    if (!import.meta.env.DEV) return

    console.info('[WorkbenchData]', {
      projectId,
      locationId: locationId ?? null,
      projectStatus: projectQuery.status,
      locationStatus: locationQuery.status,
      hasBuildingInsights: Boolean(buildingInsights),
      hasRgbImageUrl: Boolean(locationQuery.data?.rgbImageUrl),
      error: error instanceof Error ? error.message : null
    })
  }, [projectId, locationId, projectQuery.status, locationQuery.status, buildingInsights, locationQuery.data?.rgbImageUrl, error])

  return {
    project: projectQuery.data,
    buildingInsights,
    rgbImageUrl: locationQuery.data?.rgbImageUrl ?? '',
    isLoading: projectQuery.isLoading || locationQuery.isLoading,
    error
  }
}
