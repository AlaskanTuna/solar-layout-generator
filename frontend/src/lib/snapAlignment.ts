import { getRotatedRectPoints, getRectAabb } from './canvasTransforms'

export type SnapGuide = {
  orientation: 'horizontal' | 'vertical'
  position: number
  start: number
  end: number
}

export type SnapResult = {
  x: number
  y: number
  guides: SnapGuide[]
}

type PanelInfo = {
  id: string
  x: number
  y: number
  rotation: number
}

const SNAP_THRESHOLD = 8
const ROTATION_TOLERANCE = 5

/**
 * Given a panel being dragged, compute snapped position and guide lines
 * by comparing its AABB edges against all other visible panels with
 * similar rotation. Returns the adjusted (x, y) and any guide lines
 * to render on the canvas.
 */
export function computeSnap(
  dragged: { x: number; y: number; rotation: number; id: string },
  others: PanelInfo[],
  panelWidth: number,
  panelHeight: number,
  stageWidth: number,
  stageHeight: number
): SnapResult {
  let x = Math.min(stageWidth - panelWidth / 2, Math.max(panelWidth / 2, dragged.x))
  let y = Math.min(stageHeight - panelHeight / 2, Math.max(panelHeight / 2, dragged.y))
  const guides: SnapGuide[] = []

  const draggedAabb = getRectAabb(getRotatedRectPoints(x, y, panelWidth, panelHeight, dragged.rotation))

  let bestSnapX: { dx: number; guidePos: number } | null = null
  let bestSnapXDist = SNAP_THRESHOLD + 1
  let bestSnapY: { dy: number; guidePos: number } | null = null
  let bestSnapYDist = SNAP_THRESHOLD + 1

  for (const other of others) {
    if (other.id === dragged.id) continue

    const rotDiff = Math.abs(((dragged.rotation - other.rotation + 180) % 360) - 180)
    if (rotDiff > ROTATION_TOLERANCE) continue

    const otherAabb = getRectAabb(getRotatedRectPoints(other.x, other.y, panelWidth, panelHeight, other.rotation))

    const xPairs: [number, number][] = [
      [draggedAabb.minX, otherAabb.minX],
      [draggedAabb.minX, otherAabb.maxX],
      [draggedAabb.maxX, otherAabb.minX],
      [draggedAabb.maxX, otherAabb.maxX]
    ]

    for (const [dEdge, oEdge] of xPairs) {
      const dist = Math.abs(dEdge - oEdge)
      if (dist < bestSnapXDist) {
        bestSnapXDist = dist
        bestSnapX = { dx: oEdge - dEdge, guidePos: oEdge }
      }
    }

    const yPairs: [number, number][] = [
      [draggedAabb.minY, otherAabb.minY],
      [draggedAabb.minY, otherAabb.maxY],
      [draggedAabb.maxY, otherAabb.minY],
      [draggedAabb.maxY, otherAabb.maxY]
    ]

    for (const [dEdge, oEdge] of yPairs) {
      const dist = Math.abs(dEdge - oEdge)
      if (dist < bestSnapYDist) {
        bestSnapYDist = dist
        bestSnapY = { dy: oEdge - dEdge, guidePos: oEdge }
      }
    }
  }

  if (bestSnapX && bestSnapXDist <= SNAP_THRESHOLD) {
    x += bestSnapX.dx
    guides.push({ orientation: 'vertical', position: bestSnapX.guidePos, start: 0, end: stageHeight })
  }

  if (bestSnapY && bestSnapYDist <= SNAP_THRESHOLD) {
    y += bestSnapY.dy
    guides.push({ orientation: 'horizontal', position: bestSnapY.guidePos, start: 0, end: stageWidth })
  }

  return { x, y, guides }
}
