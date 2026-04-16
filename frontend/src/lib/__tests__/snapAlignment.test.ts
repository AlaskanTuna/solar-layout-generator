import { describe, expect, it } from 'vitest'
import { computeSnap } from '../snapAlignment'

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
      const result = snap(
        { x: exactX + 2, y: exactY + 1, rotation: DEG },
        [{ id: 'A', x: 200, y: 200, rotation: DEG }]
      )
      expect(result.x).toBeCloseTo(exactX, 3)
      expect(result.y).toBeCloseTo(exactY, 3)
    })

    it('snapped position produces zero gap (center distance equals panelWidth)', () => {
      const exactX = 200 - W * cosR
      const exactY = 200 - W * sinR
      const result = snap(
        { x: exactX + 3, y: exactY + 2, rotation: DEG },
        [{ id: 'A', x: 200, y: 200, rotation: DEG }]
      )
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
