import type { SolarPanel, RoofSegment } from './buildingInsights'

export type SegmentHull = {
  segmentIndex: number
  azimuth: number
  pitch: number
  panelCount: number
  hullPoints: { x: number; y: number }[]
  color: string
}

/**
 * Assign a color based on azimuth angle.
 * South-facing (180°) = warm amber/red, North-facing (0°/360°) = cool blue/teal.
 * East (90°) = green, West (270°) = purple.
 */
export function azimuthColor(azimuth: number): string {
  // Normalize azimuth to 0-360
  const a = ((azimuth % 360) + 360) % 360

  // HSL color wheel: map azimuth to hue
  // 0° (N) = 200 (blue), 90° (E) = 120 (green), 180° (S) = 30 (amber), 270° (W) = 280 (purple)
  let hue: number
  if (a <= 90) {
    hue = 200 + (120 - 200) * (a / 90) // blue to green
    hue = ((hue % 360) + 360) % 360
  } else if (a <= 180) {
    hue = 120 + (30 - 120) * ((a - 90) / 90) // green to amber
    hue = ((hue % 360) + 360) % 360
  } else if (a <= 270) {
    hue = 30 + (280 - 30) * ((a - 180) / 90) // amber to purple
  } else {
    hue = 280 + (200 - 280 + 360) * ((a - 270) / 90) // purple back to blue
    hue = hue % 360
  }

  return `hsla(${Math.round(hue)}, 70%, 55%, 0.35)`
}

/**
 * Compute convex hull of 2D points using Graham scan.
 */
export function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 2) return [...points]

  // Find bottom-most (then left-most) point
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x)
  const origin = sorted[0]!

  // Sort by polar angle
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

/** Padding around panel corners for the segment hull outline. */
const HULL_PADDING = 4

/**
 * Group panels by segment, expand each panel center into its four
 * corners (using panelWidth/panelHeight + padding), then compute
 * convex hulls so that even segments with 1-2 panels produce a
 * visible filled polygon.
 */
export function computeSegmentHulls(
  solarPanels: SolarPanel[],
  roofSegments: RoofSegment[],
  panelPixelPositions: Map<string, { x: number; y: number; rotation: number }>,
  visiblePanelIds: Set<string>,
  panelWidth: number,
  panelHeight: number
): SegmentHull[] {
  // Group visible panels by segmentIndex, expanding centers into corners
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

    // Expand center into 4 rotated corners
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
