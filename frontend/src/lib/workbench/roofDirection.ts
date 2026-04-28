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

/**
 * Tests whether a panel azimuth falls within the user-selected roof-direction window.
 * Direction `'any'` (or `undefined`) always matches. Used by both layout-preset inference
 * and runtime panel ordering so the two paths stay consistent.
 *
 * @param azimuthDegrees - Panel azimuth in compass degrees (0=N, 90=E, 180=S, 270=W)
 * @param direction - User-selected roof preference from the layout preset modal
 * @returns `true` when the panel's azimuth lies in the chosen quadrant
 */
export function azimuthMatchesRoofDirection(azimuthDegrees: number, direction: RoofDirection | undefined): boolean {
  if (!direction || direction === 'any') return true
  return ROOF_DIRECTION_WINDOWS[direction]?.(azimuthDegrees) ?? true
}

/**
 * Roof-segment variant of {@link azimuthMatchesRoofDirection}.
 * Returns `false` if the segment index is out of bounds.
 *
 * @param segmentIndex - Index into `segments`
 * @param segments - Roof segment list (only `azimuthDegrees` is read)
 * @param direction - User-selected roof preference
 * @returns `true` when the resolved segment's azimuth matches `direction`
 */
export function segmentMatchesRoofDirection(
  segmentIndex: number,
  segments: SegmentWithAzimuth[],
  direction: RoofDirection | undefined
): boolean {
  const segment = segments[segmentIndex]
  if (!segment) return false
  return azimuthMatchesRoofDirection(segment.azimuthDegrees, direction)
}
