import type { RoofDirection } from '@shared/types'

type SegmentWithAzimuth = {
  azimuthDegrees: number
}

const ROOF_DIRECTION_WINDOWS: Record<Exclude<RoofDirection, 'any'>, (azimuth: number) => boolean> = {
  south: (azimuth) => azimuth >= 135 && azimuth <= 225,
  east: (azimuth) => azimuth >= 45 && azimuth < 135,
  west: (azimuth) => azimuth > 225 && azimuth <= 315,
  north: (azimuth) => azimuth < 45 || azimuth > 315
}

export function azimuthMatchesRoofDirection(azimuthDegrees: number, direction: RoofDirection | undefined): boolean {
  if (!direction || direction === 'any') return true
  return ROOF_DIRECTION_WINDOWS[direction]?.(azimuthDegrees) ?? true
}

export function segmentMatchesRoofDirection(
  segmentIndex: number,
  segments: SegmentWithAzimuth[],
  direction: RoofDirection | undefined
): boolean {
  const segment = segments[segmentIndex]
  if (!segment) return false
  return azimuthMatchesRoofDirection(segment.azimuthDegrees, direction)
}
