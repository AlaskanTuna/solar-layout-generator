import type { ProjectResponse } from '@/api/projects'

export type CardId =
  | 'hero-metrics'
  | 'bill-comparison'
  | 'system-cost'
  | 'financial-roadmap'
  | 'net-benefit'
  | 'system-assumptions'

type PrintReportProps = {
  project: ProjectResponse
  cardOrder: CardId[]
}

export function PrintReport({ project, cardOrder }: PrintReportProps) {
  const generatedAt = new Date().toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <div className="pdf-document">
      <section className="pdf-page" aria-label="Workbench layout">
        <header className="pdf-header">
          <h1 className="pdf-title">Solar Installation Report</h1>
          <p className="pdf-subtitle">
            {project.name} · Generated {generatedAt}
          </p>
        </header>
        <div className="pdf-placeholder">
          <p>Page 1: Workbench layout snapshot (Task 6 — pending)</p>
        </div>
      </section>

      <section className="pdf-page" aria-label="Analysis details">
        <div className="pdf-placeholder">
          <p>Pages 2+: Analysis cards in order: {cardOrder.join(' → ')}</p>
          <p>(Task 7 — pending)</p>
        </div>
      </section>
    </div>
  )
}
