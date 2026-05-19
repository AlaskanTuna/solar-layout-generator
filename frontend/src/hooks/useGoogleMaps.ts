/**
 * Google Maps JS API loader hook.
 *
 * The Google Maps SDK is a singleton; importing it multiple times in a React
 * tree breaks (it patches `window.google` once and errors thereafter). The
 * module-level `loaded` / `loadPromise` / `loader` variables centralise that
 * singleton so any component that calls `useGoogleMaps` waits on the same
 * shared promise.
 */

import { useEffect, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

/** Module-level flag flipped to `true` after the first successful load. */
let loaded = false
/** Module-level cached error message from the first failed load attempt. */
let loadError: string | null = null
/** In-flight load promise — reused by every concurrent `useGoogleMaps` call. */
let loadPromise: Promise<void> | null = null

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? ''
})

/**
 * Kicks off (or reuses) the Google Maps SDK load. Loads the four libraries
 * the workbench and map page actually use: `maps`, `places` (autocomplete),
 * `marker` (advanced markers), and `geocoding` (reverse geocoding).
 */
function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all([
      loader.importLibrary('maps'),
      loader.importLibrary('places'),
      loader.importLibrary('marker'),
      loader.importLibrary('geocoding')
    ]).then(() => {
      loaded = true
    })
  }
  return loadPromise
}

/**
 * Hook returning `{ isLoaded, error }` for the Google Maps SDK.
 *
 * Components should render a placeholder until `isLoaded` is `true`. The
 * shared module-level singletons guarantee the SDK is only loaded once
 * regardless of how many concurrent callers there are.
 */
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
