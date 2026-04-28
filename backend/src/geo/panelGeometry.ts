/**
 * Rotate a point around an origin in pixel space
 * @param {[number, number]} origin - Value used for origin
 * @param {[number, number]} point - Value used for point
 * @param {number} angleRad - Value used for angle rad
 * @returns {[number, number]} The resulting rotate point value
 */
export function rotatePoint(origin: [number, number], point: [number, number], angleRad: number): [number, number] {
  const [ox, oy] = origin
  const [px, py] = point
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return [ox + cos * (px - ox) - sin * (py - oy), oy + sin * (px - ox) + cos * (py - oy)]
}

/**
 * Builds the four rotated panel corners around a center point
 * @param {number} cx - Value used for cx
 * @param {number} cy - Value used for cy
 * @param {number} widthPx - Value used for width px
 * @param {number} heightPx - Value used for height px
 * @param {number} rotationRad - Value used for rotation rad
 * @returns {[number, number][]} The requested rotated corners
 */
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
