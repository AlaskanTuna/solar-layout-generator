/**
 * Dashboard page header treatment with optional decorative artwork.
 * Used above project summaries and informational pages to keep header rhythm consistent.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderCardProps = {
  children: ReactNode
  className?: string
  artSrc?: string
  artAlt?: string
}

/**
 * Renders a highlighted page header with optional background artwork.
 * Expects header children and optional image source/alt text for dashboard hero areas.
 */
export function PageHeaderCard({ children, className, artSrc, artAlt = '' }: PageHeaderCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-solar-100/50 to-solar-200/30 p-6 shadow-[0_1px_3px_rgba(234,88,12,0.06),0_8px_24px_rgba(234,88,12,0.05)] dark:border-primary/10 dark:from-primary/5 dark:via-solar-950/30 dark:to-solar-900/20 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] animate-fade-in sm:p-8',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solar-400/10 blur-3xl" />
      {artSrc && (
        <img
          src={artSrc}
          alt={artAlt}
          aria-hidden={artAlt ? undefined : true}
          className="pointer-events-none absolute -right-6 top-1/2 hidden h-[155%] max-h-64 w-auto -translate-y-1/2 object-contain opacity-75 dark:opacity-65 sm:block"
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
