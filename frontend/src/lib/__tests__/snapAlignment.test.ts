import { describe, expect, it } from 'vitest'
import { computeSnap, computeOverlapSnap, resolveGroupOverlapEscape, resolveOverlapEscape } from '../snapAlignment'
import { getRectAabb, getRotatedRectPoints, isAabbInsideStage, obbsOverlap } from '../canvasTransforms'

const W = 40
const H = 20
const STAGE = 1000

function snap(
  dragged: { x: number; y: number; rotation: number },
  others: { id: string; x: number; y: number; rotation: number }[]
) {
  return computeSnap({ ...dragged, id: 'drag' }, others, W, H, STAGE, STAGE)
}

describe('computeSnap', () => {
  describe('axis-aligned panels (rotation = 0)', () => {
    it('snaps dragged panel to right edge of neighbor with zero gap', () => {
      // Dragged is 1px short of perfect edge-to-edge to the right of neighbor at (100, 100)
      const result = snap({ x: 139, y: 100, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 0 }])
      expect(result.x).toBeCloseTo(140, 5)
      expect(result.y).toBeCloseTo(100, 5)
    })

    it('snaps dragged panel to left edge of neighbor with zero gap', () => {
      const result = snap({ x: 61, y: 100, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 0 }])
      expect(result.x).toBeCloseTo(60, 5)
      expect(result.y).toBeCloseTo(100, 5)
    })

    it('snaps dragged panel to bottom edge of neighbor with zero gap', () => {
      // Neighbor at (100, 100). Bottom-edge-to-edge: dragged center at (100, 120)
      const result = snap({ x: 100, y: 119, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 0 }])
      expect(result.x).toBeCloseTo(100, 5)
      expect(result.y).toBeCloseTo(120, 5)
    })

    it('does not snap when dragged is beyond the threshold on all axes', () => {
      // Local u=-56 (16px past the -40 U edge target) and v=40 (20px past the H target).
      // Both axes miss all snap targets by more than the 14px SNAP_THRESHOLD.
      const result = snap({ x: 156, y: 60, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 0 }])
      expect(result.x).toBeCloseTo(156, 5)
      expect(result.y).toBeCloseTo(60, 5)
      expect(result.guides).toHaveLength(0)
    })

    it('produces a snap guide when snap fires', () => {
      const result = snap({ x: 139, y: 100, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 0 }])
      expect(result.guides.length).toBeGreaterThan(0)
    })
  })

  describe('same-rotation rotated panels (30 degrees)', () => {
    const DEG = 30
    const RAD = (DEG * Math.PI) / 180
    const cosR = Math.cos(RAD)
    const sinR = Math.sin(RAD)

    it('snaps edge-to-edge along local U axis with zero gap', () => {
      // Exact edge-to-edge: other at (200, 200), dragged at (200 - W*cos30, 200 - W*sin30)
      const exactX = 200 - W * cosR
      const exactY = 200 - W * sinR
      // Perturb by (2, 1) in global space — still within threshold
      const result = snap({ x: exactX + 2, y: exactY + 1, rotation: DEG }, [{ id: 'A', x: 200, y: 200, rotation: DEG }])
      expect(result.x).toBeCloseTo(exactX, 3)
      expect(result.y).toBeCloseTo(exactY, 3)
    })

    it('snapped position produces zero gap (center distance equals panelWidth)', () => {
      const exactX = 200 - W * cosR
      const exactY = 200 - W * sinR
      const result = snap({ x: exactX + 3, y: exactY + 2, rotation: DEG }, [{ id: 'A', x: 200, y: 200, rotation: DEG }])
      const dist = Math.hypot(result.x - 200, result.y - 200)
      expect(dist).toBeCloseTo(W, 3)
    })
  })

  describe('different-rotation panels', () => {
    it('does not snap when rotation difference exceeds tolerance (5 degrees)', () => {
      // Dragged at 0°, neighbor at 10° — 10° diff > 5° tolerance
      const result = snap({ x: 139, y: 100, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 10 }])
      // No snap should fire, so x stays near 139 (only clamping applies)
      expect(result.x).toBeCloseTo(139, 5)
      expect(result.guides).toHaveLength(0)
    })

    it('snaps when rotation difference is within tolerance (3 degrees)', () => {
      // Dragged at 0°, neighbor at 3° — within 5° tolerance, so snap should fire
      const result = snap({ x: 139, y: 100, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 3 }])
      expect(result.x).not.toBeCloseTo(139, 0)
    })
  })

  describe('SAT touching-edge invariant', () => {
    it('snapped edge-to-edge panels produce center distance exactly equal to panelWidth', () => {
      // After snap, the two panel centers are exactly W apart along U.
      // getRotatedRectPoints(snappedX, 100, W, H, 0) and getRotatedRectPoints(100, 100, W, H, 0)
      // share an edge at x=120. SAT strict > means maxA(120) > minB(120) is false => no overlap.
      const result = snap({ x: 139, y: 100, rotation: 0 }, [{ id: 'A', x: 100, y: 100, rotation: 0 }])
      const centerDist = Math.abs(result.x - 100)
      expect(centerDist).toBeCloseTo(W, 5)
    })
  })
})

describe('computeOverlapSnap', () => {
  describe('axis-aligned same-rotation panels (0°)', () => {
    it('snaps a small overlap to edge-to-edge and reports snapped=true', () => {
      // Neighbor at (100,100). Dragged at (135,100) = 5px penetration on long edge.
      const result = computeOverlapSnap({ x: 135, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      // After correction panels must be exactly edge-to-edge (no overlap)
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
      // Center distance should be W plus a small epsilon buffer guarding against FP slop
      const dist = Math.hypot(result.x - 100, result.y - 100)
      expect(dist).toBeGreaterThanOrEqual(W)
      expect(dist).toBeLessThan(W + 0.1)
    })

    it('snaps a small overlap on the short edge (top/bottom) to edge-to-edge', () => {
      // H=20; neighbor at (100,100), dragged at (100,115) = 5px penetration on short edge
      const result = computeOverlapSnap({ x: 100, y: 115, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })

    it('snaps a deep overlap (> old 30% cap) to edge-to-edge when rotations match', () => {
      // Neighbor at (100,100), dragged at (110,100) = 30px penetration on long edge
      // (far beyond the old 6px short-dim cap). Should still resolve cleanly.
      const result = computeOverlapSnap({ x: 110, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })

    it('snaps even when dragged center coincides with neighbor center', () => {
      // Pathological full-overlap case — must still produce a valid non-overlapping placement.
      const result = computeOverlapSnap({ x: 100, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })

    it('returns snapped=false when shapes do not actually overlap', () => {
      // Dragged well clear of neighbor — no overlap at all
      const result = computeOverlapSnap({ x: 200, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(false)
    })
  })

  describe('mismatched-rotation snap (no rotation gating)', () => {
    it('still snaps when rotation difference is large — SAT push always converges', () => {
      // 30° difference — push along SAT min-separation axis until shapes don't overlap.
      const result = computeOverlapSnap({ x: 110, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 30 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 30)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })

    it('still snaps when rotation difference is small (was within old 3° tolerance)', () => {
      const result = computeOverlapSnap({ x: 135, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 2 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 2)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })

    it('clears overlap even at near-perpendicular rotations (45°)', () => {
      const result = computeOverlapSnap({ x: 105, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 45 }, W, H)
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
      const neighborPoly = getRotatedRectPoints(100, 100, W, H, 45)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })
  })

  describe('rotated panels (30°)', () => {
    it('snaps a small overlap between same-rotation rotated panels to edge-to-edge', () => {
      const DEG = 30
      const RAD = (DEG * Math.PI) / 180
      // Exact edge-to-edge position of dragged relative to neighbor at (200,200)
      const exactX = 200 - W * Math.cos(RAD)
      const exactY = 200 - W * Math.sin(RAD)
      // Push 4px into overlap along local U axis
      const overlapX = exactX + 4 * Math.cos(RAD)
      const overlapY = exactY + 4 * Math.sin(RAD)

      const result = computeOverlapSnap(
        { x: overlapX, y: overlapY, rotation: DEG },
        { x: 200, y: 200, rotation: DEG },
        W,
        H
      )
      expect(result.snapped).toBe(true)
      if (!result.snapped) return
      const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, DEG)
      const neighborPoly = getRotatedRectPoints(200, 200, W, H, DEG)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    })
  })
})

describe('resolveOverlapEscape', () => {
  it('clamps a blocked edge escape to the stage and can preserve residual overlap', () => {
    const result = resolveOverlapEscape(
      { x: 20, y: 50, rotation: 0 },
      [{ x: 45, y: 50, rotation: 0 }],
      W,
      H,
      { stageWidth: 100, stageHeight: 100 }
    )

    expect(result.x).toBeCloseTo(W / 2, 5)
    expect(result.y).toBeCloseTo(50, 5)

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
    const neighborPoly = getRotatedRectPoints(45, 50, W, H, 0)
    expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(true)
    expect(result.resolved).toBe(false)
  })

  it('keeps the dragged center inside the left stage boundary when the escape vector points left', () => {
    const result = resolveOverlapEscape(
      { x: 22, y: 50, rotation: 0 },
      [{ x: 50, y: 50, rotation: 0 }],
      W,
      H,
      { stageWidth: 100, stageHeight: 100 }
    )

    expect(result.x).toBeGreaterThanOrEqual(W / 2)
    expect(result.x).toBeLessThanOrEqual(100 - W / 2)
  })

  it('clears same-rotation overlap after repeated centroid-based escapes', () => {
    const result = resolveOverlapEscape(
      { x: 135, y: 100, rotation: 0 },
      [{ x: 100, y: 100, rotation: 0 }],
      W,
      H
    )

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
    const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)

    expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
  })

  it('clears overlap between 30° and 45° panels', () => {
    const result = resolveOverlapEscape(
      { x: 100, y: 100, rotation: 30 },
      [{ x: 100, y: 100, rotation: 45 }],
      W,
      H
    )

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 30)
    const neighborPoly = getRotatedRectPoints(100, 100, W, H, 45)

    expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
  })

  it('clears the centroid-coincident pathological case', () => {
    const result = resolveOverlapEscape(
      { x: 100, y: 100, rotation: 0 },
      [{ x: 100, y: 100, rotation: 0 }],
      W,
      H
    )

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
    const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)

    expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
  })

  it('escapes a sandwiched panel with three overlapping neighbors', () => {
    const result = resolveOverlapEscape(
      { x: 100, y: 100, rotation: 0 },
      [
        { x: 88, y: 100, rotation: 0 },
        { x: 112, y: 100, rotation: 0 },
        { x: 100, y: 88, rotation: 0 }
      ],
      W,
      H
    )

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
    for (const neighbor of [
      { x: 88, y: 100, rotation: 0 },
      { x: 112, y: 100, rotation: 0 },
      { x: 100, y: 88, rotation: 0 }
    ]) {
      const neighborPoly = getRotatedRectPoints(neighbor.x, neighbor.y, W, H, neighbor.rotation)
      expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
    }
  })

  it('clears a tiny overlap smaller than one pixel', () => {
    const result = resolveOverlapEscape(
      { x: 139.6, y: 100, rotation: 0 },
      [{ x: 100, y: 100, rotation: 0 }],
      W,
      H
    )

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
    const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)

    expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
  })

  it('still resolves overlap when stage bounds are omitted', () => {
    const result = resolveOverlapEscape(
      { x: 135, y: 100, rotation: 0 },
      [{ x: 100, y: 100, rotation: 0 }],
      W,
      H
    )

    const draggedPoly = getRotatedRectPoints(result.x, result.y, W, H, 0)
    const neighborPoly = getRotatedRectPoints(100, 100, W, H, 0)

    expect(obbsOverlap(draggedPoly, neighborPoly)).toBe(false)
  })
})

describe('resolveGroupOverlapEscape', () => {
  it('moves a rigid group clear of a single overlapping neighbor', () => {
    const result = resolveGroupOverlapEscape(
      [
        { x: 100, y: 100, rotation: 0 },
        { x: 140, y: 100, rotation: 0 }
      ],
      [
        { x: 72, y: 100, rotation: 0 }
      ],
      { x: 0, y: 0 },
      W,
      H
    )

    const movedPanels = [
      { x: 100 + result.x, y: 100 + result.y, rotation: 0 },
      { x: 140 + result.x, y: 100 + result.y, rotation: 0 }
    ]

    for (const moving of movedPanels) {
      const movingPoly = getRotatedRectPoints(moving.x, moving.y, W, H, moving.rotation)
      const neighborPoly = getRotatedRectPoints(72, 100, W, H, 0)
      expect(obbsOverlap(movingPoly, neighborPoly)).toBe(false)
    }
  })

  it('clamps a rigid group in-bounds when an escape step would leave the canvas', () => {
    const movingPanels = [
      { x: 20, y: 10, rotation: 0 },
      { x: 60, y: 10, rotation: 0 }
    ]

    const result = resolveGroupOverlapEscape(
      movingPanels,
      [{ x: 35, y: 20, rotation: 0 }],
      { x: 0, y: 0 },
      W,
      H,
      { stageWidth: 100, stageHeight: 100 }
    )

    const translatedPanels = movingPanels.map((panel) => ({
      x: panel.x + result.x,
      y: panel.y + result.y,
      rotation: panel.rotation
    }))

    for (const moving of translatedPanels) {
      const movingPoly = getRotatedRectPoints(moving.x, moving.y, W, H, moving.rotation)
      expect(isAabbInsideStage(getRectAabb(movingPoly), 100, 100)).toBe(true)
    }
  })
})
