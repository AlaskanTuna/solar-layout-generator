import type { ReactNode } from 'react'
import { AppNav } from './AppNav'
import { AppFooter } from './AppFooter'

type AppLayoutProps = {
  children: ReactNode
  /** Use 'full' for pages that need the whole viewport (Map, Workbench). Default is 'scroll'. */
  mode?: 'scroll' | 'full'
  /** Pass minimal to AppNav for full-screen pages */
  minimalNav?: boolean
}

export function AppLayout({ children, mode = 'scroll', minimalNav }: AppLayoutProps) {
  if (mode === 'full') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <AppNav minimal={minimalNav} />
        <main className="flex-1 overflow-hidden pt-14">{children}</main>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <main className="flex-1 pt-14">{children}</main>
      <AppFooter />
    </div>
  )
}
