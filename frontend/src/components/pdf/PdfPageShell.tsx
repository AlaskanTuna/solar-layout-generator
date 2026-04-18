import { Sun, Leaf } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  projectName: string
  generatedAt: string
  sectionLabel: string
  context?: string
  children: ReactNode
  pageBreak?: boolean
}

export function PdfPageShell({
  projectName,
  generatedAt,
  sectionLabel,
  context,
  children,
  pageBreak = true
}: Props) {
  return (
    <section className={`pdf-page flex flex-col ${pageBreak ? 'pdf-page-break' : ''}`}>
      <header className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-xs font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Solar Installation Report</p>
            <p className="text-[9px] text-muted-foreground">
              {projectName} &middot; Generated {generatedAt}
            </p>
          </div>
        </div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{sectionLabel}</p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>

      {context && (
        <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-[10px] italic leading-relaxed text-muted-foreground">
          {context}
        </p>
      )}

      <footer className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <Leaf className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
          UN SDG 7: Affordable and Clean Energy
        </div>
        <div className="h-2.5 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-primary">
            <Sun className="h-2 w-2 text-white" />
          </div>
          <span className="font-heading text-[9px] font-semibold tracking-tight">SolarSim</span>
          <span className="text-[9px] text-muted-foreground">&middot; 2026</span>
        </div>
      </footer>
    </section>
  )
}
