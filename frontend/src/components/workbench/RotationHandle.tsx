import { useState } from 'react'
import { Circle, Group, Line, Path } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { ROTATION_HANDLE_METRICS } from '@/lib/workbench/handleMetrics'

type RotationHandleProps = {
  panelId: string
  panelX: number
  panelY: number
  panelWidth: number
  panelHeight: number
  rotation: number
  snapDegrees?: number
  onRotate: (panelId: string, rotation: number) => void
}

/**
 * Renders the RotationHandle component
 * @param {RotationHandleProps} props - Props for the component
 */
export function RotationHandle({
  panelId,
  snapDegrees = 5,
  panelX,
  panelY,
  panelWidth,
  panelHeight,
  rotation,
  onRotate
}: RotationHandleProps) {
  const [isRotating, setIsRotating] = useState(false)

  // Compute handle position in stage coords (above the panel, accounting for rotation)
  const rad = (rotation * Math.PI) / 180
  const dist = panelHeight / 2 + ROTATION_HANDLE_METRICS.distance
  // "Above" the panel in its local space = negative Y, rotated into stage space
  const handleX = panelX + -dist * Math.sin(-rad)
  const handleY = panelY + -dist * Math.cos(-rad)

  // Line endpoint: panel top edge center (in stage coords)
  const edgeDist = panelHeight / 2
  const edgeX = panelX + -edgeDist * Math.sin(-rad)
  const edgeY = panelY + -edgeDist * Math.cos(-rad)

  function handleDragMove(e: KonvaEventObject<DragEvent>) {
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const dx = pointer.x - panelX
    const dy = pointer.y - panelY
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    angleDeg = ((angleDeg % 360) + 360) % 360
    const snapped = Math.round(angleDeg / snapDegrees) * snapDegrees

    onRotate(panelId, snapped)
    setIsRotating(true)

    // Reset handle position — the parent re-renders with new rotation
    e.target.position({ x: handleX, y: handleY })
  }

  return (
    <Group listening>
      {/* Connector line from panel edge to handle */}
      <Line
        points={[edgeX, edgeY, handleX, handleY]}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
        listening={false}
      />

      {/* Rotation handle circle with rotate icon */}
      <Circle
        x={handleX}
        y={handleY}
        radius={ROTATION_HANDLE_METRICS.radius}
        fill={isRotating ? '#ea580c' : '#ffffff'}
        stroke={isRotating ? '#ffffff' : '#ea580c'}
        strokeWidth={1.5}
        shadowBlur={6}
        shadowOpacity={0.3}
        shadowColor="#000000"
        draggable
        onMouseEnter={(e) => {
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = 'grab'
        }}
        onMouseLeave={(e) => {
          if (!isRotating) {
            const c = e.target.getStage()?.container()
            if (c) c.style.cursor = 'default'
          }
        }}
        onDragStart={() => setIsRotating(true)}
        onDragMove={handleDragMove}
        onDragEnd={(e) => {
          setIsRotating(false)
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = 'default'
          // Reset position to computed handle location
          e.target.position({ x: handleX, y: handleY })
        }}
      />

      {/* Rotate icon (↻) inside the handle — SVG path scaled to fit */}
      <Path
        x={handleX - 5}
        y={handleY - 5}
        data="M7.5 1.5a6 6 0 0 1 4.24 10.24M11.74 11.74L10 10m1.74 1.74L10 13.5m1.74-1.76L13.5 10M1.5 7.5A6 6 0 0 1 7.5 1.5"
        stroke={isRotating ? '#ffffff' : '#ea580c'}
        strokeWidth={1.2}
        scaleX={0.7}
        scaleY={0.7}
        listening={false}
      />
    </Group>
  )
}
