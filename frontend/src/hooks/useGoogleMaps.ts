import { useEffect, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

let loaded = false
let loadError: string | null = null
let loadPromise: Promise<void> | null = null

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['places', 'marker']
})

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loader.load().then(() => {
      loaded = true
    })
  }
  return loadPromise
}

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(loaded)
  const [error, setError] = useState<string | null>(loadError)

  useEffect(() => {
    if (loaded) return

    ensureLoaded()
      .then(() => setIsLoaded(true))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load Google Maps'
        loadError = msg
        setError(msg)
      })
  }, [])

  return { isLoaded, error }
}
