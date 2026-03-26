import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

type FloatingNavProps = {
  left?: { label: string; to: string }
  right?: { label: string; to: string }
}

export function FloatingNav({ left, right }: FloatingNavProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-between px-4">
      {left ? (
        <Link
          to={left.to}
          className="glass pointer-events-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-all active:scale-95 hover:bg-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {left.label}
        </Link>
      ) : (
        <span />
      )}
      {right ? (
        <Link
          to={right.to}
          className="glass pointer-events-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-all active:scale-95 hover:bg-accent"
        >
          {right.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  )
}
