/**
 * Shared route content width and spacing wrapper.
 * Used by dashboard, MVP workflow, and full-bleed pages so page layouts stay consistent.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageContainerProps = {
  children: ReactNode
  // 'dashboard' is the standard padded content area, 'mvp' is the wide workspace, 'full-bleed' is edge to edge
  // Use flex=true only when a dashboard page needs inner flex-1 expansion
  variant?: 'dashboard' | 'mvp' | 'full-bleed'
  /** When variant='dashboard', adds flex flex-col so inner flex-1 children fill height */
  flex?: boolean
  /** Extra classes forwarded onto the container div; tailwind-merge resolves conflicts */
  className?: string
}

const VARIANTS: Record<NonNullable<PageContainerProps['variant']>, string> = {
  dashboard: 'mx-auto max-w-[1600px] min-h-[calc(100vh-3.5rem)] px-4 py-6 sm:py-8',
  mvp: 'mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 xl:h-[calc(100vh-3.5rem)] xl:flex-row',
  'full-bleed': 'relative flex w-full flex-col overflow-hidden p-4'
}

/**
 * Renders a route content container using one of the app's layout variants.
 * @param props - Children, variant, optional dashboard flex expansion, and extra classes.
 */
export function PageContainer({ children, variant = 'dashboard', flex = false, className }: PageContainerProps) {
  const flexClass = flex && variant === 'dashboard' ? 'flex flex-col' : ''
  return <div className={cn(VARIANTS[variant], flexClass, className)}>{children}</div>
}
