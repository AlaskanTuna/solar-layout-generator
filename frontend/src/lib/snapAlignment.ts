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

const SNAP_THRESHOLD = 14
const ROTATION_TOLERANCE = 5

/** Compute snapped position and guide lines for a dragged panel using local-axis projection */
export function computeSnap(
  dragged: { x: number; y: number; rotation: number; id: string },
  others: PanelInfo[],
  panelWidth: number,
  panelHeight: number,
  stageWidth: number,
  stageHeight: number
): SnapResult {
  // Clamp to stage bounds
  let x = Math.min(stageWidth - panelWidth / 2, Math.max(panelWidth / 2, dragged.x))
  let y = Math.min(stageHeight - panelHeight / 2, Math.max(panelHeight / 2, dragged.y))
  const guides: SnapGuide[] = []

  const rot = (dragged.rotation * Math.PI) / 180
  const cosR = Math.cos(rot)
  const sinR = Math.sin(rot)

  // Track best snap along panel's local U (width) and V (height) axes
  let bestU: { correction: number; otherX: number; otherY: number } | null = null
  let bestUDist = SNAP_THRESHOLD + 1
  let bestV: { correction: number; otherX: number; otherY: number } | null = null
  let bestVDist = SNAP_THRESHOLD + 1

  for (const other of others) {
    if (other.id === dragged.id) continue
    const rotDiff = Math.abs(((dragged.rotation - other.rotation + 180) % 360) - 180)
    if (rotDiff > ROTATION_TOLERANCE) continue

    // Delta from dragged center to other center, in global coords
    const dx = other.x - x
    const dy = other.y - y

    // Project onto panel's local axes
    // U = along width (cosR, sinR), V = along height (-sinR, cosR)
    const u = dx * cosR + dy * sinR
    const v = -dx * sinR + dy * cosR

    // Snap targets along U (width axis): edge-to-edge = +/-panelWidth, aligned = 0
    for (const target of [panelWidth, -panelWidth, 0]) {
      const dist = Math.abs(u - target)
      if (dist < bestUDist) {
        bestUDist = dist
        bestU = { correction: target - u, otherX: other.x, otherY: other.y }
      }
    }

    // Snap targets along V (height axis): edge-to-edge = +/-panelHeight, aligned = 0
    for (const target of [panelHeight, -panelHeight, 0]) {
      const dist = Math.abs(v - target)
      if (dist < bestVDist) {
        bestVDist = dist
        bestV = { correction: target - v, otherX: other.x, otherY: other.y }
      }
    }
  }

  // Apply corrections (convert local axis corrections to global X/Y deltas)
  if (bestU && bestUDist <= SNAP_THRESHOLD) {
    x += bestU.correction * cosR
    y += bestU.correction * sinR
    // Draw vertical guide through the aligned axis
    guides.push({ orientation: 'vertical', position: bestU.otherX, start: 0, end: stageHeight })
  }

  if (bestV && bestVDist <= SNAP_THRESHOLD) {
    x += bestV.correction * -sinR
    y += bestV.correction * cosR
    // Draw horizontal guide through the aligned axis
    guides.push({ orientation: 'horizontal', position: bestV.otherY, start: 0, end: stageWidth })
  }

  return { x, y, guides }
}
