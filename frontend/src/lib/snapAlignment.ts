import {
  getRectAabb,
  getRotatedRectPoints,
  isAabbInsideStage,
  obbsOverlap,
  obbsOverlapWithMinSeparation
} from './canvasTransforms'

/** Single snap-target line drawn beside a dragged panel (alignment guide). */
export type SnapGuide = {
  orientation: 'horizontal' | 'vertical'
  position: number
  start: number
  end: number
}

/** Result of an alignment-snap pass — the snapped position plus all matched guides. */
export type SnapResult = {
  x: number
  y: number
  guides: SnapGuide[]
}

/** Discriminated result of overlap-snap: either a snapped position, or `{ snapped: false }`. */
export type OverlapSnapResult = { snapped: true; x: number; y: number } | { snapped: false }

type Pose = {
  x: number
  y: number
  rotation: number
}

type Translation = {
  x: number
  y: number
}

/** Result of the iterative overlap-escape pass — final position, iteration count, and whether the panel cleared every neighbor. */
export type OverlapEscapeResult = {
  x: number
  y: number
  iterations: number
  resolved: boolean
}

type PanelInfo = {
  id: string
  x: number
  y: number
  rotation: number
}

const SNAP_CONFIG: {
  threshold: number
  rotationToleranceDegrees: number
  overlapEscapeMaxIterations: number
  overlapEscapeStepRatio: number
  overlapEscapeEpsilon: number
} = {
  threshold: 14,
  rotationToleranceDegrees: 5,
  overlapEscapeMaxIterations: 30,
  overlapEscapeStepRatio: 4,
  overlapEscapeEpsilon: 1e-6
}

/**
 * Computes snapped position and guide lines for a dragged panel Uses local-axis projection to snap to nearby edges or alignment lines
 * @param {Object} dragged - Dragged value
 * @param {PanelInfo[]} others - Collection of others values
 * @param {number} panelWidth - Value used for panel width
 * @param {number} panelHeight - Value used for panel height
 * @param {number} stageWidth - Value used for stage width
 * @param {number} stageHeight - Value used for stage height
 * @returns {SnapResult} The computed snap
 */
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
  let bestUDist = SNAP_CONFIG.threshold + 1
  let bestV: { correction: number; otherX: number; otherY: number } | null = null
  let bestVDist = SNAP_CONFIG.threshold + 1

  for (const other of others) {
    if (other.id === dragged.id) continue
    const rotDiff = Math.abs(((dragged.rotation - other.rotation + 180) % 360) - 180)
    if (rotDiff > SNAP_CONFIG.rotationToleranceDegrees) continue

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
        // t = u - target: moving dragged by t along U makes new u equal target
        // Derivation: new_u = (other - (dragged + t*U)) · U = u - t, set to target => t = u - target
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
  if (bestU && bestUDist <= SNAP_CONFIG.threshold) {
    x += bestU.correction * cosR
    y += bestU.correction * sinR
    guides.push({ orientation: 'vertical', position: bestU.otherX, start: 0, end: stageHeight })
  }

  if (bestV && bestVDist <= SNAP_CONFIG.threshold) {
    x += bestV.correction * -sinR
    y += bestV.correction * cosR
    guides.push({ orientation: 'horizontal', position: bestV.otherY, start: 0, end: stageWidth })
  }

  return { x, y, guides }
}

/**
 * Correct an overlap by pushing the dragged panel along the SAT minimum-separation axis Returns a snapped position when a push-out is applied, otherwise reports no snap
 * @param {Object} dragged - Value used for dragged
 * @param {Object} neighbor - Value used for neighbor
 * @param {number} panelWidth - Value used for panel width
 * @param {number} panelHeight - Value used for panel height
 * @returns {OverlapSnapResult} The computed overlap snap
 */
export function computeOverlapSnap(
  dragged: { x: number; y: number; rotation: number },
  neighbor: { x: number; y: number; rotation: number },
  panelWidth: number,
  panelHeight: number
): OverlapSnapResult {
  const draggedPoly = getRotatedRectPoints(dragged.x, dragged.y, panelWidth, panelHeight, dragged.rotation)
  const neighborPoly = getRotatedRectPoints(neighbor.x, neighbor.y, panelWidth, panelHeight, neighbor.rotation)

  const result = obbsOverlapWithMinSeparation(draggedPoly, neighborPoly)
  if (!result) return { snapped: false } // shapes not actually overlapping

  // Push the dragged center along the SAT axis by the penetration depth
  // Add a tiny epsilon so FP slop cannot leave a false overlap behind
  const pushDistance = result.penetration + 0.01
  return {
    snapped: true,
    x: dragged.x + result.axis.x * pushDistance,
    y: dragged.y + result.axis.y * pushDistance
  }
}

function normalizeVector(x: number, y: number): Translation | null {
  const length = Math.hypot(x, y)
  if (length <= SNAP_CONFIG.overlapEscapeEpsilon) return null
  return { x: x / length, y: y / length }
}

function getPosePolygon(pose: Pose, translation: Translation, panelWidth: number, panelHeight: number) {
  return getRotatedRectPoints(pose.x + translation.x, pose.y + translation.y, panelWidth, panelHeight, pose.rotation)
}

function clampValue(value: number, min: number, max: number) {
  if (min > max) return value
  return Math.min(max, Math.max(min, value))
}

function clampTranslationToStage(
  movingPanels: Pose[],
  translation: Translation,
  panelWidth: number,
  panelHeight: number,
  stageWidth: number,
  stageHeight: number
): Translation {
  const minX = Math.max(...movingPanels.map((panel) => panelWidth / 2 - panel.x))
  const maxX = Math.min(...movingPanels.map((panel) => stageWidth - panelWidth / 2 - panel.x))
  const minY = Math.max(...movingPanels.map((panel) => panelHeight / 2 - panel.y))
  const maxY = Math.min(...movingPanels.map((panel) => stageHeight - panelHeight / 2 - panel.y))

  return {
    x: clampValue(translation.x, minX, maxX),
    y: clampValue(translation.y, minY, maxY)
  }
}

function needsStageClamp(
  movingPanels: Pose[],
  translation: Translation,
  panelWidth: number,
  panelHeight: number,
  stageWidth: number,
  stageHeight: number
) {
  return movingPanels.some((panel) => {
    const aabb = getRectAabb(getPosePolygon(panel, translation, panelWidth, panelHeight))
    return !isAabbInsideStage(aabb, stageWidth, stageHeight)
  })
}

function hasOverlapAt(
  movingPanels: Pose[],
  staticPanels: Pose[],
  translation: Translation,
  panelWidth: number,
  panelHeight: number
) {
  for (const movingPanel of movingPanels) {
    const movingPoly = getPosePolygon(movingPanel, translation, panelWidth, panelHeight)
    for (const staticPanel of staticPanels) {
      const staticPoly = getRotatedRectPoints(
        staticPanel.x,
        staticPanel.y,
        panelWidth,
        panelHeight,
        staticPanel.rotation
      )
      if (obbsOverlap(movingPoly, staticPoly)) {
        return true
      }
    }
  }

  return false
}

function computeOverlapEscapeVector(
  movingPanels: Pose[],
  staticPanels: Pose[],
  translation: Translation,
  panelWidth: number,
  panelHeight: number,
  strategy: 'sum' | 'worst' = 'sum'
): Translation | null {
  if (strategy === 'worst') {
    const candidates: Array<{
      vector: Translation
      penetration: number
    }> = []

    for (const movingPanel of movingPanels) {
      const movingCenter = {
        x: movingPanel.x + translation.x,
        y: movingPanel.y + translation.y
      }
      const movingPoly = getPosePolygon(movingPanel, translation, panelWidth, panelHeight)

      for (const staticPanel of staticPanels) {
        const staticPoly = getRotatedRectPoints(
          staticPanel.x,
          staticPanel.y,
          panelWidth,
          panelHeight,
          staticPanel.rotation
        )
        if (!obbsOverlap(movingPoly, staticPoly)) continue

        const overlap = obbsOverlapWithMinSeparation(movingPoly, staticPoly)
        if (!overlap) continue

        const away =
          normalizeVector(movingCenter.x - staticPanel.x, movingCenter.y - staticPanel.y) ??
          normalizeVector(overlap.axis.x, overlap.axis.y)
        if (!away) continue

        candidates.push({
          vector: away,
          penetration: overlap.penetration
        })
      }
    }

    if (candidates.length === 0) return null

    candidates.sort((a, b) => b.penetration - a.penetration)
    const primary = candidates[0]!
    const secondary = candidates.find((candidate, index) => {
      if (index === 0) return false
      const dot = primary.vector.x * candidate.vector.x + primary.vector.y * candidate.vector.y
      return dot > -0.5
    })

    if (!secondary) return primary.vector

    return (
      normalizeVector(
        primary.vector.x * primary.penetration + secondary.vector.x * secondary.penetration,
        primary.vector.y * primary.penetration + secondary.vector.y * secondary.penetration
      ) ?? primary.vector
    )
  }

  let sumX = 0
  let sumY = 0
  let fallback: { axis: Translation; penetration: number } | null = null

  for (const movingPanel of movingPanels) {
    const movingCenter = {
      x: movingPanel.x + translation.x,
      y: movingPanel.y + translation.y
    }
    const movingPoly = getPosePolygon(movingPanel, translation, panelWidth, panelHeight)

    for (const staticPanel of staticPanels) {
      const staticPoly = getRotatedRectPoints(
        staticPanel.x,
        staticPanel.y,
        panelWidth,
        panelHeight,
        staticPanel.rotation
      )
      if (!obbsOverlap(movingPoly, staticPoly)) continue

      const overlap = obbsOverlapWithMinSeparation(movingPoly, staticPoly)
      if (!overlap) continue

      const awayX = movingCenter.x - staticPanel.x
      const awayY = movingCenter.y - staticPanel.y
      const away = normalizeVector(awayX, awayY) ?? normalizeVector(overlap.axis.x, overlap.axis.y)
      if (!away) continue

      const weight = Math.max(overlap.penetration, 1)
      sumX += away.x * weight
      sumY += away.y * weight

      if (!fallback || overlap.penetration > fallback.penetration) {
        fallback = { axis: overlap.axis, penetration: overlap.penetration }
      }
    }
  }

  const summed = normalizeVector(sumX, sumY)
  if (summed) return summed
  return fallback ? normalizeVector(fallback.axis.x, fallback.axis.y) : null
}

function resolveOverlapTranslation(
  movingPanels: Pose[],
  staticPanels: Pose[],
  translation: Translation,
  panelWidth: number,
  panelHeight: number,
  maxIterations = SNAP_CONFIG.overlapEscapeMaxIterations,
  stepSize = panelWidth / SNAP_CONFIG.overlapEscapeStepRatio,
  strategy: 'sum' | 'worst' = 'sum',
  stageWidth = Infinity,
  stageHeight = Infinity
): OverlapEscapeResult {
  let current = { ...translation }

  for (let iter = 0; iter < maxIterations; iter += 1) {
    const hasOverlap = hasOverlapAt(movingPanels, staticPanels, current, panelWidth, panelHeight)

    if (!hasOverlap) {
      return { x: current.x, y: current.y, iterations: iter, resolved: true }
    }

    const escape = computeOverlapEscapeVector(movingPanels, staticPanels, current, panelWidth, panelHeight, strategy)
    if (!escape) break

    const proposed = {
      x: current.x + escape.x * stepSize,
      y: current.y + escape.y * stepSize
    }

    const clamped =
      Number.isFinite(stageWidth) &&
      Number.isFinite(stageHeight) &&
      needsStageClamp(movingPanels, proposed, panelWidth, panelHeight, stageWidth, stageHeight)
        ? clampTranslationToStage(movingPanels, proposed, panelWidth, panelHeight, stageWidth, stageHeight)
        : proposed
    const wasClamped = clamped.x !== proposed.x || clamped.y !== proposed.y
    current = clamped

    if (wasClamped && hasOverlapAt(movingPanels, staticPanels, current, panelWidth, panelHeight)) {
      break
    }
  }

  const resolved = !hasOverlapAt(movingPanels, staticPanels, current, panelWidth, panelHeight)

  return { x: current.x, y: current.y, iterations: maxIterations, resolved }
}

/**
 * Iteratively nudges a single dragged panel out of overlap with its neighbors using SAT push-out vectors.
 * Wraps {@link resolveGroupOverlapEscape} for the single-panel case.
 *
 * @param dragged - The panel being dragged (current pose)
 * @param neighbors - Other panels currently on the canvas
 * @param panelWidth - Panel width in pixels
 * @param panelHeight - Panel height in pixels
 * @param options - Optional iteration limits, step size, and stage bounds
 * @returns Final pose plus iteration count and a `resolved` flag (`true` when no overlap remains)
 */
export function resolveOverlapEscape(
  dragged: Pose,
  neighbors: Pose[],
  panelWidth: number,
  panelHeight: number,
  options?: { maxIterations?: number; stepSize?: number; stageWidth?: number; stageHeight?: number }
): OverlapEscapeResult {
  const result = resolveOverlapTranslation(
    [dragged],
    neighbors,
    { x: 0, y: 0 },
    panelWidth,
    panelHeight,
    options?.maxIterations,
    options?.stepSize,
    'sum',
    options?.stageWidth ?? Infinity,
    options?.stageHeight ?? Infinity
  )
  return { ...result, x: dragged.x + result.x, y: dragged.y + result.y }
}

/**
 * Iteratively translates a group of moving panels until none overlap any static panel.
 * Used for marquee-drag and multi-select rotation. Sums per-pair push-out vectors so the
 * group moves as a single rigid body.
 *
 * @param movingPanels - Group currently being dragged
 * @param staticPanels - Other panels on the canvas
 * @param translation - Tentative drag delta (overrides current pose offsets)
 * @param panelWidth - Panel width in pixels
 * @param panelHeight - Panel height in pixels
 * @param options - Optional iteration limits, step size, and stage bounds
 * @returns Final translation plus iteration count and a `resolved` flag
 */
export function resolveGroupOverlapEscape(
  movingPanels: Pose[],
  staticPanels: Pose[],
  translation: Translation,
  panelWidth: number,
  panelHeight: number,
  options?: { maxIterations?: number; stepSize?: number; stageWidth?: number; stageHeight?: number }
): OverlapEscapeResult {
  return resolveOverlapTranslation(
    movingPanels,
    staticPanels,
    translation,
    panelWidth,
    panelHeight,
    options?.maxIterations,
    options?.stepSize,
    'worst',
    options?.stageWidth ?? Infinity,
    options?.stageHeight ?? Infinity
  )
}
