/**
 * Shared page shell for PDF report sections.
 * Gives workbench and analysis print pages consistent labels, page breaks, and contextual footnotes.
 */

import type { ReactNode } from 'react'

type Props = {
  sectionLabel: string
  context?: string
  children: ReactNode
  pageBreak?: boolean
}

/**
 * Renders one printable PDF page section with a section label and optional explanatory context.
 * @param sectionLabel - Short page section label displayed at the top of the page.
 * @param context - Optional explanatory note rendered near the bottom of the page.
 * @param children - Print page body content.
 * @param pageBreak - Whether the section forces a print page break after itself.
 */
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
