import { useState } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'

type PanelRectProps = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fill: string
  selected: boolean
  multiSelected?: boolean
  stageWidth: number
  stageHeight: number
  disabled?: boolean
  snapEnabled?: boolean
  onSnapDragMove?: (panelId: string, position: { x: number; y: number }) => { x: number; y: number }
  onSelect: (panelId: string, shiftKey: boolean) => void
  onDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) => void
  onRotate?: (panelId: string, rotation: number) => void
}

const HANDLE_RADIUS = 5
const HANDLE_DISTANCE = 18

function getCursor(disabled: boolean, selected: boolean): string {
  if (disabled) return 'not-allowed'
  if (selected) return 'move'
  return 'pointer'
}

export function PanelRect({
  id,
  x,
  y,
  width,
  height,
  rotation,
  fill,
  selected,
  multiSelected = false,
  stageWidth,
  stageHeight,
  disabled = false,
  snapEnabled = false,
  onSnapDragMove,
  onSelect,
  onDragEnd,
  onRotate
}: PanelRectProps) {
  const [hovered, setHovered] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  const opacity = disabled ? 0.5 : hovered && !selected ? 0.96 : 0.92
  const stroke = multiSelected ? '#22d3ee' : selected ? '#ffffff' : hovered ? 'rgba(255, 255, 255, 0.6)' : '#292524'
  const strokeWidth = selected ? 1.5 : hovered ? 1 : 1
  const shadowBlur = selected ? 16 : hovered ? 8 : 4
  const shadowOpacity = selected ? 0.45 : hovered ? 0.25 : 0.18

  const showHandle = (selected || multiSelected) && !disabled && !!onRotate

  // Handle position in panel-local coords (above the panel center)
  const handleLocalY = -(height / 2 + HANDLE_DISTANCE)

  function handleRotationDrag(e: KonvaEventObject<DragEvent>) {
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    // Angle from panel center (x, y) to pointer position
    const dx = pointer.x - x
    const dy = pointer.y - y
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90 // 0° = up
    angleDeg = ((angleDeg % 360) + 360) % 360
    const snapped = Math.round(angleDeg / 5) * 5

    onRotate?.(id, snapped)
    setIsRotating(true)

    // Reset handle to its local position (don't let it actually move freely)
    e.target.position({ x: 0, y: handleLocalY })
  }

  return (
    <Group x={x} y={y} rotation={rotation} offsetX={0} offsetY={0}>
      {/* Panel body */}
      <Rect
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
        fill={fill}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        shadowBlur={shadowBlur}
        shadowOpacity={shadowOpacity}
      />

      {/* Rotation handle (only when selected) */}
      {showHandle && (
        <>
          <Line points={[0, -height / 2, 0, handleLocalY]} stroke="#ffffff" strokeWidth={1} opacity={0.4} />
          <Circle
            x={0}
            y={handleLocalY}
            radius={HANDLE_RADIUS}
            fill="#ffffff"
            stroke="#ea580c"
            strokeWidth={1.5}
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
            onDragMove={handleRotationDrag}
            onDragEnd={() => setIsRotating(false)}
          />
          <Text
            x={HANDLE_RADIUS + 3}
            y={handleLocalY - 6}
            text={`${Math.round(rotation)}°`}
            fontSize={10}
            fontFamily="monospace"
            fill={isRotating ? '#ffffff' : 'rgba(255,255,255,0.55)'}
          />
        </>
      )}

      {/* Invisible hit area for drag + click (covers the panel) */}
      <Rect
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
        fill="transparent"
        draggable={!disabled}
        dragBoundFunc={(position) => {
          // position is in group-local coords; convert to stage for clamping
          const rad = (rotation * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)
          const stageX = x + position.x * cos - position.y * sin
          const stageY = y + position.x * sin + position.y * cos

          const clamped = {
            x: Math.min(stageWidth - width / 2, Math.max(width / 2, stageX)),
            y: Math.min(stageHeight - height / 2, Math.max(height / 2, stageY))
          }

          let finalStage = clamped
          if (snapEnabled && onSnapDragMove) {
            finalStage = onSnapDragMove(id, clamped)
          }

          // Convert back to group-local
          const dx = finalStage.x - x
          const dy = finalStage.y - y
          return {
            x: dx * cos + dy * sin,
            y: -dx * sin + dy * cos
          }
        }}
        onMouseEnter={(e) => {
          setHovered(true)
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = getCursor(disabled, selected)
        }}
        onMouseLeave={(e) => {
          setHovered(false)
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = 'default'
        }}
        onClick={(e) => onSelect(id, e.evt.shiftKey)}
        onTap={() => onSelect(id, false)}
        onDragStart={() => {
          if (!selected) onSelect(id, false)
        }}
        onDragEnd={(e) => {
          const node = e.target
          const rad = (rotation * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)
          const lx = node.x()
          const ly = node.y()
          const stageX = x + lx * cos - ly * sin
          const stageY = y + lx * sin + ly * cos

          onDragEnd(id, { x: stageX, y: stageY }, () => {
            node.position({ x: 0, y: 0 })
            node.getLayer()?.batchDraw()
          })
        }}
      />
    </Group>
  )
}
