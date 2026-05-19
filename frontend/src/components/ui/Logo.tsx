/**
 * SolarSim brand mark.
 *
 * Renders the SolarSim logo using a CSS background-image so the browser only
 * fetches the variant matching the current theme. The previous approach (dual
 * `<img>` elements with `display: none`) can still trigger both downloads in
 * some browsers — this approach guarantees a single fetch.
 *
 * Tailwind's `dark:` variant swaps the URL when the `.dark` class is on the
 * html element. `role="img"` + `aria-label` keep this accessible without a
 * DOM-level `<img>`.
 */

import { cn } from '@/lib/utils'

type LogoProps = {
  className?: string
}

/**
 * Themed SolarSim logo. `className` is composed with the base styling so
 * callers can size the logo (e.g. `h-6 w-24`).
 */
export function Logo({ className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="SolarSim"
      className={cn(
        'inline-block shrink-0 bg-contain bg-center bg-no-repeat',
        "bg-[url('/logo-light.png')] dark:bg-[url('/logo-dark.png')]",
        className
      )}
    />
  )
}
