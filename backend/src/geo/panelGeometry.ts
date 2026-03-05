export function rotatePoint(origin: [number, number], point: [number, number], angleRad: number): [number, number] {
  const [ox, oy] = origin
  const [px, py] = point
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return [ox + cos * (px - ox) - sin * (py - oy), oy + sin * (px - ox) + cos * (py - oy)]
}

export function getRotatedCorners(
  cx: number,
  cy: number,
  widthPx: number,
  heightPx: number,
  rotationRad: number
): [number, number][] {
  const wHalf = widthPx / 2
  const hHalf = heightPx / 2
  const offsets: [number, number][] = [
    [-wHalf, -hHalf],
    [wHalf, -hHalf],
    [wHalf, hHalf],
    [-wHalf, hHalf]
  ]
  return offsets.map(([dx, dy]) => rotatePoint([cx, cy], [cx + dx, cy + dy], rotationRad))
}
