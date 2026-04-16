import { describe, expect, it } from 'vitest'
import { computeSnap, computeOverlapSnap } from '../snapAlignment'
import { getRotatedRectPoints, obbsOverlap } from '../canvasTransforms'

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
      // Center distance should equal W
      expect(Math.hypot(result.x - 100, result.y - 100)).toBeCloseTo(W, 3)
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

    it('returns snapped=false when overlap exceeds 30% of short dimension', () => {
      // Short dim = H = 20; 30% = 6px. Overlap of 8px exceeds threshold.
      // Neighbor at (100,100), dragged at (132,100) = 8px penetration on long edge
      const result = computeOverlapSnap({ x: 132, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(false)
    })

    it('returns snapped=false when shapes do not actually overlap', () => {
      // Dragged well clear of neighbor — no overlap at all
      const result = computeOverlapSnap({ x: 200, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 0 }, W, H)
      expect(result.snapped).toBe(false)
    })
  })

  describe('rotation gating', () => {
    it('returns snapped=false when rotation difference exceeds 3°', () => {
      // 4° difference — beyond the 3° overlap-snap tolerance
      const result = computeOverlapSnap({ x: 135, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 4 }, W, H)
      expect(result.snapped).toBe(false)
    })

    it('snaps when rotation difference is within 3°', () => {
      // 2° difference — within tolerance
      const result = computeOverlapSnap({ x: 135, y: 100, rotation: 0 }, { x: 100, y: 100, rotation: 2 }, W, H)
      expect(result.snapped).toBe(true)
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
