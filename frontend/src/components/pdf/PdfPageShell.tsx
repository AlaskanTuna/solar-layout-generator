import type { ReactNode } from 'react'

type Props = {
  sectionLabel: string
  context?: string
  children: ReactNode
  pageBreak?: boolean
}

export function PdfPageShell({ sectionLabel, context, children, pageBreak = true }: Props) {
  return (
    <section className={`pdf-page flex flex-col ${pageBreak ? 'pdf-page-break' : ''}`}>
      <div className="mb-2 border-b border-border pb-1.5">
        <p className="text-xs font-semibold text-foreground">{sectionLabel}</p>
      </div>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      {context && (
        <p className="mt-2 rounded-md bg-muted/40 px-3 py-1.5 text-[9px] italic leading-relaxed text-muted-foreground">
          {context}
        </p>
      )}
    </section>
  )
}
