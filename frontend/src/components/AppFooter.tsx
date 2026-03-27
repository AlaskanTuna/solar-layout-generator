import { Link } from 'react-router-dom'
import { Sun, Leaf } from 'lucide-react'

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Sun className="h-3 w-3 text-white" />
            </div>
            <span className="font-heading text-xs font-semibold tracking-tight">SolarSim</span>
          </Link>
          <span className="text-xs text-muted-foreground">&middot; 2026</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Leaf className="h-3 w-3 text-green-600 dark:text-green-400" />
          UN SDG 7: Affordable and Clean Energy
        </div>
      </div>
    </footer>
  )
}
