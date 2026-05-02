import { memo, useState } from 'react'
import { Rect } from 'react-konva'

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
  onDragStart?: (panelId: string) => void
  onDragMove?: (panelId: string, position: { x: number; y: number }) => void
  onDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) => void
}

function getCursor(disabled: boolean, selected: boolean): string {
  if (disabled) return 'not-allowed'
  if (selected) return 'move'
  return 'pointer'
}

/** Single Konva Rect for one solar panel. Memoized so unrelated parent re-renders don't cascade. */
function PanelRectInternal({
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
  onDragStart,
  onDragMove,
  onDragEnd
}: PanelRectProps) {
  const [hovered, setHovered] = useState(false)

  const opacity = disabled ? 0.5 : hovered && !selected ? 0.96 : 0.92
  const stroke = multiSelected ? '#22d3ee' : selected ? '#ffffff' : hovered ? 'rgba(255, 255, 255, 0.6)' : '#292524'
  const strokeWidth = selected ? 1.5 : hovered ? 1 : 1
  const shadowBlur = selected ? 16 : hovered ? 8 : 4
  const shadowOpacity = selected ? 0.45 : hovered ? 0.25 : 0.18

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      fill={fill}
      opacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      cornerRadius={0}
      shadowBlur={shadowBlur}
      shadowOpacity={shadowOpacity}
      draggable={!disabled}
      dragBoundFunc={(position) => {
        const clamped = {
          x: Math.min(stageWidth - width / 2, Math.max(width / 2, position.x)),
          y: Math.min(stageHeight - height / 2, Math.max(height / 2, position.y))
        }
        if (snapEnabled && onSnapDragMove) {
          return onSnapDragMove(id, clamped)
        }
        return clamped
      }}
      onMouseEnter={(event) => {
        setHovered(true)
        const container = event.target.getStage()?.container()
        if (container) container.style.cursor = getCursor(disabled, selected)
      }}
      onMouseLeave={(event) => {
        setHovered(false)
        const container = event.target.getStage()?.container()
        if (container) container.style.cursor = 'default'
      }}
      onClick={(e) => onSelect(id, e.evt.shiftKey)}
      onTap={() => onSelect(id, false)}
      onDragStart={() => {
        if (!selected) onSelect(id, false)
        onDragStart?.(id)
      }}
      onDragMove={(event) => {
        if (!onDragMove) return
        const node = event.target
        onDragMove(id, { x: node.x(), y: node.y() })
      }}
      onDragEnd={(event) => {
        const node = event.target
        onDragEnd(id, { x: node.x(), y: node.y() }, () => {
          node.position({ x, y })
          node.getLayer()?.batchDraw()
        })
      }}
    />
  )
}

export const PanelRect = memo(PanelRectInternal)
