import { cn } from '@/lib/utils'

type LogoProps = {
  className?: string
}

// SolarSim brand mark. Uses CSS background-image so the browser only fetches
// the variant matching the current theme (vs. dual-<img> with display:none,
// which can still trigger both downloads). Tailwind's `dark:` variant swaps
// the URL when the `.dark` class is on the html element.
//
// `role="img"` + `aria-label` keep this accessible without a DOM-level <img>.
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
