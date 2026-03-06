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

  const buildingInsights = locationQuery.data ? parseBuildingInsights(locationQuery.data.buildingInsights) : null
  const parseError =
    locationQuery.data && !buildingInsights ? new Error('Location data is missing required building insights fields') : null

  return {
    project: projectQuery.data,
    buildingInsights,
    rgbImageUrl: locationQuery.data?.rgbImageUrl ?? '',
    isLoading: projectQuery.isLoading || locationQuery.isLoading,
    error: projectQuery.error ?? locationQuery.error ?? parseError
  }
}
