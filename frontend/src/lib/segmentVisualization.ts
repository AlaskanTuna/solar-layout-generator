import type { SolarPanel, RoofSegment } from './buildingInsights'

/** Convex hull around the panels on a single roof segment, used for the "show segments" overlay. */
export type SegmentHull = {
  segmentIndex: number
  azimuth: number
  pitch: number
  panelCount: number
  hullPoints: { x: number; y: number }[]
  color: string
}

/**
 * Maps a roof-segment azimuth to a soft hsla fill used for the segment overlay.
 * Hue cycles around the compass (N→E→S→W) so each direction is visually distinct.
 *
 * @param azimuth - Compass azimuth in degrees (any range; normalized internally)
 * @returns CSS `hsla(...)` string with 35% alpha, suitable for filled polygons
 */
export function azimuthColor(azimuth: number): string {
  const a = ((azimuth % 360) + 360) % 360

  let hue: number
  if (a <= 90) {
    hue = 200 + (120 - 200) * (a / 90)
    hue = ((hue % 360) + 360) % 360
  } else if (a <= 180) {
    hue = 120 + (30 - 120) * ((a - 90) / 90)
    hue = ((hue % 360) + 360) % 360
  } else if (a <= 270) {
    hue = 30 + (280 - 30) * ((a - 180) / 90)
  } else {
    hue = 280 + (200 - 280 + 360) * ((a - 270) / 90)
    hue = hue % 360
  }

  return `hsla(${Math.round(hue)}, 70%, 55%, 0.35)`
}

/**
 * Andrew's monotone-chain convex hull. Returns the input verbatim when ≤2 points.
 *
 * @param points - 2D points to wrap
 * @returns Hull vertices in counter-clockwise order
 */
export function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 2) return [...points]

  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x)
  const origin = sorted[0]!

  const rest = sorted.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a.y - origin.y, a.x - origin.x)
    const angleB = Math.atan2(b.y - origin.y, b.x - origin.x)
    if (angleA !== angleB) return angleA - angleB
    const distA = (a.x - origin.x) ** 2 + (a.y - origin.y) ** 2
    const distB = (b.x - origin.x) ** 2 + (b.y - origin.y) ** 2
    return distA - distB
  })

  const hull = [origin, rest[0]!]

  for (let i = 1; i < rest.length; i++) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2]!
      const b = hull[hull.length - 1]!
      const c = rest[i]!
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
      if (cross <= 0) hull.pop()
      else break
    }
    hull.push(rest[i]!)
  }

  return hull
}

const HULL_PADDING = 4

/**
 * Builds one {@link SegmentHull} per roof segment that has visible panels.
 * Each hull wraps the rotated rectangular footprints (with a small padding) of every
 * visible panel on that segment.
 *
 * @param solarPanels - All panels from the Solar API building insights
 * @param roofSegments - Roof segments paired with `solarPanels` by `segmentIndex`
 * @param panelPixelPositions - Live canvas positions/rotations keyed by panel id
 * @param visiblePanelIds - Subset of panel ids currently shown (after edits/deletes)
 * @param panelWidth - Panel width in pixels (canvas units)
 * @param panelHeight - Panel height in pixels (canvas units)
 * @returns One {@link SegmentHull} per segment with ≥3 visible panels; empty array when none qualify
 */
export function computeSegmentHulls(
  solarPanels: SolarPanel[],
  roofSegments: RoofSegment[],
  panelPixelPositions: Map<string, { x: number; y: number; rotation: number }>,
  visiblePanelIds: Set<string>,
  panelWidth: number,
  panelHeight: number
): SegmentHull[] {
  const groups = new Map<number, { x: number; y: number }[]>()
  const panelCounts = new Map<number, number>()

  const halfW = panelWidth / 2 + HULL_PADDING
  const halfH = panelHeight / 2 + HULL_PADDING

  for (const panel of solarPanels) {
    if (!visiblePanelIds.has(panel.id)) continue
    const pos = panelPixelPositions.get(panel.id)
    if (!pos) continue

    if (!groups.has(panel.segmentIndex)) {
      groups.set(panel.segmentIndex, [])
      panelCounts.set(panel.segmentIndex, 0)
    }

    const rot = (pos.rotation * Math.PI) / 180
    const cosR = Math.cos(rot)
    const sinR = Math.sin(rot)

    const corners = [
      { lx: -halfW, ly: -halfH },
      { lx: halfW, ly: -halfH },
      { lx: halfW, ly: halfH },
      { lx: -halfW, ly: halfH }
    ]

    const pts = groups.get(panel.segmentIndex)!
    for (const { lx, ly } of corners) {
      pts.push({
        x: pos.x + cosR * lx - sinR * ly,
        y: pos.y + sinR * lx + cosR * ly
      })
    }

    panelCounts.set(panel.segmentIndex, (panelCounts.get(panel.segmentIndex) ?? 0) + 1)
  }

  const hulls: SegmentHull[] = []

  for (const [segIdx, points] of groups) {
    const segment = roofSegments[segIdx]
    if (!segment || points.length < 3) continue

    const hull = convexHull(points)
    if (hull.length < 3) continue

    hulls.push({
      segmentIndex: segIdx,
      azimuth: segment.azimuthDegrees,
      pitch: segment.pitchDegrees,
      panelCount: panelCounts.get(segIdx) ?? 0,
      hullPoints: hull,
      color: azimuthColor(segment.azimuthDegrees)
    })
  }

  return hulls
}
