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
  stageWidth: number
  stageHeight: number
  disabled?: boolean
  onSelect: (panelId: string) => void
  onDragEnd: (panelId: string, position: { x: number; y: number }, resetPosition: () => void) => void
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
  stageWidth,
  stageHeight,
  disabled = false,
  onSelect,
  onDragEnd
}: PanelRectProps) {
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
      opacity={0.92}
      stroke={selected ? '#fafaf9' : '#292524'}
      strokeWidth={selected ? 2.5 : 1}
      cornerRadius={4}
      shadowBlur={selected ? 12 : 4}
      shadowOpacity={selected ? 0.35 : 0.18}
      draggable={!disabled}
      dragBoundFunc={(position) => ({
        x: Math.min(stageWidth - width / 2, Math.max(width / 2, position.x)),
        y: Math.min(stageHeight - height / 2, Math.max(height / 2, position.y))
      })}
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      onDragStart={() => onSelect(id)}
      onDragEnd={(event) => {
        const node = event.target
        onDragEnd(
          id,
          { x: node.x(), y: node.y() },
          () => {
            node.position({ x, y })
            node.getLayer()?.batchDraw()
          }
        )
      }}
    />
  )
}
