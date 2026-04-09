import type { ReactNode } from 'react'
import { AppNav } from './AppNav'
import { AppFooter } from './AppFooter'
import { AppSidebar } from './AppSidebar'

type AppLayoutProps = {
  children: ReactNode
  /** Pass minimal to AppNav for full-screen pages */
  minimalNav?: boolean
}

const SIDEBAR_W = 64

export function AppLayout({ children, minimalNav }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppSidebar />
      <AppNav minimal={minimalNav} />
      <main className="flex-1 pt-14" style={{ marginLeft: SIDEBAR_W }}>
        {children}
      </main>
      <div style={{ marginLeft: SIDEBAR_W }}>
        <AppFooter />
      </div>
    </div>
  )
}
