import type { ProjectResponse } from '@/api/projects'
import { PdfFixedFooter, PdfFixedHeader } from './PdfFixedChrome'
import { PrintPage1Workbench } from './PrintPage1Workbench'
import { PrintPage2Analysis } from './PrintPage2Analysis'

export type CardId =
  | 'solar-verdict'
  | 'bill-comparison'
  | 'cumulative-savings'
  | 'system-cost'
  | 'financial-roadmap'
  | 'net-benefit'
  | 'month-table'
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
      <PdfFixedHeader projectName={project.name} generatedAt={generatedAt} />
      <PdfFixedFooter />
      <PrintPage1Workbench project={project} />
      <PrintPage2Analysis project={project} cardOrder={cardOrder} />
    </div>
  )
}
