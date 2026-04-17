import { useState } from 'react'
import { Circle, Group, Line, Path } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'

type GroupPanel = {
  id: string
  x: number
  y: number
  rotation: number
}

type GroupRotationHandleProps = {
  panels: GroupPanel[]
  panelWidth: number
  panelHeight: number
  snapDegrees?: number
  onRotate: (panelId: string, rotation: number) => void
}

const HANDLE_DISTANCE = 24
const HANDLE_RADIUS = 9

export function GroupRotationHandle({
  panels,
  panelWidth,
  panelHeight,
  snapDegrees = 5,
  onRotate
}: GroupRotationHandleProps) {
  const [isRotating, setIsRotating] = useState(false)

  if (panels.length < 2) return null

  const xs = panels.map((p) => p.x)
  const ys = panels.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const maxPanelDist = Math.max(...panels.map((p) => Math.hypot(p.x - cx, p.y - cy)))
  const panelHalfDiag = Math.hypot(panelWidth, panelHeight) / 2
  const dist = maxPanelDist + panelHalfDiag + HANDLE_DISTANCE

  const rotation = panels[0]!.rotation
  const rad = (rotation * Math.PI) / 180
  const handleX = cx + -dist * Math.sin(-rad)
  const handleY = cy + -dist * Math.cos(-rad)

  const edgeDist = dist - HANDLE_DISTANCE
  const edgeX = cx + -edgeDist * Math.sin(-rad)
  const edgeY = cy + -edgeDist * Math.cos(-rad)

  const representativeId = panels[0]!.id

  function handleDragMove(e: KonvaEventObject<DragEvent>) {
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const dx = pointer.x - cx
    const dy = pointer.y - cy
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    angleDeg = ((angleDeg % 360) + 360) % 360
    const snapped = Math.round(angleDeg / snapDegrees) * snapDegrees

    onRotate(representativeId, snapped)
    setIsRotating(true)

    e.target.position({ x: handleX, y: handleY })
  }

  return (
    <Group listening>
      <Line
        points={[edgeX, edgeY, handleX, handleY]}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
        listening={false}
      />
      <Circle
        x={handleX}
        y={handleY}
        radius={HANDLE_RADIUS}
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
          e.target.position({ x: handleX, y: handleY })
        }}
      />
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
