import { describe, it, expect } from 'vitest'
import { pointInPolygon, calculateAverageFlux } from './fluxSampler.js'

describe('pointInPolygon', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ]

  it('detects point inside polygon', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true)
  })

  it('detects point outside polygon', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false)
    expect(pointInPolygon(-1, 5, square)).toBe(false)
    expect(pointInPolygon(5, -1, square)).toBe(false)
    expect(pointInPolygon(5, 11, square)).toBe(false)
  })

  it('handles point just inside edge', () => {
    expect(pointInPolygon(0.5, 0.5, square)).toBe(true)
    expect(pointInPolygon(9.5, 9.5, square)).toBe(true)
  })

  it('works with rotated polygon', () => {
    // Diamond shape (square rotated 45°)
    const diamond: [number, number][] = [
      [5, 0],
      [10, 5],
      [5, 10],
      [0, 5]
    ]
    expect(pointInPolygon(5, 5, diamond)).toBe(true)
    expect(pointInPolygon(1, 1, diamond)).toBe(false)
    expect(pointInPolygon(9, 9, diamond)).toBe(false)
  })
})

describe('calculateAverageFlux', () => {
  it('calculates correct average for uniform flux', () => {
    const width = 10
    const height = 10
    // All pixels have flux value 100
    const fluxData = new Float32Array(width * height).fill(100)

    const corners: [number, number][] = [
      [2, 2],
      [5, 2],
      [5, 5],
      [2, 5]
    ]

    const avg = calculateAverageFlux(corners, fluxData, width, height)
    expect(avg).toBeCloseTo(100)
  })

  it('returns 0 for empty polygon (no pixels inside)', () => {
    const width = 10
    const height = 10
    const fluxData = new Float32Array(width * height).fill(100)

    // Very small polygon that contains no pixel centers
    const corners: [number, number][] = [
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
      [0, 0.1]
    ]

    const avg = calculateAverageFlux(corners, fluxData, width, height)
    expect(avg).toBe(0)
  })

  it('correctly averages non-uniform flux', () => {
    const width = 4
    const height = 4
    // Create a flux raster where value = row index * 10
    const fluxData = new Float32Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        fluxData[y * width + x] = y * 10
      }
    }

    // Cover rows 1 and 2 (values 10 and 20), columns 0-3
    const corners: [number, number][] = [
      [0, 1],
      [4, 1],
      [4, 3],
      [0, 3]
    ]

    const avg = calculateAverageFlux(corners, fluxData, width, height)
    // Pixel centers at y=1.5 (row 1, value 10) and y=2.5 (row 2, value 20)
    // All 8 pixels should be inside (4 per row)
    expect(avg).toBeCloseTo(15) // (10+10+10+10+20+20+20+20)/8 = 15
  })

  it('clips to raster bounds', () => {
    const width = 5
    const height = 5
    const fluxData = new Float32Array(width * height).fill(50)

    // Polygon extends beyond raster bounds
    const corners: [number, number][] = [
      [-5, -5],
      [10, -5],
      [10, 10],
      [-5, 10]
    ]

    const avg = calculateAverageFlux(corners, fluxData, width, height)
    expect(avg).toBeCloseTo(50)
  })
})
