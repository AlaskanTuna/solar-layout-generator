import { useState, type ReactNode } from 'react'
import { AppNav } from './AppNav'
import { AppFooter } from './AppFooter'
import { AppSidebar } from './AppSidebar'

type AppLayoutProps = {
  children: ReactNode
  /** Pass minimal to AppNav for full-screen pages */
  minimalNav?: boolean
}

export function AppLayout({ children, minimalNav }: AppLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[140px] dark:bg-primary/[0.06]" />
        <div className="absolute -bottom-48 -left-32 h-[480px] w-[480px] rounded-full bg-solar-400/10 blur-[120px] dark:bg-solar-400/[0.05]" />
      </div>
      <AppSidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <AppNav minimal={minimalNav} onMenuClick={() => setMobileSidebarOpen(true)} />
      <main className="flex-1 pt-14 lg:ml-16">{children}</main>
      <div className="lg:ml-16">
        <AppFooter />
      </div>
    </div>
  )
}
