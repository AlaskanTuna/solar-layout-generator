import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderCardProps = {
  children: ReactNode
  className?: string
}

export function PageHeaderCard({ children, className }: PageHeaderCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-solar-100/50 to-solar-200/30 p-8 dark:from-primary/5 dark:via-solar-950/30 dark:to-solar-900/20 animate-fade-in',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solar-400/10 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  )
}
