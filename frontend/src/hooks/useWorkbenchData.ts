import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLocationData, type LocationImageGeoTransform } from '@/api/locations'
import { getProject } from '@/api/projects'
import { parseBuildingInsights } from '@/lib/buildingInsights'

/**
 * Defines the DecodedRoofMask type
 */
export type DecodedRoofMask = {
  width: number
  height: number
  pixels: Uint8Array
  geoTransform: LocationImageGeoTransform
}

function decodeBase64(dataBase64: string): Uint8Array {
  const binary = globalThis.atob(dataBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

/**
 * Provides the workbenchData hook
 * @param {string | undefined} projectId - Project identifier
 * @returns {Object} Hook state for workbench data
 */
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
  const roofMask = useMemo(() => {
    if (!locationQuery.data?.roofMask) {
      return null
    }

    return {
      width: locationQuery.data.roofMask.geoTransform.imageWidth,
      height: locationQuery.data.roofMask.geoTransform.imageHeight,
      pixels: decodeBase64(locationQuery.data.roofMask.dataBase64),
      geoTransform: locationQuery.data.roofMask.geoTransform
    } satisfies DecodedRoofMask
  }, [locationQuery.data])
  const missingLocationError =
    projectQuery.data && !locationId
      ? new Error('Project is missing a linked location and cannot open the workbench')
      : null
  const missingRgbImageError =
    locationQuery.data && !locationQuery.data.rgbImageUrl
      ? new Error('Location data is ready, but the rooftop preview image URL is missing')
      : null
  const missingRoofMaskError =
    locationQuery.data && !roofMask ? new Error('Location data is ready, but the roof mask is missing') : null
  const missingImageGeoTransformError =
    locationQuery.data && !locationQuery.data.imageGeoTransform
      ? new Error('Location data is ready, but the rooftop GeoTIFF transform is missing')
      : null
  const parseError =
    locationQuery.data && !buildingInsights
      ? new Error('Location data is missing required building insights fields')
      : null
  const error =
    projectQuery.error ??
    locationQuery.error ??
    missingLocationError ??
    missingRgbImageError ??
    missingRoofMaskError ??
    missingImageGeoTransformError ??
    parseError

  useEffect(() => {
    if (!import.meta.env.DEV) return

    console.info('[WorkbenchData]', {
      projectId,
      locationId: locationId ?? null,
      projectStatus: projectQuery.status,
      locationStatus: locationQuery.status,
      hasBuildingInsights: Boolean(buildingInsights),
      hasImageGeoTransform: Boolean(locationQuery.data?.imageGeoTransform),
      hasRgbImageUrl: Boolean(locationQuery.data?.rgbImageUrl),
      hasRoofMask: Boolean(roofMask),
      error: error instanceof Error ? error.message : null
    })
  }, [
    projectId,
    locationId,
    projectQuery.status,
    locationQuery.status,
    buildingInsights,
    locationQuery.data?.imageGeoTransform,
    locationQuery.data?.rgbImageUrl,
    roofMask,
    error
  ])

  return {
    project: projectQuery.data,
    buildingInsights,
    imageGeoTransform: locationQuery.data?.imageGeoTransform ?? null,
    roofMask,
    rgbImageUrl: locationQuery.data?.rgbImageUrl ?? '',
    isLoading: projectQuery.isLoading || locationQuery.isLoading,
    error
  }
}
