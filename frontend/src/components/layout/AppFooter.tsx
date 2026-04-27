import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 px-6 py-8">
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Leaf className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
          UN SDG 7: Affordable and Clean Energy
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Logo className="h-6 w-6" />
            <span className="font-heading text-xs font-semibold tracking-tight">SolarSim</span>
          </Link>
          <span className="text-xs text-muted-foreground">&middot; 2026</span>
        </div>
      </div>
    </footer>
  )
}
