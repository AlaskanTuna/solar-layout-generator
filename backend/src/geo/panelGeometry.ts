/**
 * Panel polygon construction in 2D pixel space.
 *
 * Solar panels in the workbench are stored as a centre point + width + height +
 * rotation. To sample flux underneath a panel we need its four oriented corners
 * in raster pixel coordinates. This module performs that conversion via a
 * standard 2D rotation around the panel centre.
 */

/**
 * Rotates a point around an origin by an angle in radians.
 *
 * Applies the standard 2D rotation matrix to the offset `(point - origin)`,
 * then translates back. Positive `angleRad` rotates clockwise in image space
 * (Y-down), counter-clockwise in mathematical space (Y-up).
 *
 * @param origin - The pivot point `[x, y]` to rotate around
 * @param point - The point `[x, y]` to rotate
 * @param angleRad - Rotation angle in radians
 * @returns The rotated `[x, y]` point
 */
export function rotatePoint(origin: [number, number], point: [number, number], angleRad: number): [number, number] {
  const [ox, oy] = origin
  const [px, py] = point
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return [ox + cos * (px - ox) - sin * (py - oy), oy + sin * (px - ox) + cos * (py - oy)]
}

/**
 * Builds the four corners of a rotated panel rectangle around its centre.
 *
 * The four corners are constructed from half-width / half-height offsets in
 * the panel's local (unrotated) frame, then each is rotated around the centre.
 * Corner order is top-left, top-right, bottom-right, bottom-left when the
 * rotation is zero.
 *
 * @param cx - Panel centre X in pixel space
 * @param cy - Panel centre Y in pixel space
 * @param widthPx - Panel width in pixels (along its local X axis)
 * @param heightPx - Panel height in pixels (along its local Y axis)
 * @param rotationRad - Panel rotation in radians (clockwise in image space)
 * @returns Four `[x, y]` corners in rotated pixel space
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
