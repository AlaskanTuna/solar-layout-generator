/**
 * Konva stage sizing hook for the workbench canvas.
 *
 * Computes the stage width/height that fits the satellite image into the
 * available container space without distorting its aspect ratio. Tracks both
 * container resizes (via `ResizeObserver`) and viewport resizes.
 *
 * The magic numbers `64` (horizontal padding) and `280` (header + chrome
 * height) match the workbench page layout — adjust together with the page
 * shell if the chrome ever changes.
 */

import { useEffect, useState, type RefObject } from 'react'

/**
 * Returns `{ width, height }` for the Konva stage given the container ref
 * and the loaded satellite image. Returns `{ 0, 0 }` while either is missing.
 *
 * @param containerRef - Ref to the canvas's wrapper div
 * @param image - Loaded satellite image (or `null` while loading)
 */
export function useStageSize(containerRef: RefObject<HTMLDivElement | null>, image: HTMLImageElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current || !image) {
      setSize({ width: 0, height: 0 })
      return
    }

    const element = containerRef.current

    const update = () => {
      // 64 px ≈ workbench horizontal padding; 280 px ≈ top chrome (nav + page
      // header + canvas toolbar). Both values are baked into the workbench
      // page shell — keep in sync if the layout changes.
      const maxWidth = Math.max(element.clientWidth - 64, 1)
      const maxHeight = Math.max(window.innerHeight - 280, 200)
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height)

      setSize({
        width: Math.max(1, Math.round(image.width * scale)),
        height: Math.max(1, Math.round(image.height * scale))
      })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [containerRef, image])

  return size
}
