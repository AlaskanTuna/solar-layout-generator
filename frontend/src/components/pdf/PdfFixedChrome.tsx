import { Sun, Leaf } from 'lucide-react'

type HeaderProps = {
  projectName: string
  generatedAt: string
}

export function PdfFixedHeader({ projectName, generatedAt }: HeaderProps) {
  return (
    <header className="pdf-doc-header">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
          <span className="text-[10px] font-bold text-primary-foreground">S</span>
        </div>
        <div>
          <p className="text-[10px] font-bold leading-tight text-foreground">Solar Installation Report</p>
          <p className="text-[8px] leading-tight text-muted-foreground">
            {projectName} &middot; Generated {generatedAt}
          </p>
        </div>
      </div>
    </header>
  )
}

export function PdfFixedFooter() {
  return (
    <footer className="pdf-doc-footer">
      <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
        <Leaf className="h-2 w-2 text-green-600 dark:text-green-400" />
        UN SDG 7: Affordable and Clean Energy
      </div>
      <div className="h-2 w-px bg-border" />
      <div className="flex items-center gap-1">
        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-primary">
          <Sun className="h-2 w-2 text-white" />
        </div>
        <span className="font-heading text-[8px] font-semibold tracking-tight">SolarSim</span>
        <span className="text-[8px] text-muted-foreground">&middot; 2026</span>
      </div>
    </footer>
  )
}
