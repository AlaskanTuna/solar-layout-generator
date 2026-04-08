import { describe, it, expect } from 'vitest'
import { rotatePoint, getRotatedCorners } from '../panelGeometry.js'

describe('rotatePoint', () => {
  it('returns same point for 0 rotation', () => {
    const result = rotatePoint([5, 5], [10, 5], 0)
    expect(result[0]).toBeCloseTo(10)
    expect(result[1]).toBeCloseTo(5)
  })

  it('rotates 90 degrees correctly', () => {
    // Rotating (10, 5) around (5, 5) by 90° should give (5, 10)
    const result = rotatePoint([5, 5], [10, 5], Math.PI / 2)
    expect(result[0]).toBeCloseTo(5)
    expect(result[1]).toBeCloseTo(10)
  })

  it('rotates 180 degrees correctly', () => {
    const result = rotatePoint([5, 5], [10, 5], Math.PI)
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(5)
  })
})

describe('getRotatedCorners', () => {
  it('returns 4 corners for axis-aligned rectangle (0 rotation)', () => {
    const corners = getRotatedCorners(10, 10, 4, 2, 0)
    expect(corners).toHaveLength(4)

    // Width 4, height 2, centered at (10, 10)
    // Corners should be: (8,9), (12,9), (12,11), (8,11)
    expect(corners[0][0]).toBeCloseTo(8)
    expect(corners[0][1]).toBeCloseTo(9)
    expect(corners[1][0]).toBeCloseTo(12)
    expect(corners[1][1]).toBeCloseTo(9)
    expect(corners[2][0]).toBeCloseTo(12)
    expect(corners[2][1]).toBeCloseTo(11)
    expect(corners[3][0]).toBeCloseTo(8)
    expect(corners[3][1]).toBeCloseTo(11)
  })

  it('returns rotated corners for 90 degree rotation', () => {
    const corners = getRotatedCorners(10, 10, 4, 2, Math.PI / 2)
    expect(corners).toHaveLength(4)

    // After 90° rotation, width and height swap visually
    // (-2, -1) rotated 90° becomes (1, -2), so corner at (11, 8)
    expect(corners[0][0]).toBeCloseTo(11)
    expect(corners[0][1]).toBeCloseTo(8)
  })

  it('preserves distance from center for 45 degree rotation', () => {
    const corners = getRotatedCorners(0, 0, 4, 2, Math.PI / 4)
    const expectedDist = Math.sqrt(4 + 1) // sqrt(2² + 1²)

    for (const [x, y] of corners) {
      const dist = Math.sqrt(x * x + y * y)
      expect(dist).toBeCloseTo(expectedDist)
    }
  })
})
