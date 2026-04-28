import { useEffect, useState, type RefObject } from 'react'

/**
 * Provides the stageSize hook
 * @param {RefObject<HTMLDivElement | null>} containerRef - Value used for container ref
 * @param {HTMLImageElement | null} image - Value used for image
 * @returns {Object} Hook state for stage size
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
