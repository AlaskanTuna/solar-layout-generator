import { getRotatedRectPoints, obbsOverlapWithMinSeparation } from './canvasTransforms'

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

export type OverlapSnapResult = { snapped: true; x: number; y: number } | { snapped: false }

type PanelInfo = {
  id: string
  x: number
  y: number
  rotation: number
}

const SNAP_THRESHOLD = 14
/** Rotation difference (degrees) within which two panels are treated as same-orientation. */
const ROTATION_TOLERANCE = 5
/** Tighter rotation tolerance for overlap-snap: only snap when user clearly intended same-axis placement. */
const OVERLAP_SNAP_ROTATION_TOLERANCE = 3

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
        // t = u - target: moving dragged by t along U makes new u equal target.
        // Derivation: new_u = (other - (dragged + t*U)) · U = u - t, set to target => t = u - target.
        bestU = { correction: u - target, otherX: other.x, otherY: other.y }
      }
    }

    // Snap targets along V (height axis): edge-to-edge = +/-panelHeight, aligned = 0
    for (const target of [panelHeight, -panelHeight, 0]) {
      const dist = Math.abs(v - target)
      if (dist < bestVDist) {
        bestVDist = dist
        bestV = { correction: v - target, otherX: other.x, otherY: other.y }
      }
    }
  }

  // Apply corrections (convert local axis corrections to global X/Y deltas)
  if (bestU && bestUDist <= SNAP_THRESHOLD) {
    x += bestU.correction * cosR
    y += bestU.correction * sinR
    guides.push({ orientation: 'vertical', position: bestU.otherX, start: 0, end: stageHeight })
  }

  if (bestV && bestVDist <= SNAP_THRESHOLD) {
    x += bestV.correction * -sinR
    y += bestV.correction * cosR
    guides.push({ orientation: 'horizontal', position: bestV.otherY, start: 0, end: stageWidth })
  }

  return { x, y, guides }
}

/**
 * Overlap-as-snap-intent correction.
 *
 * Called at drag-end when the naive placement already overlaps a neighbor.
 * When rotations match within OVERLAP_SNAP_ROTATION_TOLERANCE the dragged panel is
 * auto-corrected along the SAT minimum-separation axis so it sits edge-to-edge
 * (zero gap, not overlapping) — regardless of how deep the overlap is.
 *
 * Same-rotation (within tolerance) is required because the SAT push-out direction is only
 * an unambiguous "snap to the right edge" interpretation when the panels share an axis;
 * for mismatched rotations the push direction would be arbitrary.
 *
 * Returns { snapped: true, x, y } on success, or { snapped: false } when rotations are
 * mismatched or the shapes aren't actually overlapping.
 */
export function computeOverlapSnap(
  dragged: { x: number; y: number; rotation: number },
  neighbor: { x: number; y: number; rotation: number },
  panelWidth: number,
  panelHeight: number
): OverlapSnapResult {
  const rotDiff = Math.abs(((dragged.rotation - neighbor.rotation + 180) % 360) - 180)
  if (rotDiff > OVERLAP_SNAP_ROTATION_TOLERANCE) return { snapped: false }

  const draggedPoly = getRotatedRectPoints(dragged.x, dragged.y, panelWidth, panelHeight, dragged.rotation)
  const neighborPoly = getRotatedRectPoints(neighbor.x, neighbor.y, panelWidth, panelHeight, neighbor.rotation)

  const result = obbsOverlapWithMinSeparation(draggedPoly, neighborPoly)
  if (!result) return { snapped: false } // shapes not actually overlapping

  // Push dragged center along the SAT axis by the penetration depth — lands edge-to-edge.
  // Add a tiny epsilon so FP slop can't leave the strict-> obbsOverlap check reporting overlap.
  const pushDistance = result.penetration + 0.01
  return {
    snapped: true,
    x: dragged.x + result.axis.x * pushDistance,
    y: dragged.y + result.axis.y * pushDistance
  }
}
