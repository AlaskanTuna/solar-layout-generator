import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageContainerProps = {
  children: ReactNode
  /**
   * 'dashboard' – standard padded content area for /dashboard/* pages.
   *               Use flex=true when the page needs flex-col + flex-1 inner expansion
   *               (e.g. DashboardPage, SummaryPage).
   * 'mvp'       – wide-max-width workspace layout for WorkbenchPage / AnalysisPage.
   * 'full-bleed'– edge-to-edge layout for MapPage (applies inline height separately).
   */
  variant?: 'dashboard' | 'mvp' | 'full-bleed'
  /** When variant='dashboard', adds flex flex-col so inner flex-1 children fill height */
  flex?: boolean
  /** Extra classes forwarded onto the container div; tailwind-merge resolves conflicts */
  className?: string
}

const VARIANTS: Record<NonNullable<PageContainerProps['variant']>, string> = {
  dashboard: 'min-h-[calc(100vh-3.5rem)] px-12 py-14',
  mvp: 'mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 xl:h-[calc(100vh-3.5rem)] xl:flex-row',
  'full-bleed': 'relative flex w-full flex-col overflow-hidden p-4'
}

export function PageContainer({ children, variant = 'dashboard', flex = false, className }: PageContainerProps) {
  const flexClass = flex && variant === 'dashboard' ? 'flex flex-col' : ''
  return <div className={cn(VARIANTS[variant], flexClass, className)}>{children}</div>
}
