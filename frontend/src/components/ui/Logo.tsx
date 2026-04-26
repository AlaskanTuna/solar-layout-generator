import { cn } from '@/lib/utils'

type LogoProps = {
  className?: string
}

// Renders the SolarSim brand mark, picking the light- or dark-theme variant
// from /public via Tailwind's `dark:` class. Both PNGs are square 1:1.
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      <img
        src="/logo-light.png"
        alt="SolarSim"
        className="block h-full w-full object-contain dark:hidden"
        draggable={false}
      />
      <img
        src="/logo-dark.png"
        alt=""
        aria-hidden="true"
        className="hidden h-full w-full object-contain dark:block"
        draggable={false}
      />
    </span>
  )
}
