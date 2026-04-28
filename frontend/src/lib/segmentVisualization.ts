import type { SolarPanel, RoofSegment } from './buildingInsights'

/**
 * Defines the SegmentHull type
 */
export type SegmentHull = {
  segmentIndex: number
  azimuth: number
  pitch: number
  panelCount: number
  hullPoints: { x: number; y: number }[]
  color: string
}

/**
 * Maps azimuth angle to an HSL colour
 * @param {number} azimuth - Value used for azimuth
 * @returns {string} The resulting azimuth color value
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
 * Computes convex hull of 2D points
 * @param {Array} points - Collection of points values
 * @returns {Array} The resulting collection
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
 * Defines the computeSegmentHulls function
 * @param {SolarPanel[]} solarPanels - Collection of solar panels values
 * @param {RoofSegment[]} roofSegments - Collection of roof segments values
 * @param {Map<string, { x: number; y: number; rotation: number }>} panelPixelPositions - Panel pixel positions value
 * @param {Set<string>} visiblePanelIds - Visible panel identifiers
 * @param {number} panelWidth - Value used for panel width
 * @param {number} panelHeight - Value used for panel height
 * @returns {SegmentHull[]} The computed segment hulls
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
