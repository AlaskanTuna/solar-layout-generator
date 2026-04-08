import { useCallback, useEffect, useRef, useState } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

export function useCanvasZoom(stageSize: { width: number; height: number }) {
  const [stageScale, setStageScale] = useState(1)
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 })
  const zoomSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = e.target.getStage()
      const pointer = stage?.getPointerPosition()
      if (!pointer) return

      const direction = e.evt.deltaY > 0 ? -1 : 1
      const factor = 1.1
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stageScale * Math.pow(factor, direction)))

      const mousePointTo = {
        x: (pointer.x - stagePosition.x) / stageScale,
        y: (pointer.y - stagePosition.y) / stageScale
      }

      setStageScale(newScale)
      setStagePosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
      })
    },
    [stageScale, stagePosition]
  )

  function handleZoomIn() {
    const newScale = Math.min(MAX_ZOOM, stageScale * 1.25)
    const cx = stageSize.width / 2
    const cy = stageSize.height / 2
    const mousePointTo = { x: (cx - stagePosition.x) / stageScale, y: (cy - stagePosition.y) / stageScale }
    setStageScale(newScale)
    setStagePosition({ x: cx - mousePointTo.x * newScale, y: cy - mousePointTo.y * newScale })
  }

  function handleZoomOut() {
    const newScale = Math.max(MIN_ZOOM, stageScale / 1.25)
    const cx = stageSize.width / 2
    const cy = stageSize.height / 2
    const mousePointTo = { x: (cx - stagePosition.x) / stageScale, y: (cy - stagePosition.y) / stageScale }
    setStageScale(newScale)
    setStagePosition({ x: cx - mousePointTo.x * newScale, y: cy - mousePointTo.y * newScale })
  }

  function handleZoomReset() {
    setStageScale(1)
    setStagePosition({ x: 0, y: 0 })
  }

  useEffect(() => {
    if (zoomSnapTimerRef.current) {
      clearTimeout(zoomSnapTimerRef.current)
      zoomSnapTimerRef.current = null
    }
    if (stageScale >= 1) return

    zoomSnapTimerRef.current = setTimeout(() => {
      const duration = 300
      const startScale = stageScale
      const startPos = { ...stagePosition }
      const startTime = performance.now()

      function animate(now: number) {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / duration)
        const ease = t * (2 - t)
        const nextScale = startScale + (1 - startScale) * ease
        const nextX = startPos.x * (1 - ease)
        const nextY = startPos.y * (1 - ease)
        setStageScale(nextScale)
        setStagePosition({ x: nextX, y: nextY })
        if (t < 1) requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }, 1000)

    return () => {
      if (zoomSnapTimerRef.current) clearTimeout(zoomSnapTimerRef.current)
    }
  }, [stageScale, stagePosition])

  return {
    stageScale,
    stagePosition,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset
  }
}
