import { useEffect, useState } from 'react'
import { getOverlayUrl } from '@/api/locations'
import { notify } from '@/components/ui/toastConfig'

function useLoadedImage(src: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      setImageError(null)
      return
    }

    const nextImage = new window.Image()
    const loadTimeout = window.setTimeout(() => {
      setImage(null)
      setImageError('Timed out while loading the rooftop preview image')
    }, 15000)

    if (import.meta.env.DEV) {
      console.info('[WorkbenchImage] Loading rooftop image', { src })
    }

    nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      window.clearTimeout(loadTimeout)
      setImage(nextImage)
      setImageError(null)

      if (import.meta.env.DEV) {
        console.info('[WorkbenchImage] Rooftop image loaded', {
          width: nextImage.width,
          height: nextImage.height
        })
      }
    }
    nextImage.onerror = () => {
      window.clearTimeout(loadTimeout)
      setImage(null)
      setImageError(`Failed to load rooftop image from: ${src.slice(0, 120)}`)

      if (import.meta.env.DEV) {
        console.error('[WorkbenchImage] Rooftop image failed to load', { src })
      }
    }
    nextImage.src = src

    return () => {
      window.clearTimeout(loadTimeout)
      nextImage.onload = null
      nextImage.onerror = null
    }
  }, [src])

  return { image, imageError }
}

/** Selectable workbench overlay layers backed by the Solar API GeoTIFF endpoints. */
export type OverlayMode = 'rgb' | 'annual-flux' | 'dsm' | 'mask'

/**
 * Loads and caches the active workbench overlay image, falling back to the cached RGB.
 *
 * @param rgbImageUrl - Signed URL of the RGB satellite image; used both as the `rgb` mode and as fallback
 * @param locationId - Location id used to fetch the per-mode overlay PNG via `/api/locations/:id/overlay`
 * @param overlayMode - Active overlay layer from the workbench toolbar
 * @returns `{ image, imageError }` — `image` is the latest successfully loaded `HTMLImageElement`, `imageError` is the message of the most recent load failure (if any)
 */
export function useOverlayImages(
  rgbImageUrl: string | undefined,
  locationId: string | undefined,
  overlayMode: OverlayMode
) {
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null)
  const [isOverlayLoading, setIsOverlayLoading] = useState(false)

  const { image: backgroundImage, imageError } = useLoadedImage(rgbImageUrl)
  const { image: overlayImage } = useLoadedImage(overlayMode !== 'rgb' ? (overlayImageUrl ?? undefined) : undefined)
  const displayImage = overlayMode !== 'rgb' && overlayImage ? overlayImage : backgroundImage

  useEffect(() => {
    if (overlayMode === 'rgb' || !locationId) {
      setOverlayImageUrl(null)
      return
    }
    let cancelled = false
    setIsOverlayLoading(true)
    getOverlayUrl(locationId, overlayMode)
      .then((data) => {
        if (!cancelled) setOverlayImageUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) {
          setOverlayImageUrl(null)
          notify.error(`Failed to load ${overlayMode} overlay`)
        }
      })
      .finally(() => {
        if (!cancelled) setIsOverlayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [overlayMode, locationId])

  return { backgroundImage, displayImage, imageError, isOverlayLoading }
}
